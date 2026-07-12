"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/pocket/expenseCategories";
import { setInvoiceExpenseCategoryAction } from "./actions";

/** Correction du poste comptable d'une facture (classement IA imparfait). */
export function InvoiceCategorySelect({
  restaurantId,
  invoiceId,
  current,
}: {
  restaurantId: string;
  invoiceId: string;
  current: ExpenseCategory;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  return (
    <select
      value={current}
      disabled={pending}
      title={error ? "Échec de la mise à jour" : "Poste comptable"}
      onChange={(e) => {
        const category = e.target.value;
        setError(false);
        startTransition(async () => {
          const res = await setInvoiceExpenseCategoryAction({ restaurantId, invoiceId, category });
          if (!res.ok) {
            setError(true);
            return;
          }
          router.refresh();
        });
      }}
      className={`rounded-lg border bg-white px-1.5 py-1 text-xs text-stone-600 disabled:opacity-50 ${
        error ? "border-rose-300" : "border-stone-200"
      }`}
    >
      {EXPENSE_CATEGORIES.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
