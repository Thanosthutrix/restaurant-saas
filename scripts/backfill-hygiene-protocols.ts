/**
 * Script ponctuel : applique les protocoles types aux éléments hygiène existants.
 * Usage : npx tsx scripts/backfill-hygiene-protocols.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { backfillHygieneProtocolPresets } from "../lib/hygiene/backfillProtocolPresets";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    console.warn("⚠ .env.local introuvable — variables d'environnement système utilisées.");
  }
}

loadEnvLocal();

backfillHygieneProtocolPresets()
  .then((r) => {
    if (!r.ok) {
      console.error("Échec :", r.error);
      process.exit(1);
    }
    console.log(`✓ ${r.updated} / ${r.total} élément(s) mis à jour.`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
