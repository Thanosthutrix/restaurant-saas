"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";
import { invalidateDishesCache } from "@/lib/cacheInvalidation";
import {
  tripoCreateImageToModelTask,
  tripoCreateImageToModelTaskFromUrl,
  tripoCreateRefineModelTask,
  tripoCreateTextureEnhancementTask,
  tripoExtractTexturedGlbUrl,
  tripoGetStsToken,
  tripoGetTask,
  tripoImageFormatFromMime,
  tripoIsDraftGenerationTask,
  tripoIsPostProcessTask,
  tripoExtractDraftTaskId,
  tripoIsStaleRunningTask,
  tripoMapPipelineProgress,
  tripoPollTaskUntilDone,
  tripoPostProcessKind,
  tripoShouldRunPostProcess,
  tripoTaskAgeMs,
  tripoUploadImageToS3,
  type TripoTask,
  type TripoTaskStatus,
} from "@/lib/tripo3d/tripoClient";
import { buildGlbStorageNote, isEphemeralTripoModelUrl, persistDishGlbFromUrl, uploadDishArSourceImage } from "@/lib/dishes/dishArStorage";
import { getDish } from "@/lib/db";
import { supabaseServer } from "@/lib/supabaseServer";

export type DishArActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export type DishArPollResult = {
  status: TripoTaskStatus | "idle" | "refining";
  progress: number;
  model3dUrl: string | null;
  error: string | null;
  phaseLabel: string | null;
  storageNote: string | null;
};

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

async function assertDishWrite(restaurantId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "dishes.mutate");
  if (!gate.ok) return { ok: false as const, error: gate.error };
  return { ok: true as const };
}

async function updateDishArState(
  dishId: string,
  restaurantId: string,
  patch: Record<string, unknown>
) {
  const { error } = await supabaseServer
    .from("dishes")
    .update(patch)
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId);
  if (error) throw new Error(error.message);
}

/**
 * Étape 2 : texture_model (v3, comme le site) ou refine_model (v2).
 */
async function startPostProcessFromDraft(params: {
  dishId: string;
  restaurantId: string;
  draftTaskId: string;
}): Promise<{ taskId: string; phase: "refine" | "texture" } | null> {
  const { dishId, restaurantId, draftTaskId } = params;

  const commitNextTask = async (nextTaskId: string, phase: "refine" | "texture") => {
    const { data, error } = await supabaseServer
      .from("dishes")
      .update({
        tripo_task_id: nextTaskId,
        model_3d_status: "running",
        model_3d_error: null,
      })
      .eq("id", dishId)
      .eq("restaurant_id", restaurantId)
      .eq("tripo_task_id", draftTaskId)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    return { taskId: nextTaskId, phase };
  };

  if (tripoPostProcessKind() === "texture") {
    const textured = await tripoCreateTextureEnhancementTask(draftTaskId);
    return await commitNextTask(textured.task_id, "texture");
  }

  try {
    const refined = await tripoCreateRefineModelTask(draftTaskId);
    return await commitNextTask(refined.task_id, "refine");
  } catch {
    const textured = await tripoCreateTextureEnhancementTask(draftTaskId);
    return await commitNextTask(textured.task_id, "texture");
  }
}

async function persistModelFromTripoTask(params: {
  restaurantId: string;
  dishId: string;
  task: TripoTask;
}): Promise<{ url: string; storageNote: string | null }> {
  const glbRemoteUrl = tripoExtractTexturedGlbUrl(params.task.output ?? {});
  if (!glbRemoteUrl) {
    throw new Error("Tripo3D n’a pas renvoyé d’URL .glb texturé.");
  }

  const persisted = await persistDishGlbFromUrl({
    restaurantId: params.restaurantId,
    dishId: params.dishId,
    glbUrl: glbRemoteUrl,
  });

  const storageNote = buildGlbStorageNote(persisted);

  await updateDishArState(params.dishId, params.restaurantId, {
    model_3d_url: persisted.url,
    model_3d_status: "success",
    model_3d_error: null,
    model_3d_generated_at: new Date().toISOString(),
  });

  invalidateDishesCache();
  revalidatePath(`/dishes/${params.dishId}`);
  revalidatePath("/dishes");

  return { url: persisted.url, storageNote };
}

