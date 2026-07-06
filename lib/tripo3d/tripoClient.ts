/**
 * Client serveur Tripo3D (Image-to-3D haute qualité + post-traitement).
 *
 * Clé API : définir TRIPO_API_KEY dans .env.local (jamais côté client).
 * Version modèle (optionnel) : TRIPO_MODEL_VERSION (défaut v3.1-20260211, qualité H3 max).
 * Obtenir une clé : https://platform.tripo3d.ai/
 *
 * Flux qualité site web (H3 / v3.x) :
 * 1. image_to_model — géométrie Ultra + textures HD en une passe (comme le site)
 * 2. (optionnel, H2/v1.4) refine_model — désactivé par défaut sur v3.x car il peut bloquer indéfiniment
 *
 * Endpoints (OpenAPI v2) :
 * - POST /v2/openapi/upload/sts/token
 * - POST /v2/openapi/task
 * - GET  /v2/openapi/task/{task_id}
 */

const TRIPO_API_BASE = "https://api.tripo3d.ai/v2/openapi";

/** Version H3 la plus récente (qualité max, géométrie Ultra + textures HD). */
export const TRIPO_DEFAULT_MODEL_VERSION = "v3.1-20260211";

export type TripoTaskStatus =
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "banned"
  | "expired"
  | "cancelled"
  | "unknown";

export type TripoTaskType =
  | "image_to_model"
  | "refine_model"
  | "texture_model"
  | "convert_model"
  | string;

export type TripoStsCredentials = {
  s3_host: string;
  resource_bucket: string;
  resource_uri: string;
  session_token: string;
  sts_ak: string;
  sts_sk: string;
};

export type TripoTask = {
  task_id: string;
  type: TripoTaskType;
  status: TripoTaskStatus;
  progress: number;
  output: Record<string, unknown>;
  input?: Record<string, unknown>;
  create_time?: number;
  running_left_time?: number;
};

/** Au-delà de ce délai, on tente de récupérer le modèle du brouillon (refine bloqué). */
export const TRIPO_STALE_TASK_MS = 12 * 60 * 1000;

type TripoEnvelope<T> = {
  code: number;
  data?: T;
  message?: string;
};

export function getTripoModelVersion(): string {
  return process.env.TRIPO_MODEL_VERSION?.trim() || TRIPO_DEFAULT_MODEL_VERSION;
}

/**
 * Étape 2 après image_to_model.
 * - v3.x → texture_model (équivalent « Enhance » / textures HD sur le site Tripo)
 * - v2.x → refine_model (legacy)
 * Désactiver avec TRIPO_REFINE_STEP=false
 */
export function tripoShouldRunPostProcess(): boolean {
  const env = process.env.TRIPO_REFINE_STEP?.trim().toLowerCase();
  if (env === "false" || env === "0") return false;
  return true;
}

export function tripoPostProcessKind(): "texture" | "refine" {
  return getTripoModelVersion().startsWith("v3.") ? "texture" : "refine";
}

/** H3 (v3.x) accepte geometry_quality ; H2 (v2.x) non. */
function supportsGeometryQuality(modelVersion: string): boolean {
  return modelVersion.startsWith("v3.");
}

export function tripoTaskAgeMs(task: TripoTask): number | null {
  if (typeof task.create_time === "number" && task.create_time > 0) {
    return Date.now() - task.create_time * 1000;
  }
  return null;
}

export function tripoIsStaleRunningTask(task: TripoTask): boolean {
  if (task.status !== "queued" && task.status !== "running") return false;
  const age = tripoTaskAgeMs(task);
  return age != null && age > TRIPO_STALE_TASK_MS;
}

export function tripoExtractDraftTaskId(task: TripoTask): string | null {
  const input = task.input ?? {};
  if (typeof input.draft_model_task_id === "string" && input.draft_model_task_id.trim()) {
    return input.draft_model_task_id.trim();
  }
  if (typeof input.original_model_task_id === "string" && input.original_model_task_id.trim()) {
    return input.original_model_task_id.trim();
  }
  return null;
}

