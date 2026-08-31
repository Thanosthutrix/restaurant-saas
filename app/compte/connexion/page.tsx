import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getConsumerProfileByUserId } from "@/lib/public/consumer/consumerDb";
import { ConsumerLoginForm } from "@/components/public/consumer/ConsumerLoginForm";

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

const CONSUMER_LOGIN_ERRORS: Record<string, string> = {
  oauth_echec: "La connexion Google ou Apple a échoué. Réessayez ou utilisez votre e-mail.",
  session_echec: "La connexion a échoué. Réessayez.",
  lien_invalide: "Ce lien n'est plus valide.",
};

export default async function ConsumerLoginPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  const { next, error } = await searchParams;
  const nextUrl =
    typeof next === "string" && next.startsWith("/") && !next.includes("//") ? next : "/compte";

  if (user) {
    const profile = await getConsumerProfileByUserId(user.id, user.email ?? null);
    if (profile?.first_name) redirect(nextUrl);
  }

  const bannerError =
    error && typeof error === "string" && CONSUMER_LOGIN_ERRORS[error] ? CONSUMER_LOGIN_ERRORS[error] : null;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-700">
          ← Retour à l&apos;annuaire
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Connexion</h1>
        <p className="mt-2 text-sm text-slate-600">Accédez à vos réservations et à votre historique.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {bannerError ? (
          <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {bannerError}
          </p>
        ) : null}
        <ConsumerLoginForm nextUrl={nextUrl} />
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        Pas encore de compte ?{" "}
        <Link
          href={`/compte/inscription${next !== "/compte" ? `?next=${encodeURIComponent(nextUrl)}` : ""}`}
          className="font-semibold text-orange-600 hover:text-orange-700"
        >
          Créer un compte
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-slate-500">
        Si vous êtes pro ?{" "}
        <Link href="/login" className="font-semibold text-slate-700 hover:text-slate-900">
          Accéder à l&apos;espace restaurateur
        </Link>
      </p>
    </div>
  );
}
