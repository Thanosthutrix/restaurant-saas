import type { Metadata } from "next";
import { PublicLayoutShell } from "@/components/public/PublicLayoutShell";

export const metadata: Metadata = {
  title: {
    default: "Restaurant",
    template: "%s · ubion",
  },
};

export default function RestaurantPublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicLayoutShell>{children}</PublicLayoutShell>;
}
