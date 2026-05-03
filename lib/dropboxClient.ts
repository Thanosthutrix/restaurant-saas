/**
 * Envoi de fichiers vers un compte Dropbox (OAuth2 refresh token).
 * Variables : DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN.
 * Optionnel : DROPBOX_UPLOAD_PATH_PREFIX (défaut « /Factures fournisseurs comptable »).
 */

export function isDropboxExportConfigured(): boolean {
  return Boolean(
    process.env.DROPBOX_APP_KEY?.trim() &&
      process.env.DROPBOX_APP_SECRET?.trim() &&
      process.env.DROPBOX_REFRESH_TOKEN?.trim()
  );
}

async function refreshDropboxAccessToken(): Promise<string> {
  const clientId = process.env.DROPBOX_APP_KEY?.trim();
  const clientSecret = process.env.DROPBOX_APP_SECRET?.trim();
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Dropbox : variables DROPBOX_APP_KEY, DROPBOX_APP_SECRET ou DROPBOX_REFRESH_TOKEN manquantes.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Dropbox (jeton) : ${res.status} — ${t.slice(0, 400)}`);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Dropbox : réponse jeton invalide.");
  return json.access_token;
}

export type DropboxUploadResult = {
  path_display: string;
};

/**
 * Upload binaire vers `dropboxPath` (chemin absolu Dropbox, ex. /Dossier/fichier.pdf).
 */
export async function uploadBytesToDropbox(params: {
  dropboxPath: string;
  bytes: Uint8Array;
}): Promise<DropboxUploadResult> {
  const accessToken = await refreshDropboxAccessToken();
  const apiArg = {
    path: params.dropboxPath,
    mode: "add",
    autorename: true,
    mute: false,
    strict_conflict: false,
  };

  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify(apiArg),
    },
    body: Buffer.from(params.bytes),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Dropbox (upload) : ${res.status} — ${t.slice(0, 400)}`);
  }

  const meta = (await res.json()) as { path_display?: string; path_lower?: string };
  const path_display = meta.path_display ?? meta.path_lower ?? params.dropboxPath;
  return { path_display };
}

export function defaultDropboxUploadRoot(): string {
  const raw = process.env.DROPBOX_UPLOAD_PATH_PREFIX?.trim();
  if (raw && raw.startsWith("/")) return raw.replace(/\/+$/, "") || "/Factures fournisseurs comptable";
  return "/Factures fournisseurs comptable";
}

export function sanitizeDropboxPathSegment(s: string, maxLen = 72): string {
  const t = s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maxLen);
  return t.length > 0 ? t : "fichier";
}

export function extensionFromFileName(fileName: string | null): string {
  if (!fileName || !fileName.includes(".")) return ".pdf";
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/i.test(ext) ? ext : ".pdf";
}