function phaseLabelForTask(task: TripoTask): string {
  if (tripoIsDraftGenerationTask(task)) return "Génération 3D haute qualité";
  if (task.type === "refine_model") return "Affinage du modèle (refine)";
  if (task.type === "texture_model") return "Textures HD & PBR";
  return "Finalisation";
}

/** Si refine/texture tourne alors que le brouillon est déjà prêt, on ne bloque pas l’utilisateur. */
const TRIPO_POST_PROCESS_GRACE_MS = 3 * 60 * 1000;

/** Si refine/texture bloque trop longtemps, on tente de récupérer le modèle du brouillon image_to_model. */
async function tryRecoverStaleTask(params: {
  task: TripoTask;
  restaurantId: string;
  dishId: string;
}): Promise<{ url: string; storageNote: string | null } | null> {
  if (!tripoIsPostProcessTask(params.task)) return null;
  if (params.task.status === "success" || params.task.status === "failed") return null;

  const draftId = tripoExtractDraftTaskId(params.task);
  if (!draftId) return null;

  const postAge = tripoTaskAgeMs(params.task);
  const waitedLongEnough =
    tripoIsStaleRunningTask(params.task) ||
    (postAge != null && postAge > TRIPO_POST_PROCESS_GRACE_MS);
  // Ne pas court-circuiter texture_model en cours (sinon on garde le brouillon sans textures HD).
  if (params.task.type === "texture_model" && !tripoIsStaleRunningTask(params.task)) {
    return null;
  }
  if (!waitedLongEnough) return null;

  const draft = await tripoGetTask(draftId);
  if (draft.status !== "success") return null;

  return persistModelFromTripoTask({
    restaurantId: params.restaurantId,
    dishId: params.dishId,
    task: draft,
  });
}

/**
 * Étape 1 : envoi de la photo → Tripo3D (tâche image_to_model).
 * Le client enchaîne avec pollDishArGeneration toutes les 5 s.
 */
export async function startDishArGeneration(formData: FormData): Promise<
  DishArActionResult<{ taskId: string; progress: number }>
