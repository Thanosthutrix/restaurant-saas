"use client";

import { useState } from "react";
import { deleteRestaurantForever, deleteUserAccountForever } from "./actions";
import { uiError, uiFormLabel, uiInputBlock } from "@/components/ui/premium";

const CONFIRM_RESTAURANT = "SUPPRIMER";
const CONFIRM_ACCOUNT = "SUPPRIMER MON COMPTE";

export function AccountDangerZones({
  restaurants,
}: {
  restaurants: { id: string; name: string }[];
}) {
  const [restaurantConfirm, setRestaurantConfirm] = useState("");
  const [accountConfirm, setAccountConfirm] = useState("");
  const [targetRestaurantId, setTargetRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [errorR, setErrorR] = useState<string | null>(null);
  const [errorA, setErrorA] = useState<string | null>(null);
  const [loadingR, setLoadingR] = useState(false);
  const [loadingA, setLoadingA] = useState(false);

  async function submitDeleteRestaurant(e: React.FormEvent) {
    e.preventDefault();
    setErrorR(null);
    if (!targetRestaurantId) {
      setErrorR("Aucun établissement à supprimer.");
      return;
    }
    setLoadingR(true);
    const result = await deleteRestaurantForever(targetRestaurantId, restaurantConfirm);
    setLoadingR(false);
    if (result && "ok" in result && !result.ok) setErrorR(result.error);
  }

  async function submitDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setErrorA(null);
    setLoadingA(true);
    const result = await deleteUserAccountForever(accountConfirm);
    setLoadingA(false);
    if (result && "ok" in result && !result.ok) setErrorA(result.error);
  }

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-amber-200/90 bg-amber-50/40 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-amber-950">Supprimer un établissement</h2>
        <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
          Toutes les données de l&apos;établissement (stock, plats, services, commandes, factures liées…) seront effacées
          de façon définitive. Les autres établissements de votre compte ne sont pas concernés.
        </p>
        {restaurants.length === 0 ? (
          <p className="mt-3 text-sm text-amber-900">Aucun établissement.</p>
        ) : (
          <form onSubmit={submitDeleteRestaurant} className="mt-4 space-y-3">
            {errorR ? <p className={uiError}>{errorR}</p> : null}
            <div>
              <label htmlFor="which-restaurant" className={uiFormLabel}>
                Établissement
              </label>
              <select
                id="which-restaurant"
                value={targetRestaurantId}
                onChange={(e) => setTargetRestaurantId(e.target.value)}
                className={uiInputBlock}
              >
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="confirm-r" className={uiFormLabel}>
                Confirmation (tapez {CONFIRM_RESTAURANT})
              </label>
              <input
                id="confirm-r"
                type="text"
                value={restaurantConfirm}
                onChange={(e) => setRestaurantConfirm(e.target.value)}
                autoComplete="off"
                className={uiInputBlock}
                placeholder={CONFIRM_RESTAURANT}
              />
            </div>
            <button
              type="submit"
              disabled={loadingR}
              className="w-full rounded-xl border border-amber-700/40 bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 disabled:opacity-50"
            >
              {loadingR ? "Suppression…" : "Supprimer cet établissement définitivement"}
            </button>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-rose-950">Supprimer mon compte</h2>
        <p className="mt-1 text-xs leading-relaxed text-rose-900/90">
          Tous vos établissements et toutes les données associées seront supprimés. Votre compte (e-mail) sera retiré
          de l&apos;application. Cette action est irréversible.
        </p>
        <form onSubmit={submitDeleteAccount} className="mt-4 space-y-3">
          {errorA ? <p className={uiError}>{errorA}</p> : null}
          <div>
            <label htmlFor="confirm-a" className={uiFormLabel}>
              Confirmation (tapez {CONFIRM_ACCOUNT})
            </label>
            <input
              id="confirm-a"
              type="text"
              value={accountConfirm}
              onChange={(e) => setAccountConfirm(e.target.value)}
              autoComplete="off"
              className={uiInputBlock}
              placeholder={CONFIRM_ACCOUNT}
            />
          </div>
          <button
            type="submit"
            disabled={loadingA}
            className="w-full rounded-xl border border-rose-400 bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50"
          >
            {loadingA ? "Suppression du compte…" : "Supprimer mon compte et toutes mes données"}
          </button>
        </form>
      </section>
    </div>
  );
}
