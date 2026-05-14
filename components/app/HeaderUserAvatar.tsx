"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateMyStaffColorAction } from "@/app/equipe/actions";
import {
  STAFF_COLOR_HEX,
  STAFF_COLOR_LABELS,
  resolveStaffColorIndex,
} from "@/lib/staff/staffColors";
import type { AppShellHeaderBootstrap } from "@/lib/app/shellHeaderBootstrap";

type Props = {
  profile: NonNullable<AppShellHeaderBootstrap["userProfile"]>;
  /** Index de couleurs déjà pris par les autres membres du restaurant (pour le picker). */
  usedColorIndexes: number[];
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function HeaderUserAvatar({ profile, usedColorIndexes }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Couleur effective (peut changer après sélection)
  const [colorIndex, setColorIndex] = useState<number | null>(profile.colorIndex);
  const effectiveIndex = resolveStaffColorIndex(
    profile.staffMemberId ?? "__owner__",
    colorIndex,
    profile.staffMemberId ? [profile.staffMemberId] : []
  );
  const hex = STAFF_COLOR_HEX[effectiveIndex] ?? "#6366f1";
  const initials = getInitials(profile.displayName);

  // Fermer au clic extérieur
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function pickColor(idx: number) {
    if (!profile.staffMemberId || !profile.restaurantId) return;
    if (idx === colorIndex) { setOpen(false); return; }
    start(async () => {
      const r = await updateMyStaffColorAction(profile.restaurantId!, idx);
      if (r.ok) setColorIndex(idx);
      setOpen(false);
    });
  }

  return (
    <div ref={ref} className="relative">
      {/* Avatar bouton */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-slate-100 active:scale-[0.97]"
        aria-label={`Profil de ${profile.displayName}`}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm"
          style={{ backgroundColor: hex }}
        >
          {initials}
        </span>
        <span className="hidden max-w-[120px] truncate text-sm font-medium text-slate-700 sm:block">
          {profile.displayName}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-[60] mt-1.5 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
          {/* Nom */}
          <div className="mb-3 flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow"
              style={{ backgroundColor: hex }}
            >
              {initials}
            </span>
            <span className="text-sm font-semibold text-slate-800 leading-tight">
              {profile.displayName}
            </span>
          </div>

          {/* Sélecteur de couleur (collaborateurs uniquement) */}
          {profile.staffMemberId ? (
            <>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Ma couleur dans le planning
              </p>
              <div className="grid grid-cols-5 gap-2">
                {STAFF_COLOR_HEX.map((h, idx) => {
                  const isMe = idx === effectiveIndex;
                  const takenByOther = usedColorIndexes.includes(idx) && !isMe;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={pending || takenByOther}
                      title={
                        takenByOther
                          ? `${STAFF_COLOR_LABELS[idx]} (déjà utilisé)`
                          : STAFF_COLOR_LABELS[idx]
                      }
                      onClick={() => pickColor(idx)}
                      className="relative flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-30"
                      style={{ backgroundColor: h }}
                      aria-pressed={isMe}
                    >
                      {isMe && (
                        <svg className="h-4 w-4 text-white" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] text-slate-400">
                Les couleurs grisées sont déjà utilisées par vos collègues.
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500">Vous êtes propriétaire de cet établissement.</p>
          )}
        </div>
      )}
    </div>
  );
}
