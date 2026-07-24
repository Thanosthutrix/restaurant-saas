#!/usr/bin/env node
/** IP locale du Mac (Wi‑Fi) pour tester Capacitor sur iPhone physique. */
import os from "node:os";

function getLanIpv4() {
  for (const iface of Object.values(os.networkInterfaces())) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return null;
}

const ip = getLanIpv4();
if (!ip) {
  console.error("Impossible de détecter l'IP locale (Wi‑Fi).");
  process.exit(1);
}

process.stdout.write(`http://${ip}:3000`);
