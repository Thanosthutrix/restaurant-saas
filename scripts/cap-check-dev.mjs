#!/usr/bin/env node
/** Vérifie que Next.js répond avant de lancer l'app Capacitor en local. */
import http from "node:http";

function probe(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode != null && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

const ok = await probe("http://127.0.0.1:3000/");
if (!ok) {
  console.error("");
  console.error("❌ Le serveur Next.js ne répond pas sur http://127.0.0.1:3000");
  console.error("");
  console.error("Dans un autre terminal, depuis restaurant-saas/restaurant-saas :");
  console.error("  npm run dev:lan");
  console.error("");
  console.error("Puis relancez : npm run cap:dev:ios");
  console.error("");
  process.exit(1);
}