/** Fichier uploadé via STS (format officiel Tripo). */
export function tripoFileFromStsObject(bucket: string, key: string): Record<string, unknown> {
  return {
    type: "object",
    object: { bucket, key },
  };
}

/** Fichier hébergé par URL publique. */
export function tripoFileFromUrl(
  imageUrl: string,
  format: "jpeg" | "png" | "webp"
): Record<string, unknown> {
  return { type: format, url: imageUrl };
}

/**
 * Paramètres image_to_model alignés sur le site Tripo (Ultra + textures HD).
 * Ne pas envoyer compress: "geometry" — ça dégrade fortement le mesh (ajouté pour Supabase, retiré).
 */
function buildHighQualityImageToModelBody(
  file: Record<string, unknown>,
  modelVersion: string
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: "image_to_model",
    model_version: modelVersion,
    file,
    texture: true,
    pbr: true,
    texture_quality: "detailed",
    texture_alignment: "original_image",
    enable_image_autofix: true,
    orientation: "align_image",
    export_uv: true,
  };

  if (supportsGeometryQuality(modelVersion)) {
    body.geometry_quality = "detailed";
  }

  return body;
}

export function getTripoApiKey(): string {
  const key = process.env.TRIPO_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "TRIPO_API_KEY manquante. Ajoutez-la dans .env.local (Dashboard Tripo3D → API Keys)."
    );
  }
  return key;
}

async function tripoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = getTripoApiKey();
  const res = await fetch(`${TRIPO_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const raw = (await res.json().catch(() => ({}))) as TripoEnvelope<T> & TripoTask;
  if (!res.ok) {
    const msg =
      typeof raw.message === "string"
        ? raw.message
        : `Tripo3D HTTP ${res.status}`;
    throw new Error(msg);
  }

  if (typeof raw.code === "number") {
    if (raw.code !== 0) {
      throw new Error(raw.message ?? `Tripo3D erreur (code ${raw.code})`);
    }
    if (raw.data != null) return raw.data;
  }

  return raw as T;
}

/** Format image accepté par Tripo (max 20 Mo). */
export function tripoImageFormatFromMime(mime: string): "jpeg" | "png" | "webp" | null {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpeg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return null;
}

/** Demande des identifiants STS pour upload direct vers le bucket Tripo. */
export async function tripoGetStsToken(format: "jpeg" | "png" | "webp"): Promise<TripoStsCredentials> {
  return tripoRequest<TripoStsCredentials>("/upload/sts/token", {
    method: "POST",
    body: JSON.stringify({ format }),
  });
}

/** Upload binaire vers S3 Tripo (credentials STS). */
export async function tripoUploadImageToS3(
  imageBytes: Uint8Array,
  mimeType: string,
  sts: TripoStsCredentials
): Promise<{ bucket: string; key: string }> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const client = new S3Client({
    region: "us-west-2",
    credentials: {
      accessKeyId: sts.sts_ak,
      secretAccessKey: sts.sts_sk,
      sessionToken: sts.session_token,
    },
    endpoint: `https://${sts.s3_host}`,
    forcePathStyle: false,
  });

  await client.send(
    new PutObjectCommand({
      Bucket: sts.resource_bucket,
      Key: sts.resource_uri,
      Body: imageBytes,
      ContentType: mimeType,
    })
  );

  return { bucket: sts.resource_bucket, key: sts.resource_uri };
}

/** Étape 1 — image_to_model haute fidélité (textures HD + géométrie Ultra si H3). */
export async function tripoCreateImageToModelTask(params: {
  bucket: string;
  key: string;
}): Promise<{ task_id: string }> {
  const modelVersion = getTripoModelVersion();
  return tripoRequest<{ task_id: string }>("/task", {
    method: "POST",
    body: JSON.stringify(
      buildHighQualityImageToModelBody(
        tripoFileFromStsObject(params.bucket, params.key),
        modelVersion
      )
    ),
  });
}

