import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { countCustomers, listCustomerTags, listCustomers } from "@/lib/customers/customersDb";
import type { CustomerListSort, CustomerSource } from "@/lib/customers/types";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { ClientsListClient } from "./ClientsListClient";

export const metadata = {
  title: "Base clients",
};

type Props = {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    tag?: string;
    source?: string;
    marketing?: string;
  }>;
};

const SORTS: CustomerListSort[] = ["name_asc", "created_desc", "last_visit_desc", "visits_desc"];

const SOURCES: CustomerSource[] = [
  "walk_in",
  "phone",
  "website",
  "referral",
  "social",
  "event",
  "import",
  "other",
];

function parseSort(s: string | undefined): CustomerListSort {
  if (s && (SORTS as string[]).includes(s)) return s as CustomerListSort;
  return "name_asc";
}

function parseSource(s: string | undefined): "all" | CustomerSource {
  if (s && s !== "all" && (SOURCES as string[]).includes(s)) return s as CustomerSource;
  return "all";
}

export default async function ClientsPage({ searchParams }: Props) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const sp = await searchParams;
  const q = sp.q?.trim();
  const sort = parseSort(sp.sort);
  const tagIds = sp.tag ? sp.tag.split(",").filter(Boolean) : [];
  const sourceF = parseSource(sp.source);
  const marketingOnly = sp.marketing === "1";

  const [tags, { rows, totalApprox }, totalActive] = await Promise.all([
    listCustomerTags(restaurant.id),
    listCustomers(restaurant.id, {
      search: q || undefined,
      sort,
      tagIds: tagIds.length ? tagIds : undefined,
      source: sourceF,
      marketingOnly: marketingOnly || undefined,
      limit: 50,
      offset: 0,
    }),
    countCustomers(restaurant.id),
  ]);

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-8 px-4 py-6">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Base clients</h1>
        <p className={`mt-2 ${uiLead}`}>
          Fiches contacts, étiquettes, journal et consentements — base pour les réservations et la relation client.
        </p>
      </div>

      <ClientsListClient
        restaurantId={restaurant.id}
        initialRows={rows}
        totalApprox={totalApprox}
        totalActive={totalActive}
        tags={tags}
        initialQuery={q ?? ""}
        initialSort={sort}
        initialTagIds={tagIds}
        initialSource={sourceF}
        initialMarketingOnly={marketingOnly}
      />
    </div>
  );
}
