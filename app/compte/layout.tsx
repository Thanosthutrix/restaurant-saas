import { PublicLayoutShell } from "@/components/public/PublicLayoutShell";

export default function CompteLayout({ children }: { children: React.ReactNode }) {
  return <PublicLayoutShell>{children}</PublicLayoutShell>;
}
