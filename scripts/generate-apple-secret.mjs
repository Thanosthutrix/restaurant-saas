#!/usr/bin/env node
/**
 * Génère le JWT "Secret Key" pour Sign in with Apple (Supabase Auth).
 * Valide ~180 jours — à régénérer tous les 6 mois.
 *
 * Usage:
 *   npm run apple:secret -- --p8 ~/Downloads/AuthKey_XXXX.p8
 *
 * Variables d'environnement (optionnelles):
 *   APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICES_ID, APPLE_P8_PATH
 */

import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";

const DEFAULTS = {
  teamId: "UD4W425386",
  keyId: "K4UGVD72WS",
  servicesId: "fr.ubion.web",
};

function parseArgs(argv) {
  const out = { p8: process.env.APPLE_P8_PATH ?? null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--p8" || arg === "-p") out.p8 = argv[++i];
    else if (arg === "--team") out.teamId = argv[++i];
    else if (arg === "--key-id") out.keyId = argv[++i];
    else if (arg === "--services-id") out.servicesId = argv[++i];
    else if (arg === "--help" || arg === "-h") out.help = true;
  }
  return out;
}

function resolveP8Path(explicit) {
  if (explicit) {
    const expanded = explicit.replace(/^~/, process.env.HOME ?? "");
    return path.resolve(expanded);
  }

  const candidates = [
    process.env.APPLE_P8_PATH,
    path.join(process.env.HOME ?? "", "Downloads", `AuthKey_${DEFAULTS.keyId}.p8`),
    path.join(process.env.HOME ?? "", "Desktop", `AuthKey_${DEFAULTS.keyId}.p8`),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = path.resolve(String(candidate).replace(/^~/, process.env.HOME ?? ""));
    if (fs.existsSync(resolved)) return resolved;
  }

  return null;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`
Génère le secret OAuth Apple pour Supabase.

  npm run apple:secret -- --p8 ~/Downloads/AuthKey_K4UGVD72WS.p8

Options:
  --p8, -p           Chemin vers AuthKey_XXXX.p8 (requis si absent de Downloads)
  --team             Team ID (défaut: ${DEFAULTS.teamId})
  --key-id           Key ID (défaut: ${DEFAULTS.keyId})
  --services-id      Services ID web (défaut: ${DEFAULTS.servicesId})
`);
  process.exit(0);
}

const teamId = args.teamId ?? process.env.APPLE_TEAM_ID ?? DEFAULTS.teamId;
const keyId = args.keyId ?? process.env.APPLE_KEY_ID ?? DEFAULTS.keyId;
const servicesId = args.servicesId ?? process.env.APPLE_SERVICES_ID ?? DEFAULTS.servicesId;
const p8Path = resolveP8Path(args.p8);

if (!p8Path || !fs.existsSync(p8Path)) {
  console.error("❌ Fichier .p8 introuvable.");
  console.error("");
  console.error("Télécharge la clé depuis Apple Developer → Keys, puis lance :");
  console.error(`  npm run apple:secret -- --p8 ~/Downloads/AuthKey_${keyId}.p8`);
  console.error("");
  console.error("Si ton Services ID n'est pas fr.ubion.web :");
  console.error("  npm run apple:secret -- --p8 ~/Downloads/AuthKey_XXX.p8 --services-id TON_SERVICES_ID");
  process.exit(1);
}

const privateKey = fs.readFileSync(p8Path, "utf8");

const token = jwt.sign({}, privateKey, {
  algorithm: "ES256",
  expiresIn: "180d",
  audience: "https://appleid.apple.com",
  issuer: teamId,
  subject: servicesId,
  keyid: keyId,
});

console.log("");
console.log("✅ Secret Apple généré (valide ~180 jours)");
console.log("");
console.log("── Colle ceci dans Supabase → Authentication → Apple → Secret Key ──");
console.log("");
console.log(token);
console.log("");
console.log("── Client IDs (Supabase) ──");
console.log(`${servicesId},fr.ubion.app`);
console.log("");
console.log(`Team ID: ${teamId} | Key ID: ${keyId} | Services ID: ${servicesId}`);
console.log(`Clé lue depuis: ${p8Path}`);
console.log("");
