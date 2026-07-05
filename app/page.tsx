import Link from "next/link";
import { BrandLogo } from "@/components/app/BrandLogo";
import { uiBtnPrimary, uiBtnSecondary } from "@/components/ui/premium";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
      <main className="flex w-full max-w-md flex-col items-center gap-10 py-20">
        <div className="flex flex-col items-center text-center">
          <h1 className="sr-only">ubion</h1>
          <BrandLogo role="img" aria-label="ubion" className="h-28 w-28" />
          <p className="mt-4 text-sm leading-relaxed text-stone-600">
            Services, plats, stock, fournisseurs et indicateurs — au même endroit.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Link href="/login" className={`${uiBtnPrimary} flex h-12 items-center justify-center`}>
            Se connecter
          </Link>
          <Link href="/signup" className={`${uiBtnSecondary} flex h-12 items-center justify-center`}>
            Créer un compte
          </Link>
        </div>
      </main>
    </div>
  );
}
