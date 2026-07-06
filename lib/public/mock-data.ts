import type { MenuItem, Restaurant, Review } from "@/lib/public/types";

const IMG = {
  bistro:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
  italian:
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
  sushi:
    "https://images.unsplash.com/photo-1579877644944-b8b069b7a888?w=800&q=80",
  brasserie:
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
  coverBistro:
    "https://images.unsplash.com/photo-1424847651672-bf20ad4fd098?w=1200&q=80",
  coverItalian:
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80",
  coverSushi:
    "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=1200&q=80",
  coverBrasserie:
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&q=80",
  dish1:
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80",
  dish2:
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80",
  dish3:
    "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&q=80",
  dish4:
    "https://images.unsplash.com/photo-1482049010485-69d066a47c7e?w=400&q=80",
  dish5:
    "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=80",
};

export const MOCK_RESTAURANTS: Restaurant[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Le Comptoir du Marché",
    description:
      "Bistro parisien convivial, produits du marché et carte de saison renouvelée chaque semaine.",
    address: "14 rue des Halles, 75001 Paris",
    cuisine_type: "Bistro français",
    hygiene_score: "Très satisfaisant",
    image_url: IMG.bistro,
    cover_url: IMG.coverBistro,
    average_rating: 4.7,
    review_count: 215,
    phone: "01 42 36 78 90",
    email: "contact@comptoir-marche.fr",
    opening_hours: "Mar–Sam · 12h–14h30 · 19h–23h",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Trattoria Bella Vista",
    description:
      "Cuisine italienne authentique : pâtes fraîches, antipasti maison et vins des Pouilles.",
    address: "8 avenue de la République, 69002 Lyon",
    cuisine_type: "Italien",
    hygiene_score: "Très satisfaisant",
    image_url: IMG.italian,
    cover_url: IMG.coverItalian,
    average_rating: 4.5,
    review_count: 142,
    phone: "04 78 42 11 22",
    email: "bonjour@bellavista.fr",
    opening_hours: "Lun–Dim · 12h–15h · 19h–22h30",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Sakura Omakase",
    description:
      "Bar à sushi contemporain, poissons du jour et créations du chef en comptoir omakase.",
    address: "3 quai Tilsitt, 75007 Paris",
    cuisine_type: "Japonais · Sushi",
    hygiene_score: "Satisfaisant",
    image_url: IMG.sushi,
    cover_url: IMG.coverSushi,
    average_rating: 4.8,
    review_count: 89,
    phone: "01 45 55 66 77",
    email: "reservation@sakura-omakase.fr",
    opening_hours: "Mar–Sam · 19h–23h",
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Brasserie du Parc",
    description:
      "Grands classiques brasserie, terrasse ombragée et formule déjeuner express.",
    address: "22 boulevard Haussmann, 75009 Paris",
    cuisine_type: "Brasserie",
    hygiene_score: "Très satisfaisant",
    image_url: IMG.brasserie,
    cover_url: IMG.coverBrasserie,
    average_rating: 4.3,
    review_count: 328,
    phone: "01 48 74 20 10",
    email: "accueil@brasserie-parc.fr",
    opening_hours: "Lun–Dim · 8h–23h",
  },
];

