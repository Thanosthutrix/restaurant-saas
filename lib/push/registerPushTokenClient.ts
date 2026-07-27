"use client";

import { createClient } from "@/lib/supabase/client";
import { isNativeApp } from "@/lib/capacitor/platform";

const STORAGE_KEY = "ubion_pending_push_token";

type PendingPushToken = {
  token: string;
  platform: "ios" | "android";
};

function readPendingToken(): PendingPushToken | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPushToken;
    if (
      (parsed.platform === "ios" || parsed.platform === "android") &&
      typeof parsed.token === "string" &&
      parsed.token.length >= 8
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writePendingToken(token: PendingPushToken): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(token));
}

function clearPendingToken(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Envoie le token push au serveur (cookies session + Bearer Supabase). */
export async function sendPushTokenToServer(
  token: string,
  platform: "ios" | "android"
): Promise<boolean> {
  if (!token || token.length < 8) return false;

  writePendingToken({ token, platform });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      headers.Authorization = `Bearer ${data.session.access_token}`;
    }
  } catch {
    /* session optionnelle */
  }

  try {
    const res = await fetch("/api/push/register", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ token, platform }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (res.ok && json.ok) {
      clearPendingToken();
      return true;
    }
    console.warn("[ubion push] register API:", json.error ?? res.status);
  } catch (error) {
    console.warn("[ubion push] register API failed", error);
  }

  return false;
}

/** Réessaie l'enregistrement si un token était en attente (ex. après connexion). */
export async function retryPendingPushRegistration(): Promise<void> {
  if (!isNativeApp()) return;
  const pending = readPendingToken();
  if (!pending) return;
  await sendPushTokenToServer(pending.token, pending.platform);
}
