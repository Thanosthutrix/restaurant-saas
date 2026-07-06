import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getConsumerProfileByUserId } from "@/lib/public/consumer/consumerDb";
import { ConsumerSignupForm } from "@/components/public/consumer/ConsumerSignupForm";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function ConsumerSignupPage({ searchParams }: Props) {
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
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Créer un compte</h1>
        <p className="mt-2 text-sm text-slate-600">
          Réservez en quelques clics et retrouvez vos restaurants favoris.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <ConsumerSignupForm nextUrl={nextUrl} />
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        Déjà inscrit ?{" "}
        <Link
          href={`/compte/connexion${next !== "/compte" ? `?next=${encodeURIComponent(nextUrl)}` : ""}`}
          className="font-semibold text-orange-600 hover:text-orange-700"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
