/** Limite d'attente pour éviter les UI bloquées sur « Analyse en cours… ». */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const MENU_ANALYSIS_CLIENT_TIMEOUT_MS = 150_000;
export const MENU_ANALYSIS_SERVER_ACTION_TIMEOUT_MS = 180_000;

export const MENU_ANALYSIS_TIMEOUT_USER_MESSAGE =
  "L'analyse a pris trop de temps (réseau ou fichier volumineux). Réessayez avec une photo plus légère ou un PDF plus court.";
