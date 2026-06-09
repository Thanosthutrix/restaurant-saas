/**
 * Applique un fichier SQL sur la base Supabase (DDL / migrations).
 * Usage :
 *   npm run db:apply -- supabase/migrations/20260521130000_planning_peak_bands_weekly.sql
 *
 * Prérequis dans `.env.local` :
 *   SUPABASE_DB_URL=postgresql://postgres.[ref]:[MOT_DE_PASSE]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
 * (Dashboard Supabase → Settings → Database → Connection string → URI, mode Session)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

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
    /* ignore */
  }
}

function resolveDbUrl(): string {
  const direct = process.env.SUPABASE_DB_URL?.trim();
  if (direct) return direct;

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const m = publicUrl.match(/^https:\/\/([^.]+)\.supabase\.co\/?$/);
  if (password && m?.[1]) {
    const ref = m[1];
    return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
  }

  throw new Error(
    "Connexion base manquante. Ajoutez SUPABASE_DB_URL (ou SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL) dans `.env.local`.\n" +
      "Dashboard Supabase → Settings → Database → Connection string (URI, Session mode)."
  );
}

async function main() {
  loadEnvLocal();
  const rel = process.argv[2];
  if (!rel) {
    console.error("Usage: npm run db:apply -- <fichier.sql>");
    process.exit(1);
  }

  const sqlPath = resolve(process.cwd(), rel);
  const sql = readFileSync(sqlPath, "utf8");
  const dbUrl = resolveDbUrl();

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log(`✓ Migration appliquée : ${rel}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Échec :", e instanceof Error ? e.message : e);
  process.exit(1);
});
