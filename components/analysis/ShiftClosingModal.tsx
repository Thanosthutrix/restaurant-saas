"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import {
  fetchShiftClosingQuestionsAction,
  submitShiftClosingFeedbackAction,
  type ShiftFeedbackAnswer,
} from "@/app/analysis/actions";
import { QuestionCard, type QuestionAnswer } from "@/components/analysis/QuestionCard";
import { ModalOverlay } from "@/components/ui/ModalOverlay";
import { uiBtnSecondary, uiLead, uiMuted } from "@/components/ui/premium";
import type { SelectedShiftQuestion } from "@/lib/analysis/types";

type Props = {
  open: boolean;
  restaurantId: string;
  serviceId: string;
  onClose: () => void;
  onComplete?: () => void;
};

export function ShiftClosingModal({ open, restaurantId, serviceId, onClose, onComplete }: Props) {
  const [questions, setQuestions] = useState<SelectedShiftQuestion[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<ShiftFeedbackAnswer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchShiftClosingQuestionsAction({ restaurantId, serviceId });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setQuestions([]);
      return;
    }
    setQuestions(res.data?.questions ?? []);
    setStepIndex(0);
    setAnswers([]);
  }, [restaurantId, serviceId]);

  useEffect(() => {
    if (!open) return;
    void loadQuestions();
  }, [open, loadQuestions]);

  if (!open) return null;

  const current = questions[stepIndex] ?? null;
  const totalSteps = Math.max(questions.length, 1);
  const progressPct = questions.length > 0 ? Math.round(((stepIndex + 1) / totalSteps) * 100) : 0;

  const finish = (finalAnswers: ShiftFeedbackAnswer[]) => {
    startTransition(async () => {
      const res = await submitShiftClosingFeedbackAction({
        restaurantId,
        serviceId,
        answers: finalAnswers,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onComplete?.();
      onClose();
    });
  };

  const handleAnswer = (payload: QuestionAnswer) => {
    if (!current) return;
    const entry: ShiftFeedbackAnswer = {
      templateId: current.templateId,
      templateKey: current.templateKey,
      category: current.category,
      contextKey: current.contextKey,
      responsePayload: payload,
    };
    const nextAnswers = [...answers, entry];
    setAnswers(nextAnswers);

    if (stepIndex + 1 >= questions.length) {
      finish(nextAnswers);
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const skipAll = () => {
    onClose();
  };

  return (
    <ModalOverlay onClose={skipAll} ariaLabel="Micro-sondage clôture de service">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-stone-200/80 bg-gradient-to-b from-white to-stone-50 shadow-2xl">
        {/* Barre de progression type Story */}
        <div className="flex gap-1 px-3 pt-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-copper-600 transition-all duration-300"
                style={{ width: i < stepIndex ? "100%" : i === stepIndex ? `${progressPct}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        <div className="px-5 pb-5 pt-4">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-copper-50 text-copper-700">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-stone-900">Retour terrain</p>
              <p className={uiMuted}>Anonyme · {stepIndex + 1}/{questions.length || "…"} · ~20 sec</p>
            </div>
          </div>

          {loading ? (
            <p className={uiLead}>Préparation des questions…</p>
          ) : error ? (
            <div className="space-y-3">
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {error}
              </p>
              <button type="button" className={uiBtnSecondary} onClick={skipAll}>
                Fermer
              </button>
            </div>
          ) : !current ? (
            <div className="space-y-3">
              <p className={uiLead}>Aucune question pour ce service.</p>
              <button type="button" className={uiBtnSecondary} onClick={skipAll}>
                Fermer
              </button>
            </div>
          ) : (
            <>
              <p className="mb-5 text-lg font-semibold leading-snug text-stone-900">{current.prompt}</p>
              <QuestionCard question={current} onAnswer={handleAnswer} disabled={pending} />
              <button
                type="button"
                className="mt-4 w-full text-center text-xs font-medium text-stone-400 hover:text-stone-600"
                onClick={skipAll}
                disabled={pending}
              >
                Passer
              </button>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