const MENU_BY_RESTAURANT: Record<string, MenuItem[]> = {
  "11111111-1111-1111-1111-111111111111": [
    {
      id: "m1",
      restaurant_id: "11111111-1111-1111-1111-111111111111",
      name: "Velouté de potimarron",
      description: "Crème légère, graines toastées et huile de noisette.",
      price: 9.5,
      category: "entrée",
      is_public: true,
      image_url: IMG.dish1,
    },
    {
      id: "m2",
      restaurant_id: "11111111-1111-1111-1111-111111111111",
      name: "Tartare de bœuf",
      description: "Frites maison, condiments et jaune d'œuf fermier.",
      price: 16,
      category: "entrée",
      is_public: true,
      image_url: IMG.dish2,
    },
    {
      id: "m3",
      restaurant_id: "11111111-1111-1111-1111-111111111111",
      name: "Suprême de volaille rôtie",
      description: "Jus au thym, purée de céleri et légumes racines.",
      price: 24,
      category: "plat",
      is_public: true,
      image_url: IMG.dish3,
    },
    {
      id: "m4",
      restaurant_id: "11111111-1111-1111-1111-111111111111",
      name: "Dos de cabillaud",
      description: "Beurre blanc citronné, épinards et pommes grenailles.",
      price: 26,
      category: "plat",
      is_public: true,
      image_url: IMG.dish4,
    },
    {
      id: "m5",
      restaurant_id: "11111111-1111-1111-1111-111111111111",
      name: "Tarte Tatin",
      description: "Pommes caramélisées, crème fraîche d'Isigny.",
      price: 9,
      category: "dessert",
      is_public: true,
      image_url: IMG.dish5,
    },
    {
      id: "m6",
      restaurant_id: "11111111-1111-1111-1111-111111111111",
      name: "Mousse au chocolat",
      description: "Chocolat noir 70 %, pointe de fleur de sel.",
      price: 8.5,
      category: "dessert",
      is_public: true,
      image_url: IMG.dish5,
    },
    {
      id: "m6b",
      restaurant_id: "11111111-1111-1111-1111-111111111111",
      name: "Plateau de charcuterie",
      description: "Jambon de Bayonne, saucisson sec, cornichons et pain de campagne.",
      price: 18,
      category: "à_partager",
      is_public: true,
      image_url: IMG.dish2,
    },
    {
      id: "m6c",
      restaurant_id: "11111111-1111-1111-1111-111111111111",
      name: "Côte de Bourgueil",
      description: "Cabernet Franc, 75 cl — fruité et léger.",
      price: 28,
      category: "vin",
      is_public: true,
    },
    {
      id: "m6d",
      restaurant_id: "11111111-1111-1111-1111-111111111111",
      name: "Limonade maison",
      description: "Citron vert, menthe et eau pétillante.",
      price: 5.5,
      category: "boisson",
      is_public: true,
    },
  ],
  "22222222-2222-2222-2222-222222222222": [
    {
      id: "m7",
      restaurant_id: "22222222-2222-2222-2222-222222222222",
      name: "Burrata crémeuse",
      description: "Tomates confites, pesto basilic et focaccia.",
      price: 12,
      category: "entrée",
      is_public: true,
      image_url: IMG.dish1,
    },
    {
      id: "m8",
      restaurant_id: "22222222-2222-2222-2222-222222222222",
      name: "Tagliatelles al ragù",
      description: "Pâtes fraîches, ragù mijoté 6 heures.",
      price: 19,
      category: "plat",
      is_public: true,
      image_url: IMG.dish2,
    },
    {
      id: "m9",
      restaurant_id: "22222222-2222-2222-2222-222222222222",
      name: "Tiramisu maison",
      description: "Mascarpone, espresso et cacao amer.",
      price: 8,
      category: "dessert",
      is_public: true,
      image_url: IMG.dish5,
    },
  ],
};

const REVIEWS_BY_RESTAURANT: Record<string, Review[]> = {
  "11111111-1111-1111-1111-111111111111": [
    {
      id: "r1",
      restaurant_id: "11111111-1111-1111-1111-111111111111",
      rating: 5,
      comment:
        "Service impeccable, produits ultra frais. Le tartare est une référence dans le quartier.",
      created_at: "2026-06-12T19:30:00Z",
      is_certified: true,
      author_name: "Camille D.",
    },
    {
      id: "r2",
      restaurant_id: "11111111-1111-1111-1111-111111111111",
      rating: 4,
      comment: "Ambiance chaleureuse, un peu d'attente le samedi soir mais ça vaut le détour.",
      created_at: "2026-05-28T20:15:00Z",
      is_certified: true,
      author_name: "Thomas L.",
    },
    {
      id: "r3",
      restaurant_id: "11111111-1111-1111-1111-111111111111",
      rating: 5,
      comment: "La tarte Tatin est un must. Je reviendrai pour le menu du marché.",
      created_at: "2026-05-10T12:45:00Z",
      is_certified: false,
      author_name: "Julie M.",
    },
  ],
  "22222222-2222-2222-2222-222222222222": [
    {
      id: "r4",
      restaurant_id: "22222222-2222-2222-2222-222222222222",
      rating: 5,
      comment: "Pâtes exceptionnelles, accueil familial. Avis certifié après notre déjeuner.",
      created_at: "2026-06-01T13:00:00Z",
      is_certified: true,
      author_name: "Marc P.",
    },
  ],
};

export function getMockMenuItems(restaurantId: string): MenuItem[] {
  return (MENU_BY_RESTAURANT[restaurantId] ?? []).filter((item) => item.is_public);
}

export function getMockReviews(restaurantId: string): Review[] {
  return REVIEWS_BY_RESTAURANT[restaurantId] ?? [];
}
