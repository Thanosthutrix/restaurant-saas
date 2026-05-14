import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function OnboardingImportsLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("ai_assistant");
  return <>{children}</>;
}
