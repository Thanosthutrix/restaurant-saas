export type ProProblem = {
  id: string;
  index: number;
  stat: string;
  statSub: string;
  title: string;
  description: string;
  bullets?: string[];
};

export type ProSolution = {
  id: string;
  tag: string;
  icon: "clock" | "euro" | "clipboard" | "megaphone" | "users";
  problem: string;
  title: string;
  description: string;
  features: string[];
  mock?: "dashboard" | "stock" | "floor" | "recipe" | "reservations" | "haccp";
};

export const PRO_HOOK = {
  eyebrow: "Pour les restaurateurs exigeants",
  title: "Ouvrir un restaurant, c'est l'un des projets les plus exigeants qui soit.",
  lead:
    "10 fermetures par jour en France. Une marge nette moyenne de 5 à 10 %. Et pourtant, des milliers de passionnés se lancent chaque année.",
  sub: "Le problème, ce n'est pas la passion. C'est que gérer un restaurant en 2025, c'est gérer une dizaine de métiers à la fois — sans les outils pour le faire.",
  punchline: "Ubion a été conçu pour changer ça.",
};

export const PRO_PROBLEMS: ProProblem[] = [
  {
    id: "time",
    index: 1,
    stat: "4 h",
    statSub: "perdues par semaine en admin — plus de 200 h par an",
    title: "Le temps qu'on n'a pas",
    description:
      "Commandes, livraisons, plannings, fiches de paie, registres, factures… La journée ne s'arrête pas au service.",
    bullets: [
      "30 à 45 minutes de saisie manuelle chaque soir pour les exports comptables",
      "Ces heures ne sont pas en salle, pas en cuisine, pas avec l'équipe",
    ],
  },
  {
    id: "margin",
    index: 2,
    stat: "5–10 %",
    statSub: "de marge nette moyenne en restauration traditionnelle",
    title: "L'argent qui fuit sans qu'on le voie",
    description:
      "Matières premières à 35–40 % du CA, masse salariale similaire, inflation alimentaire +22 % depuis 2021.",
    bullets: [
      "Chaque erreur de commande ou facture mal vérifiée tombe directement dans la marge",
      "Jusqu'à 1 000 € de pertes évitables par mois liées au gaspillage",
    ],
  },
  {
    id: "ops",
    index: 3,
    stat: "10+",
    statSub: "outils et registres souvent déconnectés entre eux",
    title: "Une charge opérationnelle écrasante",
    description:
      "HACCP, températures, traçabilité, plannings, fournisseurs, bons de livraison… Tout ça éparpillé entre papier, Excel et apps isolées.",
  },
  {
    id: "image",
    index: 4,
    stat: "72 %",
    statSub: "des consommateurs consultent les avis avant de réserver",
    title: "Une image difficile à soigner",
    description:
      "Avis Google, carte en ligne, réseaux sociaux — vos futurs clients vous jugent avant même de pousser la porte. Mais animer tout ça, c'est un temps plein.",
  },
  {
    id: "team",
    index: 5,
    stat: "200 000",
    statSub: "postes non pourvus en restauration en France",
    title: "L'humain, source de tout — et de tension",
    description:
      "Retenir ses équipes est devenu stratégique. Les tensions viennent souvent d'heures floues, de plannings imprécis et d'un manque de reconnaissance.",
  },
];

export const PRO_RESULT = {
  stat: "≈ 10",
  statSub: "fermetures par jour en France",
  title: "Le résultat de tout ça ?",
  description:
    "Près de 4 000 défaillances sur le seul premier semestre 2024. Ce n'est pas une fatalité — c'est le symptôme d'un secteur qui manque d'outils adaptés.",
};

export const PRO_SOLUTIONS: ProSolution[] = [
  {
    id: "time",
    tag: "Temps",
    icon: "clock",
    problem: "Commandes à l'instinct, livraisons à la va-vite, heures calculées à la main.",
    title: "Gagner du temps",
    description: "Ubion automatise ce qui vous vole des heures chaque semaine.",
    features: [
      "Suggestions de commandes basées sur l'état des stocks en temps réel",
      "Rapprochement automatique bons de livraison / factures fournisseurs",
      "Pointeuse intégrée et calcul automatique des heures",
    ],
    mock: "stock",
  },
  {
    id: "margin",
    tag: "Marges",
    icon: "euro",
    problem: "On découvre les pertes trop tard, sans comprendre d'où elles viennent.",
    title: "Préserver et maximiser les marges",
    description: "Pilotez votre rentabilité avec des chiffres fiables, pas des intuitions.",
    features: [
      "Marges en direct sur chaque plat, service et semaine",
      "Bilan en temps réel : entrées, sorties, reste à payer",
      "État précis des pertes et du gaspillage",
      "Offres ciblées pour remplir les périodes creuses",
    ],
    mock: "dashboard",
  },
  {
    id: "daily",
    tag: "Quotidien",
    icon: "clipboard",
    problem: "Registres papier, outils éparpillés, charge mentale permanente.",
    title: "Simplifier le quotidien",
    description: "Tous vos registres et contrôles au même endroit, guidés pas à pas.",
    features: [
      "Registres tenus et mis à jour automatiquement",
      "Normes HACCP facilitées — zéro oubli",
      "Tâches et planning : chacun sait quoi faire et quand",
    ],
    mock: "haccp",
  },
  {
    id: "image",
    tag: "Image",
    icon: "megaphone",
    problem: "La présence digitale est essentielle mais personne n'a le temps de s'en occuper.",
    title: "Soigner son image sans y passer ses nuits",
    description: "Votre vitrine en ligne, toujours à jour, depuis une seule interface.",
    features: [
      "Site web créé et mis à jour à partir de vos infos restaurant",
      "Réseaux sociaux et fiche Google centralisés",
      "Portail client : ambiance, carte, réservation en ligne",
      "Score hygiène public et carte toujours à jour",
    ],
    mock: "reservations",
  },
  {
    id: "team",
    tag: "Équipe",
    icon: "users",
    problem: "Tensions liées aux heures floues et au manque de feedback.",
    title: "Mieux manager, moins de friction",
    description: "Une source de vérité partagée pour l'équipe et des retours sincères.",
    features: [
      "Feedback anonyme de l'équipe pour progresser sans crispation",
      "Heures pointées, claires et accessibles par tous",
    ],
    mock: "floor",
  },
];

export const PRO_CLOSING = {
  title: "Une seule application.",
  lead: "Pour reprendre le contrôle de votre temps, de vos marges, de votre image et de vos équipes.",
  tagline: "Votre passion. Vos clients. Votre cuisine.",
};
