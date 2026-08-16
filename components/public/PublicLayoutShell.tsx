import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";

type Props = {
  children: React.ReactNode;
  headerMode?: "public" | "pro";
};

export function PublicLayoutShell({ children, headerMode = "public" }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 [&_input:not([type=checkbox]):not([type=radio])]:text-slate-900 [&_input:not([type=checkbox]):not([type=radio])]:[color-scheme:light] [&_select]:text-slate-900 [&_select]:[color-scheme:light] [&_textarea]:text-slate-900 [&_textarea]:[color-scheme:light]">
      <PublicHeader mode={headerMode} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
