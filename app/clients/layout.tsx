import { requireNavAccessOrReadonly } from "@/lib/auth/requireNavAccess";

export default async function ClientsLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  await requireNavAccessOrReadonly("clients");
  return (
    <>
      {children}
      {modal}
    </>
  );
}
