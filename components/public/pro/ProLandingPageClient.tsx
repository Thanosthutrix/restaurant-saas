"use client";

import { useEffect, useState } from "react";
import { fetchHasProAccess } from "@/lib/public/proAccessClient";
import { ProLandingPage } from "./ProLandingPage";

export function ProLandingPageClient() {
  const [isProUser, setIsProUser] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchHasProAccess().then((pro) => {
      if (!cancelled) setIsProUser(pro);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <ProLandingPage isProUser={isProUser} />;
}
