/**
 * Rate limiter en mémoire (fenêtre fixe), keyé par IP ou par utilisateur.
 *
 * Limite : l'état vit dans le process. En serverless (Vercel), chaque instance « chaude »
 * a son propre compteur — c'est donc une protection contre les rafales/abus depuis une
 * source, pas une garantie globale stricte. Pour un plafond global dur, adosser à Redis/DB.
 * Suffisant ici pour éviter qu'un visiteur non authentifié fasse cramer le crédit
 * OpenAI / le quota de géocodage.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

function purgeExpired(now: number): void {
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

/**
 * Autorise jusqu'à `limit` appels par fenêtre de `windowMs` pour une `key` donnée.
 * Retourne `{ ok: false, retryAfterSec }` quand la limite est dépassée.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now >= b.resetAt) {
    if (buckets.size >= MAX_KEYS) purgeExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }

  b.count += 1;
  return { ok: true };
}

/** Extrait l'IP client depuis les en-têtes de proxy (Vercel/Next). */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
