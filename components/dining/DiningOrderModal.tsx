"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import { DiningOrderClient } from "@/app/salle/commande/[orderId]/DiningOrderClient";
import { loadDiningOrderModalData } from "@/app/salle/actions";
import { Modal } from "@/components/ui/Modal";
import { uiBtnSecondary, uiError } from "@/components/ui/premium";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import type { DiningOrderSessionBundle, DiningOrderViewData } from "@/lib/dining/diningOrderViewData";

type Props = {
  restaurantId: string;
  orderId: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  session: DiningOrderSessionBundle;
  cancelRedirectHref: string;
  fullScreenHref?: string;
  onClose: () => void;
  onOrderChanged?: () => void;
  initialViewData?: DiningOrderViewData | null;
};

export function DiningOrderModal({
  restaurantId,
  orderId,
  title,
  subtitle,
  icon: Icon,
  session,
  cancelRedirectHref,
  fullScreenHref,
  onClose,
  onOrderChanged,
  initialViewData = null,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [viewData, setViewData] = useState<DiningOrderViewData | null>(initialViewData);

  function reloadViewData() {
    setError(null);
    startTransition(async () => {
      const res = await loadDiningOrderModalData({ restaurantId, orderId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setViewData(res.data ?? null);
    });
  }

  useEffect(() => {
    if (initialViewData) return;
    reloadViewData();
  }, [restaurantId, orderId, initialViewData]);

  const debouncedListRefresh = useDebouncedCallback(() => {
    onOrderChanged?.();
    router.refresh();
  }, 2000);

  function handleEmbeddedClose() {
    onOrderChanged?.();
    router.refresh();
    onClose();
  }

  const modalSubtitle = viewData?.placeDescription ?? subtitle;

  return (
    <Modal
      title={title}
      subtitle={modalSubtitle}
      icon={Icon}
      size="xl"
      onClose={onClose}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {fullScreenHref ? (
            <Link
              href={fullScreenHref}
              className="text-sm font-semibold text-copper-700 transition hover:text-copper-600"
            >
              Ouvrir en plein écran →
            </Link>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClose} className={uiBtnSecondary}>
            Fermer
          </button>
        </div>
      }
    >
      {pending && !viewData ? (
        <div className="space-y-3 py-6">
          <div className="h-24 animate-pulse rounded-2xl bg-stone-100" />
          <div className="h-40 animate-pulse rounded-2xl bg-stone-100" />
        </div>
      ) : null}

      {error ? <p className={uiError}>{error}</p> : null}

      {viewData ? (
        <DiningOrderClient
          restaurantId={restaurantId}
          orderId={viewData.orderId}
          status={viewData.status}
          serviceId={viewData.serviceId}
          placeDescription={viewData.placeDescription}
          cancelRedirectHref={cancelRedirectHref}
          settledPaymentMethod={viewData.settledPaymentMethod}
          lines={viewData.lines}
          totalTtc={viewData.totalTtc}
          amountPaidTtc={viewData.amountPaidTtc}
          catalogRoots={session.catalogRoots}
          directByCategoryId={session.directByCategoryId}
          uncategorized={session.uncategorized}
          linkedCustomer={viewData.linkedCustomer}
          linkedCustomerEmail={viewData.linkedCustomerEmail}
          customerSearchPool={session.customerSearchPool}
          diningTableId={viewData.diningTableId}
          guestLabel={viewData.guestLabel}
          embeddedInModal
          onEmbeddedClose={handleEmbeddedClose}
          onOrderChanged={debouncedListRefresh}
        />
      ) : null}
    </Modal>
  );
}
