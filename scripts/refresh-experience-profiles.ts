/**
 * Rafraîchissement hebdomadaire des profils expérience B2C.
 * Usage local : npx tsx scripts/refresh-experience-profiles.ts
 * Cron HTTP : GET /api/cron/experience-profiles-refresh (Bearer CRON_SECRET)
 */

import { refreshAllExperienceProfiles } from "@/lib/b2c/experience/refreshProfileAi";

async function main() {
  const result = await refreshAllExperienceProfiles();
  console.log(
    `[refresh-experience-profiles] ${result.ok}/${result.total} profil(s) rafraîchi(s).`
  );
  if (result.errors.length > 0) {
    console.warn(result.errors.slice(0, 10).join("\n"));
    process.exit(result.ok === 0 ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
