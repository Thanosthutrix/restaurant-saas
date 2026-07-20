import type { LucideIcon } from "lucide-react";
import { PageContainer, PageHeader, type Breadcrumb } from "@/components/ui/PageHeader";

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  breadcrumbs?: Breadcrumb[];
  accentIcon?: LucideIcon;
  accentTone?: string;
  width?: "wide" | "narrow";
  children: React.ReactNode;
};

export function OnboardingPageShell({
  title,
  subtitle,
  eyebrow,
  breadcrumbs,
  accentIcon,
  accentTone = "bg-copper-50 text-copper-700",
  width = "narrow",
  children,
}: Props) {
  return (
    <PageContainer width={width}>
      <PageHeader
        accentIcon={accentIcon}
        accentTone={accentTone}
        breadcrumbs={breadcrumbs}
        eyebrow={eyebrow}
        subtitle={subtitle}
        title={title}
      />
      {children}
    </PageContainer>
  );
}
