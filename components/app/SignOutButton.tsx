"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";
import { signOut } from "@/app/login/actions";
import { unregisterPushTokenFromServer } from "@/lib/push/registerPushTokenClient";

type Props = {
  className?: string;
  children: ReactNode;
};

export function SignOutButton({ className, children }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        startTransition(async () => {
          await unregisterPushTokenFromServer();
          await signOut();
        });
      }}
    >
      {children}
    </button>
  );
}