> {
  const restaurantId = String(formData.get("restaurantId") ?? "").trim();
  const dishId = String(formData.get("dishId") ?? "").trim();
  const file = formData.get("photo");

  if (!restaurantId || !dishId) return { ok: false, error: "Paramètres manquants." };
  if (!(file instanceof File)) return { ok: false, error: "Choisissez une photo du plat." };

  const gate = await assertDishWrite(restaurantId);
  if (!gate.ok) return gate;

  const dishRes = await getDish(dishId);
  if (dishRes.error || !dishRes.data || dishRes.data.restaurant_id !== restaurantId) {
    return { ok: false, error: "Plat introuvable." };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Photo trop lourde (20 Mo max.)." };
  }

  const format = tripoImageFormatFromMime(file.type);
  if (!format) {
    return { ok: false, error: "Format accepté : JPEG, PNG ou WebP." };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = format === "jpeg" ? "jpg" : format;

    let taskId: string;
    let sourceImageUrl: string | null = null;

    try {
      const sts = await tripoGetStsToken(format);
      const { bucket, key } = await tripoUploadImageToS3(bytes, file.type, sts);
      const created = await tripoCreateImageToModelTask({ bucket, key });
      taskId = created.task_id;
    } catch (stsErr) {
      // Secours : photo hébergée sur Supabase + URL (si le bucket est public)
      const uploaded = await uploadDishArSourceImage({
        restaurantId,
        dishId,
        bytes,
        contentType: file.type,
        ext,
      });
      sourceImageUrl = uploaded.publicUrl;
      const created = await tripoCreateImageToModelTaskFromUrl({
        imageUrl: uploaded.publicUrl,
        format,
      });
      taskId = created.task_id;
    }

    await updateDishArState(dishId, restaurantId, {
      tripo_task_id: taskId,
      model_3d_status: "queued",
      model_3d_error: null,
      model_3d_source_image_url: sourceImageUrl,
    });

    invalidateDishesCache();
    revalidatePath(`/dishes/${dishId}`);
    revalidatePath("/dishes");

    return { ok: true, data: { taskId, progress: 0 } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur Tripo3D.";
    await updateDishArState(dishId, restaurantId, {
      model_3d_status: "failed",
      model_3d_error: msg,
    }).catch(() => undefined);
    return { ok: false, error: msg };
  }
}

/**
 * Étape 2 : un appel de polling (à répéter côté client toutes les 5 s).
 * Quand Tripo renvoie success, le .glb est copié sur Supabase et l’URL est enregistrée.
 */
export async function pollDishArGeneration(params: {
  restaurantId: string;
  dishId: string;
}): Promise<DishArActionResult<DishArPollResult>> {
  const { restaurantId, dishId } = params;
  const gate = await assertDishWrite(restaurantId);
  if (!gate.ok) return gate;

  const dishRes = await getDish(dishId);
  if (dishRes.error || !dishRes.data || dishRes.data.restaurant_id !== restaurantId) {
    return { ok: false, error: "Plat introuvable." };
  }

  const dish = dishRes.data;
  if (dish.model_3d_url) {
    return {
      ok: true,
      data: {
        status: "success",
        progress: 100,
        model3dUrl: dish.model_3d_url,
        error: null,
        phaseLabel: null,
        storageNote: null,
      },
    };
  }

  const taskId = dish.tripo_task_id?.trim();
  if (!taskId) {
    return {
      ok: true,
      data: {
        status: "idle",
        progress: 0,
        model3dUrl: null,
        error: dish.model_3d_error ?? null,
        phaseLabel: null,
        storageNote: null,
      },
    };
  }

  try {
    const task = await tripoGetTask(taskId);
    const mappedProgress = tripoMapPipelineProgress(task);
    const phaseLabel = phaseLabelForTask(task);

    if (task.status !== "success") {
      const recovered = await tryRecoverStaleTask({ task, restaurantId, dishId });
      if (recovered) {
        return {
          ok: true,
          data: {
            status: "success",
            progress: 100,
            model3dUrl: recovered.url,
            error: null,
            phaseLabel: null,
            storageNote: recovered.storageNote,
          },
        };
      }

      if (task.status === "failed" || task.status === "banned" || task.status === "expired" || task.status === "cancelled") {
        const errMsg = `Génération échouée (${task.status}).`;
        await updateDishArState(dishId, restaurantId, {
          model_3d_status: "failed",
          model_3d_error: errMsg,
        });
        return {
          ok: true,
          data: {
            status: task.status,
            progress: mappedProgress,
            model3dUrl: null,
            error: errMsg,
            phaseLabel,
            storageNote: null,
          },
        };
      }

      const dbStatus =
        task.status === "queued" || task.status === "running"
          ? task.status
          : "running";

      await updateDishArState(dishId, restaurantId, {
        model_3d_status: dbStatus,
        model_3d_error: null,
      });

      const uiStatus: DishArPollResult["status"] = tripoIsPostProcessTask(task)
        ? "refining"
        : task.status === "queued"
          ? "queued"
          : "running";

      return {
        ok: true,
        data: {
          status: uiStatus,
          progress: mappedProgress,
          model3dUrl: null,
          error: null,
          phaseLabel,
          storageNote: null,
        },
      };
    }

    // H3 (v3.x) : une passe suffit. Évite refine_model qui peut bloquer 15+ min.
    if (tripoIsDraftGenerationTask(task) && tripoShouldRunPostProcess()) {
      const post = await startPostProcessFromDraft({
        dishId,
        restaurantId,
        draftTaskId: taskId,
      });

      if (post) {
        invalidateDishesCache();
        revalidatePath(`/dishes/${dishId}`);
        return {
          ok: true,
          data: {
            status: "refining",
            progress: 45,
            model3dUrl: null,
            error: null,
            phaseLabel:
              post.phase === "refine" ? "Affinage du modèle (refine)" : "Textures HD & PBR",
            storageNote: null,
          },
        };
      }

      const refreshed = await getDish(dishId);
      const activeTaskId = refreshed.data?.tripo_task_id?.trim();
      if (activeTaskId && activeTaskId !== taskId) {
        const activeTask = await tripoGetTask(activeTaskId);
        return {
          ok: true,
          data: {
            status: "refining",
            progress: tripoMapPipelineProgress(activeTask),
            model3dUrl: null,
            error: null,
            phaseLabel: phaseLabelForTask(activeTask),
            storageNote: null,
          },
        };
      }
    }

    const persisted = await persistModelFromTripoTask({
      restaurantId,
      dishId,
      task,
    });

    return {
      ok: true,
      data: {
        status: "success",
        progress: 100,
        model3dUrl: persisted.url,
        error: null,
        phaseLabel: null,
        storageNote: persisted.storageNote,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur de suivi Tripo3D.";
    return { ok: false, error: msg };
  }
}

/**
 * Variante « tout-en-un » côté serveur (polling 5 s) — pratique en local ;
 * en production serverless, préférer start + poll côté client.
 */
export async function generateDishArFromPhotoBlocking(formData: FormData): Promise<
  DishArActionResult<{ model3dUrl: string }>
> {
  const started = await startDishArGeneration(formData);
  if (!started.ok || !started.data?.taskId) {
    return started.ok === false ? started : { ok: false, error: "Impossible de démarrer la génération." };
  }

  const restaurantId = String(formData.get("restaurantId") ?? "").trim();
  const dishId = String(formData.get("dishId") ?? "").trim();

  try {
    await tripoPollTaskUntilDone(started.data.taskId, { intervalMs: 5000, maxWaitMs: 20 * 60 * 1000 });

    const deadline = Date.now() + 20 * 60 * 1000;
    while (Date.now() < deadline) {
      const polled = await pollDishArGeneration({ restaurantId, dishId });
      if (!polled.ok) return { ok: false, error: polled.error };
      if (polled.data?.model3dUrl) {
        return { ok: true, data: { model3dUrl: polled.data.model3dUrl } };
      }
      if (
        polled.data?.status === "failed" ||
        polled.data?.status === "cancelled" ||
        polled.data?.status === "expired"
      ) {
        return { ok: false, error: polled.data.error ?? "Génération échouée." };
      }
      await new Promise((r) => setTimeout(r, 5000));
    }

    return { ok: false, error: "Délai dépassé pendant l’affinage du modèle." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Génération interrompue." };
  }
}

export async function rePersistDishArToSupabase(params: {
  restaurantId: string;
  dishId: string;
}): Promise<DishArActionResult<{ model3dUrl: string; storageNote: string | null }>> {
  const gate = await assertDishWrite(params.restaurantId);
  if (!gate.ok) return gate;

  const dishRes = await getDish(params.dishId);
  if (dishRes.error || !dishRes.data || dishRes.data.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "Plat introuvable." };
  }

  const remoteUrl = dishRes.data.model_3d_url?.trim();
  if (!remoteUrl) return { ok: false, error: "Aucun modèle à enregistrer." };
  if (!isEphemeralTripoModelUrl(remoteUrl)) {
    return { ok: true, data: { model3dUrl: remoteUrl, storageNote: null } };
  }

  try {
    const persisted = await persistDishGlbFromUrl({
      restaurantId: params.restaurantId,
      dishId: params.dishId,
      glbUrl: remoteUrl,
    });

    if (persisted.storage !== "supabase") {
      const optimizedMb = (persisted.sizeBytes / (1024 * 1024)).toFixed(1);
      return {
        ok: false,
        error: `Impossible de réduire sous 50 Mo (source : ${(persisted.originalBytes / (1024 * 1024)).toFixed(1)} Mo, meilleur essai : ${optimizedMb} Mo). Réessayez ou régénérez le modèle.`,
      };
    }

    const storageNote = buildGlbStorageNote(persisted);
    await updateDishArState(params.dishId, params.restaurantId, {
      model_3d_url: persisted.url,
      model_3d_status: "success",
      model_3d_error: null,
    });

    invalidateDishesCache();
    revalidatePath(`/dishes/${params.dishId}`);

    return { ok: true, data: { model3dUrl: persisted.url, storageNote } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Optimisation impossible." };
  }
}

export async function clearDishArModel(params: {
  restaurantId: string;
  dishId: string;
}): Promise<DishArActionResult> {
  const gate = await assertDishWrite(params.restaurantId);
  if (!gate.ok) return gate;

  await updateDishArState(params.dishId, params.restaurantId, {
    model_3d_url: null,
    tripo_task_id: null,
    model_3d_status: null,
    model_3d_error: null,
    model_3d_generated_at: null,
  });

  invalidateDishesCache();
  revalidatePath(`/dishes/${params.dishId}`);
  return { ok: true };
}
