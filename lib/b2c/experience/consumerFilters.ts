import type { ConsumerSearchPreferences } from "./consumerPreferencesDb";
import type { ExperienceProfileForMatching } from "./matching";
import { priceTierAtLeast, priceTierAtMost } from "./taxonomy";

/** Filtre strict selon les exclusions / budget du compte client. */
export function passesConsumerPreferences(
  profile: ExperienceProfileForMatching,
  prefs: ConsumerSearchPreferences | null | undefined
): boolean {
  if (!prefs) return true;

  if (prefs.excluded_establishment_types.includes(profile.establishment_type)) {
    return false;
  }

  if (prefs.min_price_tier && !priceTierAtLeast(profile.price_tier, prefs.min_price_tier)) {
    return false;
  }

  if (prefs.max_price_tier && !priceTierAtMost(profile.price_tier, prefs.max_price_tier)) {
    return false;
  }

  return true;
}

/** Bonus soft si le profil resto correspond aux préférences enregistrées. */
export function consumerPreferenceBoost(
  profile: ExperienceProfileForMatching,
  prefs: ConsumerSearchPreferences | null | undefined
): { bonus: number; reason?: string } {
  if (!prefs) return { bonus: 0 };

  let bonus = 0;
  let reason: string | undefined;

  if (prefs.preferred_noise_level && profile.noise_level === prefs.preferred_noise_level) {
    bonus += 8;
    reason = "Ambiance préférée";
  }

  if (prefs.preferred_occasions.length > 0) {
    const hit = prefs.preferred_occasions.some((o) => profile.occasions.includes(o));
    if (hit) {
      bonus += 10;
      reason = "Correspond à vos habitudes";
    }
  }

  return { bonus, reason };
}
