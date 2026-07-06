import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getConsumerProfileByUserId } from "@/lib/public/consumer/consumerDb";
import { ConsumerLoginForm } from "@/components/public/consumer/ConsumerLoginForm";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function ConsumerLoginPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  const { next } = await searchParams;
  const nextUrl =
    typeof next === "string" && next.startsWith("/") && !next.includes("//") ? next : "/compte";

  if (user) {
    const profile = await getConsumerProfileByUserId(user.id, user.email ?? null);
    if (profile?.first_name) redirect(nextUrl);
  }

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
        Vous êtes restaurateur ?{" "}
        <Link href="/login" className="font-semibold text-slate-700 hover:text-slate-900">
          Espace pro
        </Link>
      </p>
    </div>
  );
}
