"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Droplets, Thermometer } from "lucide-react";
import type { DashboardHygieneTaskItem } from "@/lib/dashboard/hygieneTileTypes";
import { uiCard } from "@/components/ui/premium";

type Props = {
  score: number;
  scoreDetail: string;
  tasks: DashboardHygieneTaskItem[];
};

function scoreRingColor(score: number): string {
  if (score >= 80) return "#059669";
  if (score >= 50) return "#d97706";
  return "#e11d48";
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score));
  const offset = circumference - (progress / 100) * circumference;
  const color = scoreRingColor(score);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums leading-none text-stone-900">{score}</span>
        <span className="mt-0.5 text-[10px] font-medium text-stone-500">/ 100</span>
      </div>
    </div>
  );
}

export function DashboardHygieneTile({ score, scoreDetail, tasks }: Props) {
  const [expanded, setExpanded] = useState(false);
  const pendingCount = tasks.length;

  return (
    <section className={`${uiCard} overflow-hidden p-0`} aria-label="Hygiène et HACCP">
      <button
        type="button"
        className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-stone-50/80 sm:p-5"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <ScoreRing score={score} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Hygiène & HACCP</p>
          <p className="mt-1 text-sm font-semibold text-stone-900">
            {pendingCount > 0
              ? `${pendingCount} tâche${pendingCount > 1 ? "s" : ""} à faire`
              : "Aucune tâche en attente"}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{scoreDetail}</p>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          {pendingCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
              {pendingCount}
            </span>
          ) : null}
          <ChevronDown
            className={`h-5 w-5 text-stone-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3 sm:px-5">
          {tasks.length === 0 ? (
            <p className="py-2 text-sm text-stone-600">Nettoyage et relevés de température à jour.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((task) => {
                const Icon = task.kind === "temperature" ? Thermometer : Droplets;
                return (
                  <li key={`${task.kind}-${task.id}`}>
                    <Link
                      href={task.href}
                      className={`flex items-start gap-3 rounded-xl border bg-white px-3 py-2.5 transition hover:border-copper-200 hover:shadow-sm ${
                        task.overdue ? "border-rose-200" : "border-stone-100"
                      }`}
                    >
                      <div
                        className={`mt-0.5 rounded-lg p-1.5 ${
                          task.kind === "temperature" ? "bg-sky-50 text-sky-700" : "bg-copper-50 text-copper-800"
                        }`}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-900">{task.title}</p>
                        <p className="text-xs text-stone-500">
                          {task.subtitle}
                          {task.subtitle ? " · " : ""}
                          {task.dueLabel}
                        </p>
                      </div>
                      {task.riskLabel ? (
                        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-700">
                          {task.riskLabel}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
            <Link href="/hygiene/a-faire" className="text-copper-800 underline decoration-copper-300 underline-offset-2">
              Nettoyage à faire
            </Link>
            <Link
              href="/hygiene/haccp/check"
              className="text-copper-800 underline decoration-copper-300 underline-offset-2"
            >
              Relevés température
            </Link>
            <Link href="/hygiene" className="text-stone-600 underline decoration-stone-300 underline-offset-2">
              Module hygiène
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
