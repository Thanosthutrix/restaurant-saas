import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function CommunicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireNavAccess("communication");
  return children;
}
