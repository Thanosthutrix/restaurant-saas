import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { getPlatformCompany } from "@/lib/platform/companyDb";
import {
  getPlatformPlanningSettings,
  listPlatformStaffMembers,
  listPlatformWorkShiftsInRange,
  normalizePlatformOfficeHours,
} from "@/lib/platform/platformStaffDb";
import { addDays, mondayFromWeekParam, toISODateString } from "@/lib/staff/weekUtils";
import { resolvePlatformWeekDays } from "@/lib/platform/platformPlanningResolve";
import { toStaffMemberAdapter, toWorkShiftWithDetails } from "@/lib/platform/platformStaffAdapters";
import { PlatformEquipePlanningClient } from "./PlatformEquipePlanningClient";
import { PlatformOfficeHoursSection } from "./PlatformOfficeHoursSection";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ week?: string }> };

export default async function AdminCompanyTeamPage({ searchParams }: Props) {
  const company = await getPlatformCompany();
  if (!company) redirect("/admin/company");

  const sp = await searchParams;
  const monday = mondayFromWeekParam(sp.week);
  const weekMondayIso = toISODateString(monday);
  const weekEndExclusive = addDays(monday, 7);
  const rangeStartIso = monday.toISOString();
  const rangeEndExclusiveIso = weekEndExclusive.toISOString();

  const [platformStaff, shiftRows, planningSettings] = await Promise.all([
    listPlatformStaffMembers(company.id),
    listPlatformWorkShiftsInRange(company.id, rangeStartIso, rangeEndExclusiveIso),
    getPlatformPlanningSettings(company.id),
  ]);

  const officeHours = normalizePlatformOfficeHours(planningSettings.officeHoursJson);
  const resolvedWeekDays = resolvePlatformWeekDays(weekMondayIso, officeHours);
  const staffById = new Map(platformStaff.map((s) => [s.id, s]));

  const staff = platformStaff.map((s) => toStaffMemberAdapter(company.id, s));
  const shifts = shiftRows.map((sh) => toWorkShiftWithDetails(company.id, sh, staffById));

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <Link href="/admin/company" className="text-xs text-gray-500 hover:text-gray-700">
        ← Ma société
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
        <Users size={22} className="text-amber-600" />
        Équipe & planning
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Grille hebdomadaire — même interface que les restaurateurs, pour votre équipe Ubion.
      </p>

      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Les heures planifiées alimentent{" "}
        <Link href="/admin/company/pocket" className="font-medium underline">
          Ma poche
        </Link>{" "}
        (masse salariale). Contrats dans{" "}
        <Link href="/admin/company/contracts" className="font-medium underline">
          Contrats RH
        </Link>
        .
      </div>

      <div className="mt-6 space-y-6">
        <PlatformOfficeHoursSection
          officeHours={officeHours}
          securityFloor={planningSettings.securityFloor}
        />
        <PlatformEquipePlanningClient
          companyId={company.id}
          weekMondayIso={weekMondayIso}
          staff={staff}
          platformStaff={platformStaff}
          shifts={shifts}
          resolvedWeekDays={resolvedWeekDays}
          securityFloor={planningSettings.securityFloor}
        />
      </div>
    </div>
  );
}
