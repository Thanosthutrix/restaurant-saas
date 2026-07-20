import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ubion — gestion restaurant",
    short_name: "ubion",
    description:
      "Salle, cuisine, hygiène, stock et pilotage pour les restaurants. Fonctionne hors ligne pour les relevés terrain.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fafaf9",
    theme_color: "#9c431c",
    lang: "fr",
    categories: ["business", "food"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
