export type WeekPlannerActionResult =
  | { ok: true; id?: string; updated?: number }
  | { ok: false; error: string };

export type WeekPlannerActions = {
  updateShiftTimes: (
    shiftId: string,
    payload: { startsAtLocal: string; endsAtLocal: string }
  ) => Promise<WeekPlannerActionResult>;
  createShift: (payload: {
    staffMemberId: string;
    startsAtLocal: string;
    endsAtLocal: string;
    notes?: string | null;
    breakMinutes?: number | null;
  }) => Promise<WeekPlannerActionResult>;
  deleteShift: (shiftId: string) => Promise<WeekPlannerActionResult>;
  applyWeekDelta?: (weekMondayIso: string) => Promise<WeekPlannerActionResult>;
};
