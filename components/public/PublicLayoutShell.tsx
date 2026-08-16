import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";

export function PublicLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 [&_input:not([type=checkbox]):not([type=radio])]:text-slate-900 [&_input:not([type=checkbox]):not([type=radio])]:[color-scheme:light] [&_select]:text-slate-900 [&_select]:[color-scheme:light] [&_textarea]:text-slate-900 [&_textarea]:[color-scheme:light]">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
