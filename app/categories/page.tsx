import { redirect } from "next/navigation";

/** Les rubriques sont gérées depuis Compte. */
export default function CategoriesPage() {
  redirect("/account#rubriques");
}
