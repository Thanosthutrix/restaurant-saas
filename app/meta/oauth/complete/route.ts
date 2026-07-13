import { NextResponse } from "next/server";

/** Page HTML minimale — lit le fragment # immédiatement (flux Business Login Meta). */
export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Connexion Meta…</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; color: #44403c; }
    p { max-width: 24rem; text-align: center; padding: 1rem; font-size: 0.875rem; line-height: 1.5; }
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
      var token = hashParams.get("long_lived_token") || hashParams.get("access_token");
      if (!token) {
        var err = qs.get("error_description") || qs.get("error") || hashParams.get("error_description") || hashParams.get("error");
        msg.textContent = err
          ? "Connexion Meta refusée : " + err
          : "Jeton manquant. Relancez « Connecter Facebook / Instagram » depuis Modifier le restaurant (ne rechargez pas cette page).";
        return;
      }
      fetch("/api/meta/oauth/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ state: state, accessToken: token }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok && data.restaurantId) {
            window.location.replace("/restaurants/" + data.restaurantId + "/edit?meta=connected");
            return;
          }
          msg.textContent = data.error || "Erreur lors de la connexion Meta.";
        })
        .catch(function (e) {
          msg.textContent = "Erreur réseau : " + (e && e.message ? e.message : "inconnue");
        });
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
