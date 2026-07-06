import "server-only";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  flatten,
  join,
  meshopt,
  prune,
  reorder,
  simplify,
  textureCompress,
  weld,
} from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { DISH_AR_SUPABASE_MAX_BYTES, type GlbOptimizePass } from "@/lib/dishes/dishArShared";

export type { GlbOptimizePass };

type PassConfig = {
  texSize: number;
  jpegQuality: number;
  meshLevel: "medium" | "high";
  /** Ratio de sommets conservés (1 = intact). */
  simplifyRatio?: number;
  simplifyError?: number;
};

const PASS_CONFIGS: Record<GlbOptimizePass, PassConfig> = {
  light: { texSize: 2048, jpegQuality: 88, meshLevel: "medium" },
  medium: { texSize: 1536, jpegQuality: 85, meshLevel: "high", simplifyRatio: 0.88, simplifyError: 0.0005 },
  strong: { texSize: 1024, jpegQuality: 82, meshLevel: "high", simplifyRatio: 0.72, simplifyError: 0.001 },
  extreme: { texSize: 768, jpegQuality: 76, meshLevel: "high", simplifyRatio: 0.52, simplifyError: 0.005 },
  ultra: { texSize: 512, jpegQuality: 68, meshLevel: "high", simplifyRatio: 0.35, simplifyError: 0.02 },
};

let meshoptReady: Promise<void> | null = null;

async function ensureMeshoptReady() {
  if (!meshoptReady) {
    meshoptReady = Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]).then(() => undefined);
  }
  await meshoptReady;
}

/** Compresse un .glb Tripo pour Supabase (< 50 Mo) — passes progressives. */
export async function optimizeGlbForSupabase(
  input: Uint8Array,
  pass: GlbOptimizePass
): Promise<Uint8Array> {
  await ensureMeshoptReady();

  const cfg = PASS_CONFIGS[pass];
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.readBinary(input);

  const transforms = [
    dedup(),
    weld(),
    join(),
    flatten(),
  ] as Parameters<typeof document.transform>;

  if (cfg.simplifyRatio != null) {
    transforms.push(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: cfg.simplifyRatio,
        error: cfg.simplifyError ?? 0.001,
      })
    );
  }

  transforms.push(
    reorder({ encoder: MeshoptEncoder }),
    meshopt({ encoder: MeshoptEncoder, level: cfg.meshLevel }),
    textureCompress({
      encoder: sharp,
      targetFormat: "jpeg",
      resize: [cfg.texSize, cfg.texSize],
      quality: cfg.jpegQuality,
    }),
    prune()
  );

  await document.transform(...transforms);

  const out = await io.writeBinary(document);
  return new Uint8Array(out);
}

/** Tente plusieurs passes jusqu’à tenir dans la limite Supabase Free. */
export async function shrinkGlbToSupabaseLimit(original: Uint8Array): Promise<{
  bytes: Uint8Array;
  pass: GlbOptimizePass | "none";
  originalBytes: number;
}> {
  if (original.byteLength <= DISH_AR_SUPABASE_MAX_BYTES) {
    return { bytes: original, pass: "none", originalBytes: original.byteLength };
  }

  const order: GlbOptimizePass[] = ["light", "medium", "strong", "extreme", "ultra"];
  let smallest: Uint8Array = original;
  let smallestPass: GlbOptimizePass | "none" = "none";

  for (const pass of order) {
    try {
      const optimized = await optimizeGlbForSupabase(original, pass);
      if (optimized.byteLength <= DISH_AR_SUPABASE_MAX_BYTES) {
        return { bytes: optimized, pass, originalBytes: original.byteLength };
      }
      if (optimized.byteLength < smallest.byteLength) {
        smallest = optimized;
        smallestPass = pass;
      }
    } catch {
      // Passe suivante (certaines géométries Tripo peuvent échouer sur join/simplify).
    }
  }

  return { bytes: smallest, pass: smallestPass, originalBytes: original.byteLength };
}
