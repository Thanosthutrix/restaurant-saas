import type { DiningLineClient } from "@/app/salle/commande/diningOrderTypes";
import {
  MEAL_COURSE_ORDER,
  type DiningMealCourse,
  isMealCourse,
  mealCourseLabel,
} from "./courseTypes";

export type DiningCourseSummary = {
  courseType: DiningMealCourse;
  label: string;
  lines: DiningLineClient[];
  /** Toutes les lignes du service ont été envoyées en cuisine. */
  fired: boolean;
  /** Toutes les lignes envoyées sont prêtes. */
  allPrepared: boolean;
  /** Le serveur peut lancer ce service en cuisine. */
  canFire: boolean;
};

function linesForCourse(lines: DiningLineClient[], course: DiningMealCourse): DiningLineClient[] {
  return lines.filter((l) => l.courseType === course);
}

function isCourseFired(courseLines: DiningLineClient[]): boolean {
  if (courseLines.length === 0) return false;
  return courseLines.every((l) => Boolean(l.sentToKitchenAt));
}

function isCourseAllPrepared(courseLines: DiningLineClient[]): boolean {
  if (courseLines.length === 0) return false;
  return courseLines.every((l) => l.isPrepared);
}

/** Prérequis : les services précédents (entrée → plat) sont entièrement prêts. */
export function canFireMealCourse(
  lines: DiningLineClient[],
  course: DiningMealCourse
): boolean {
  const courseLines = linesForCourse(lines, course);
  if (courseLines.length === 0 || isCourseFired(courseLines)) return false;

  const idx = MEAL_COURSE_ORDER.indexOf(course);
  for (let i = 0; i < idx; i++) {
    const prevCourse = MEAL_COURSE_ORDER[i]!;
    const prevLines = linesForCourse(lines, prevCourse);
    if (prevLines.length === 0) continue;
    if (!isCourseAllPrepared(prevLines)) return false;
  }
  return true;
}

export function buildMealCourseSummaries(lines: DiningLineClient[]): DiningCourseSummary[] {
  return MEAL_COURSE_ORDER.map((courseType) => {
    const courseLines = linesForCourse(lines, courseType);
    return {
      courseType,
      label: mealCourseLabel(courseType),
      lines: courseLines,
      fired: isCourseFired(courseLines),
      allPrepared: isCourseAllPrepared(courseLines),
      canFire: canFireMealCourse(lines, courseType),
    };
  }).filter((s) => s.lines.length > 0);
}

export function otherLines(lines: DiningLineClient[]): DiningLineClient[] {
  return lines.filter((l) => !l.courseType || !isMealCourse(l.courseType));
}

/** Services entièrement prêts (envoyés + tous les plats prêts) — à notifier au serveur. */
export function readyMealCoursesForServer(lines: DiningLineClient[]): DiningMealCourse[] {
  return buildMealCourseSummaries(lines)
    .filter((s) => s.fired && s.allPrepared)
    .map((s) => s.courseType);
}