/** Étape 1 (secours) — image hébergée via URL publique. */
export async function tripoCreateImageToModelTaskFromUrl(params: {
  imageUrl: string;
  format: "jpeg" | "png" | "webp";
}): Promise<{ task_id: string }> {
  const modelVersion = getTripoModelVersion();
  return tripoRequest<{ task_id: string }>("/task", {
    method: "POST",
    body: JSON.stringify(
      buildHighQualityImageToModelBody(
        tripoFileFromUrl(params.imageUrl, params.format),
        modelVersion
      )
    ),
  });
}

/**
 * Étape 2a — refine_model : affine le brouillon image_to_model (comme le bouton « Refine » du site).
 * Paramètre unique requis : draft_model_task_id (tâche image_to_model terminée avec succès).
 */
export async function tripoCreateRefineModelTask(draftModelTaskId: string): Promise<{ task_id: string }> {
  return tripoRequest<{ task_id: string }>("/task", {
    method: "POST",
    body: JSON.stringify({
      type: "refine_model",
      draft_model_task_id: draftModelTaskId,
    }),
  });
}

/**
 * Étape 2b (secours) — texture_model : régénère textures HD + PBR si refine_model n’est pas supporté.
 */
export async function tripoCreateTextureEnhancementTask(originalModelTaskId: string): Promise<{ task_id: string }> {
  return tripoRequest<{ task_id: string }>("/task", {
    method: "POST",
    body: JSON.stringify({
      type: "texture_model",
      original_model_task_id: originalModelTaskId,
      texture: true,
      pbr: true,
      texture_quality: "detailed",
      texture_alignment: "original_image",
    }),
  });
}

export function tripoIsDraftGenerationTask(task: TripoTask): boolean {
  return task.type === "image_to_model";
}

export function tripoIsPostProcessTask(task: TripoTask): boolean {
  return task.type === "refine_model" || task.type === "texture_model";
}

/** Progression UI sur deux étapes (génération ~45 %, affinage ~55 %). */
export function tripoMapPipelineProgress(task: TripoTask): number {
  const raw = Math.max(0, Math.min(100, task.progress ?? 0));
  if (tripoIsDraftGenerationTask(task)) return Math.round(raw * 0.45);
  if (tripoIsPostProcessTask(task)) return 45 + Math.round(raw * 0.55);
  return raw;
}

export async function tripoGetTask(taskId: string): Promise<TripoTask> {
  return tripoRequest<TripoTask>(`/task/${taskId}`, { method: "GET" });
}

function resolveTripoUrl(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith("http")) return value;
  if (value && typeof value === "object" && "url" in value) {
    const u = (value as { url?: unknown }).url;
    if (typeof u === "string" && u.startsWith("http")) return u;
  }
  return null;
}

/**
 * Extrait l’URL du .glb texturé PBR depuis la réponse Tripo.
 * Ne jamais prendre base_model (mesh sans textures = rendu « affreux »).
 */
export function tripoExtractTexturedGlbUrl(output: Record<string, unknown>): string | null {
  const priorityKeys = ["pbr_model", "model", "textured_model"];

  for (const key of priorityKeys) {
    const url = resolveTripoUrl(output[key]);
    if (url && url.includes(".glb")) return url;
  }

  for (const value of Object.values(output)) {
    const url = resolveTripoUrl(value);
    if (url && url.includes(".glb") && !url.toLowerCase().includes("base")) return url;
  }

  return null;
}

/** Polling serveur (intervalle 5 s) jusqu’à succès ou échec. */
export async function tripoPollTaskUntilDone(
  taskId: string,
  options?: {
    intervalMs?: number;
    maxWaitMs?: number;
    onProgress?: (progress: number, status: TripoTaskStatus) => void;
  }
): Promise<TripoTask> {
  const intervalMs = options?.intervalMs ?? 5000;
  const maxWaitMs = options?.maxWaitMs ?? 20 * 60 * 1000;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const task = await tripoGetTask(taskId);
    options?.onProgress?.(tripoMapPipelineProgress(task), task.status);

    if (task.status === "success") return task;
    if (
      task.status === "failed" ||
      task.status === "banned" ||
      task.status === "expired" ||
      task.status === "cancelled"
    ) {
      throw new Error(`Génération Tripo3D échouée (${task.status}).`);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Délai dépassé : la génération 3D prend plus de temps que prévu. Réessayez plus tard.");
}
