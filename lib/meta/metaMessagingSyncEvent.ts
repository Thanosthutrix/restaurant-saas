/** Événement navigateur émis après une sync Meta DM réussie (bot + inbox). */
export const META_MESSAGING_SYNCED_EVENT = "ubion:meta-messaging-synced";

export function dispatchMetaMessagingSynced(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(META_MESSAGING_SYNCED_EVENT));
}
