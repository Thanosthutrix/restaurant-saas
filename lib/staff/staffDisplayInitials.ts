/**
 * Initiales affichées sur la grille planning (sans résolution des collisions).
 * Deux prénoms seuls « Tom » et « Tonio » donnaient tous deux « TO » → confusion avec les totaux.
 */
export function staffInitialsBase(displayName: string): string {
  const p = displayName.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0]![0]! + p[p.length - 1]![0]!).toUpperCase();
  const w = p[0] ?? "";
  if (w.length <= 1) return `${(w[0] ?? "?").toUpperCase()}?`;
  return w.slice(0, 2).toUpperCase();
}

/**
 * Une initiale par collaborateur ; en cas de collision sur `staffInitialsBase`, on prend
 * 1ʳᵉ + 3ᵉ lettre du premier token (ex. Tom → TM, Tonio → TN), puis un suffixe numérique si besoin.
 */
export function buildStaffInitialsByMemberId(staff: { id: string; display_name: string }[]): Map<string, string> {
  const members = staff.map((m) => ({ id: m.id, name: (m.display_name ?? "").trim() || "?" }));
  const byBase = new Map<string, { id: string; name: string }[]>();
  for (const m of members) {
    const b = staffInitialsBase(m.name);
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b)!.push(m);
  }
  const out = new Map<string, string>();
  for (const group of byBase.values()) {
    if (group.length === 1) {
      const g = group[0]!;
      out.set(g.id, staffInitialsBase(g.name));
      continue;
    }
    const used = new Set<string>();
    for (const m of group) {
      const w = m.name.split(/\s+/)[0] ?? "";
      let cand =
        w.length >= 3 ? (w[0]! + w[2]!).toUpperCase()
        : w.length === 2 ? w.toUpperCase()
        : staffInitialsBase(m.name);
      let n = 0;
      while (used.has(cand) && n < 50) {
        n++;
        cand = `${staffInitialsBase(m.name)}${n}`;
      }
      used.add(cand);
      out.set(m.id, cand);
    }
  }
  return out;
}
