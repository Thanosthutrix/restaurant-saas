/**
 * GET /api/admin/export-csv
 * Exporte la liste complète des clients en CSV.
 * Réservé à l'admin (vérifié côté serveur).
 */

import { NextResponse } from "next/server";
import { isCurrentUserAdmin, getAllRestaurantsWithOwners } from "@/lib/admin";

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(): Promise<NextResponse> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const restaurants = await getAllRestaurantsWithOwners();

  const headers = [
    "Nom",
    "Email propriétaire",
    "Prénom / Nom",
    "Type d'activité",
    "Inscrit le",
    "Dernière connexion",
    "Statut",
    "Essai source",
    "Essai expire le",
  ];

  const now = new Date();

  const rows = restaurants.map((r) => {
    let status = "Actif";
    if (r.suspended_at) status = "Suspendu";
    else if (r.trial) {
      status = new Date(r.trial.expires_at) > now ? "Essai actif" : "Essai expiré";
    }

    return [
      r.name,
      r.owner_email,
      r.owner_name,
      r.activity_type,
      r.created_at ? new Date(r.created_at).toLocaleDateString("fr-FR") : "",
      r.owner_last_sign_in ? new Date(r.owner_last_sign_in).toLocaleDateString("fr-FR") : "",
      status,
      r.trial?.source ?? "",
      r.trial ? new Date(r.trial.expires_at).toLocaleDateString("fr-FR") : "",
    ]
      .map(escapeCSV)
      .join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ubion-clients-${dateStr}.csv"`,
    },
  });
}
