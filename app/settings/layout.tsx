import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("settings");
  return children;
}
