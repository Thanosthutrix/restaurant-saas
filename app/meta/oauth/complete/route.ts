import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/meta/config";
import { completeMetaOAuthFromCode } from "@/lib/meta/completeOAuth";

export const dynamic = "force-dynamic";

function revalidateSocialPaths(restaurantId: string) {
  revalidatePath(`/restaurants/${restaurantId}/edit`);
  revalidatePath(`/restaurant/${restaurantId}`);
  revalidatePath("/communication");
  revalidatePath("/");
}

function redirectWithMetaError(message?: string) {
  const url = new URL(`${getAppBaseUrl()}/communication`);
  url.searchParams.set("meta", "error");
  if (message) url.searchParams.set("meta_msg", message.slice(0, 300));
  return NextResponse.redirect(url.toString());
}

/** Retour OAuth Meta : flux code (?code=) côté serveur + fallback client (code ou #jeton). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const oauthErrorDescription = url.searchParams.get("error_description");

  if (oauthError) {
    return redirectWithMetaError(oauthErrorDescription ?? oauthError);
  }

  if (code && state) {
    const result = await completeMetaOAuthFromCode({ code, state });
    if (result.ok) {
      revalidateSocialPaths(result.restaurantId);
      return NextResponse.redirect(`${getAppBaseUrl()}/communication?meta=connected`);
    }
    console.error("[meta/oauth/complete]", result.error);
    return redirectWithMetaError(result.error);
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Connexion Meta…</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; color: #44403c; }
    p { max-width: 28rem; text-align: center; padding: 1rem; font-size: 0.875rem; line-height: 1.5; }
  </style>
</head>
<body>
  <p id="msg">Finalisation de la connexion Meta…</p>
  <script>
    (function () {
      var msg = document.getElementById("msg");
      var hash = window.location.hash.charAt(0) === "#" ? window.location.hash.slice(1) : window.location.hash;
      var hashParams = new URLSearchParams(hash);
      var qs = new URLSearchParams(window.location.search);
      var state = qs.get("state") || hashParams.get("state") || "";
      var code = qs.get("code") || hashParams.get("code");
      var token = hashParams.get("long_lived_token") || hashParams.get("access_token");

      function finish(data) {
        if (data.ok && data.restaurantId) {
          window.location.replace("/communication?meta=connected");
          return;
        }
        msg.textContent = data.error || "Erreur lors de la connexion Meta.";
      }

      function fail(text) {
        msg.textContent = text;
      }

      var err =
        qs.get("error_description") ||
        qs.get("error") ||
        hashParams.get("error_description") ||
        hashParams.get("error");
      if (err) {
        fail("Connexion Meta refusée : " + err);
        return;
      }

      if (code && state) {
        fetch("/api/meta/oauth/complete-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code: code, state: state }),
        })
          .then(function (r) { return r.json(); })
          .then(finish)
          .catch(function (e) {
            fail("Erreur réseau : " + (e && e.message ? e.message : "inconnue"));
          });
        return;
      }

      if (token && state) {
        fetch("/api/meta/oauth/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ state: state, accessToken: token }),
        })
          .then(function (r) { return r.json(); })
          .then(finish)
          .catch(function (e) {
            fail("Erreur réseau : " + (e && e.message ? e.message : "inconnue"));
          });
        return;
      }

      if (code && !state) {
        fail("Session OAuth expirée. Relancez « Connecter Facebook / Instagram » depuis Communication.");
        return;
      }

      fail(
        "Paramètres Meta manquants. Relancez « Connecter Facebook / Instagram » depuis Communication (ne rechargez pas cette page)."
      );
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
