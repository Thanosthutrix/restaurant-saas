"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { ExperienceProfileModal } from "./ExperienceProfileModal";
import { uiBtnSecondary } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  completed?: boolean;
  variant?: "dashboard" | "edit";
};

export function ExperienceProfileTrigger({ restaurantId, completed, variant = "dashboard" }: Props) {
  const [open, setOpen] = useState(false);

  if (variant === "edit") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${uiBtnSecondary} inline-flex items-center gap-2`}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {completed ? "Mettre à jour mon expérience" : "Décrire mon expérience"}
        </button>
        <ExperienceProfileModal
          restaurantId={restaurantId}
          open={open}
          onClose={() => setOpen(false)}
          onSaved={() => window.location.reload()}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-3 rounded-2xl border border-violet-200/70 bg-gradient-to-r from-violet-50/80 to-white p-4 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 ring-1 ring-violet-200/80">
          <Sparkles className="h-5 w-5 text-violet-700" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-stone-900 group-hover:text-violet-900">
            {completed ? "Mettre à jour mon expérience" : "Décrire mon expérience"}
          </span>
          <span className="mt-0.5 block text-xs text-stone-500">
            Qualifiez votre établissement pour le matching client B2C (type, ambiance, budget).
          </span>
        </span>
      </button>
      <ExperienceProfileModal
        restaurantId={restaurantId}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => window.location.reload()}
      />
    </>
  );
}
