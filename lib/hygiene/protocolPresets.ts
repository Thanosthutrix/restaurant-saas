import type { HygieneElementCategory, HygieneRiskLevel } from "./types";

/** Protocole type par catégorie d’élément (bonnes pratiques restauration — à adapter à votre PND). */
export type HygieneProtocolPreset = {
  description: string;
  cleaning_protocol: string;
  disinfection_protocol: string;
  product_used: string;
  dosage: string;
  contact_time: string;
  /** Criticité suggérée pour ce type d’élément. */
  suggested_risk_level: HygieneRiskLevel;
};

const PRESETS: Record<HygieneElementCategory, HygieneProtocolPreset> = {
  plan_travail: {
    description: "Surface de préparation en contact direct ou indirect avec les denrées.",
    suggested_risk_level: "critical",
    cleaning_protocol:
      "1. Retirer ustensiles, plats et déchets.\n2. Pré-dégraisser les taches incrustées.\n3. Appliquer le détergent, frotter avec éponge non abrasive.\n4. Rincer à l’eau potable et essuyer ou laisser sécher à l’air.",
    disinfection_protocol:
      "1. Sur surface propre et sèche, appliquer le désinfectant alimentaire.\n2. Respecter le temps de contact indiqué par le fabricant.\n3. Laisser sécher à l’air ou essuyer avec linge à usage unique si requis.",
    product_used: "Détergent dégraissant alimentaire + désinfectant alimentaire (surfaces)",
    dosage: "Selon fiche technique fabricant (souvent 1–3 % pour le détergent)",
    contact_time: "5 à 15 min (désinfection, selon produit)",
  },
  sol: {
    description: "Sol de la zone de production, plonge ou circulation.",
    suggested_risk_level: "important",
    cleaning_protocol:
      "1. Balayer ou aspirer poussières et débris.\n2. Pré-dégraisser les zones très sales.\n3. Lavage au détergent avec balai ou autolaveuse.\n4. Rincer si produit l’exige, laisser sécher.",
    disinfection_protocol:
      "1. Appliquer le désinfectant sur sol propre.\n2. Respecter le temps de contact.\n3. Ne pas rincer sauf indication contraire du produit.",
    product_used: "Détergent sol alimentaire + désinfectant sol",
    dosage: "Selon fiche technique (souvent 0,5–2 %)",
    contact_time: "15 min minimum (selon produit)",
  },
  mur: {
    description: "Mur, faïence ou panneau de la zone alimentaire.",
    suggested_risk_level: "standard",
    cleaning_protocol:
      "1. Dépoussiérer.\n2. Nettoyer au détergent avec éponge ou lavette.\n3. Insister sur projections et plinthes.\n4. Rincer et sécher.",
    disinfection_protocol:
      "1. Désinfecter les zones à risque (autour plonge, cuisson, plonge).\n2. Respecter le temps de contact.",
    product_used: "Détergent alimentaire + désinfectant surfaces",
    dosage: "Selon fiche technique fabricant",
    contact_time: "5 min (selon produit)",
  },
  chambre_froide: {
    description: "Chambre froide positive — stockage denrées sous température dirigée.",
    suggested_risk_level: "important",
    cleaning_protocol:
      "1. Sortir et protéger les denrées (respecter la chaîne du froid).\n2. Décongeler/refroidir si besoin avant nettoyage.\n3. Nettoyer parois, sol, étagères, joints et poignées.\n4. Rincer, sécher, contrôler l’absence de résidus.\n5. Relever la température après remise en service.",
    disinfection_protocol:
      "1. Désinfecter surfaces intérieures après nettoyage.\n2. Traiter joints et poignées (zones de contact).\n3. Laisser agir le temps requis puis remettre en service.",
    product_used: "Détergent alimentaire + désinfectant compatible froid",
    dosage: "Selon fiche technique fabricant",
    contact_time: "5 à 15 min",
  },
  frigo: {
    description: "Armoire ou meuble frigorifique positif.",
    suggested_risk_level: "important",
    cleaning_protocol:
      "1. Vider le frigo et contrôler les DLC/DLUO.\n2. Retirer clayettes et bacs.\n3. Nettoyer intérieur, joints, poignées et clayettes.\n4. Rincer, sécher, remonter les étagères.\n5. Relever la température.",
    disinfection_protocol:
      "1. Désinfecter l’intérieur et les clayettes après nettoyage.\n2. Désinfecter joints et poignées.\n3. Respecter le temps de contact avant remise en denrées.",
    product_used: "Détergent alimentaire + désinfectant surfaces",
    dosage: "Selon fiche technique fabricant",
    contact_time: "5 min minimum",
  },
  congelateur: {
    description: "Congélateur ou armoire négative.",
    suggested_risk_level: "important",
    cleaning_protocol:
      "1. Sortir les denrées (respecter la chaîne du froid).\n2. Décongeler si nécessaire.\n3. Nettoyer parois, sol, clayettes, joints.\n4. Rincer, sécher complètement avant remise en service.\n5. Relever la température.",
    disinfection_protocol:
      "1. Désinfecter après nettoyage complet.\n2. Traiter les zones de contact (poignées, joints).\n3. Laisser sécher avant remise en service.",
    product_used: "Détergent alimentaire + désinfectant surfaces",
    dosage: "Selon fiche technique fabricant",
    contact_time: "5 min minimum",
  },
  etagere: {
    description: "Étagère de stockage ou de service (zone alimentaire).",
    suggested_risk_level: "standard",
    cleaning_protocol:
      "1. Vider l’étagère.\n2. Dépoussiérer puis laver au détergent.\n3. Rincer et sécher.\n4. Contrôler l’état des supports (pas de rouille ni éclats).",
    disinfection_protocol:
      "1. Désinfecter si contact alimentaire direct ou stockage denrées prêtes.\n2. Respecter le temps de contact.",
    product_used: "Détergent alimentaire + désinfectant surfaces",
    dosage: "Selon fiche technique fabricant",
    contact_time: "5 min",
  },
  hotte: {
    description: "Hotte aspirante, filtres et zone de captation des graisses.",
    suggested_risk_level: "important",
    cleaning_protocol:
      "1. Couper l’alimentation si sécurité l’exige.\n2. Retirer et dégraisser filtres (trempage dégraissant).\n3. Nettoyer capot, parois internes et bac de récupération.\n4. Rincer, sécher, remonter filtres propres.",
    disinfection_protocol:
      "1. Désinfecter les surfaces accessibles après dégraissage.\n2. Vérifier l’absence de dépôts graisseux.",
    product_used: "Dégraissant alimentaire + désinfectant surfaces",
    dosage: "Dégraissant concentré selon encrassement (1–5 %)",
    contact_time: "5 min (désinfection)",
  },
  four: {
    description: "Four de cuisson (statique, convection ou combi).",
    suggested_risk_level: "important",
    cleaning_protocol:
      "1. Laisser refroidir.\n2. Retirer grilles et lèchefrite.\n3. Dégraisser parois, sole, porte et joints.\n4. Rincer/essuyer, remonter les accessoires.\n5. Cycle à vide si procédure interne l’exige.",
    disinfection_protocol:
      "1. Désinfecter grilles et surfaces en contact alimentaire après nettoyage.\n2. Laisser sécher avant remise en cuisson.",
    product_used: "Dégraissant four alimentaire + désinfectant surfaces",
    dosage: "Selon fiche technique fabricant",
    contact_time: "5 min",
  },
  piano_plaque: {
    description: "Piano de cuisson, plaques, grilles et surfaces de cuisson.",
    suggested_risk_level: "critical",
    cleaning_protocol:
      "1. Laisser refroidir.\n2. Gratter résidus alimentaires et graisses.\n3. Dégraisser plaques, grilles et rebords.\n4. Rincer/essuyer, contrôler l’absence de résidus carbonisés.",
    disinfection_protocol:
      "1. Désinfecter les surfaces de contact alimentaire après nettoyage.\n2. Respecter le temps de contact avant remise en service.",
    product_used: "Dégraissant alimentaire + désinfectant surfaces chaudes (après refroidissement)",
    dosage: "Selon fiche technique fabricant",
    contact_time: "5 min",
  },
  trancheuse: {
    description: "Trancheuse ou cutter — contact direct avec denrées prêtes à servir.",
    suggested_risk_level: "critical",
    cleaning_protocol:
      "1. Débrancher et démonter lames, poussoir, carter (selon notice).\n2. Pré-dégraisser parties en contact alimentaire.\n3. Laver au détergent, brosser zones difficiles.\n4. Rincer abondamment, sécher ou laisser sécher à l’air.",
    disinfection_protocol:
      "1. Désinfecter toutes les pièces démontées en contact alimentaire.\n2. Désinfecter carter et poignées.\n3. Remonter une fois sec, respecter le temps de contact avant usage.",
    product_used: "Détergent alimentaire + désinfectant alimentaire (contact denrées)",
    dosage: "Selon fiche technique fabricant",
    contact_time: "5 à 15 min",
  },
  machine: {
    description: "Machine à laver vaisselle, hachoir, pétrin ou autre matériel de production.",
    suggested_risk_level: "important",
    cleaning_protocol:
      "1. Arrêter la machine et sécuriser l’accès.\n2. Nettoyer selon notice constructeur (filtres, cuve, buses).\n3. Retirer résidus alimentaires et graisses.\n4. Rincer et contrôler le bon fonctionnement.",
    disinfection_protocol:
      "1. Désinfecter les parties en contact alimentaire selon notice.\n2. Lancer cycle de rinçage si applicable.",
    product_used: "Détergent/dégraissant alimentaire + désinfectant adapté au matériel",
    dosage: "Selon notice constructeur et fiche produit",
    contact_time: "Selon produit et notice machine",
  },
  ustensile: {
    description: "Ustensiles, planches à découper, couteaux, louches, etc.",
    suggested_risk_level: "critical",
    cleaning_protocol:
      "1. Pré-dégraisser au lave-vaisselle ou à la plonge.\n2. Laver au détergent avec brosse dédiée.\n3. Rincer abondamment à l’eau potable.\n4. Laisser sécher sur grille propre ou lave-vaisselle.",
    disinfection_protocol:
      "1. Après nettoyage et rinçage, immerger ou pulvériser le désinfectant.\n2. Respecter le temps de contact.\n3. Rincer si le produit l’exige, sinon laisser sécher à l’air.",
    product_used: "Détergent plonge alimentaire + désinfectant alimentaire",
    dosage: "Selon fiche technique (souvent 1–2 % détergent)",
    contact_time: "5 min minimum",
  },
  bac_gastronorme: {
    description: "Bacs GN, bacs alimentaires et contenants de stockage/service.",
    suggested_risk_level: "important",
    cleaning_protocol:
      "1. Vider et gratter les restes alimentaires.\n2. Laver au détergent (plonge ou lave-batterie).\n3. Rincer abondamment.\n4. Contrôler l’état (fêlures, déformations).",
    disinfection_protocol:
      "1. Désinfecter après nettoyage (immersion ou pulvérisation).\n2. Respecter le temps de contact.\n3. Laisser sécher à l’air sur grille propre.",
    product_used: "Détergent plonge + désinfectant alimentaire",
    dosage: "Selon fiche technique fabricant",
    contact_time: "5 min",
  },
  plonge: {
    description: "Poste de plonge manuel (2 ou 3 bacs) ou zone de lavage.",
    suggested_risk_level: "critical",
    cleaning_protocol:
      "1. Vider les bacs et changer l’eau si nécessaire.\n2. Nettoyer bacs, robinetterie, rebords et égouttoir.\n3. Dégraisser les parois et le fond.\n4. Rincer, remplir bacs avec eau propre et produits dosés.",
    disinfection_protocol:
      "1. Désinfecter bacs et surfaces de contact après nettoyage.\n2. Renouveler l’eau de rinçage/désinfection selon procédure 2 ou 3 bacs.\n3. Afficher températures et concentrations si contrôles requis.",
    product_used: "Détergent plonge + désinfectant alimentaire (bac n°3 si procédure 3 bacs)",
    dosage: "Détergent 1–2 % ; désinfectant selon fiche (souvent 0,5–1 %)",
    contact_time: "5 min (bac désinfection)",
  },
  sanitaire: {
    description: "Sanitaires du personnel (WC, lavabo, vestiaires).",
    suggested_risk_level: "important",
    cleaning_protocol:
      "1. Porter EPI adaptés (gants).\n2. Nettoyer cuvette, abattant, lavabo, robinets et sol.\n3. Utiliser produits dédiés sanitaires (distincts de la cuisine).\n4. Rincer/essuyer, renouveler consommables (savon, essuie-mains).",
    disinfection_protocol:
      "1. Désinfecter points de contact (poignées, chasse, robinets).\n2. Respecter le temps de contact.\n3. Ne pas utiliser les mêmes lavettes qu’en cuisine.",
    product_used: "Détergent sanitaire + désinfectant sanitaire",
    dosage: "Selon fiche technique fabricant",
    contact_time: "5 à 15 min",
  },
  poubelle: {
    description: "Poubelles et conteneurs de déchets (alimentaires ou emballages).",
    suggested_risk_level: "important",
    cleaning_protocol:
      "1. Vider et changer le sac.\n2. Nettoyer intérieur et extérieur au détergent.\n3. Rincer, sécher.\n4. Contrôler couvercle et pédale.",
    disinfection_protocol:
      "1. Désinfecter intérieur, couvercle et poignées.\n2. Respecter le temps de contact avant remise du sac.",
    product_used: "Détergent + désinfectant surfaces",
    dosage: "Selon fiche technique fabricant",
    contact_time: "5 min",
  },
  poignee_contact: {
    description: "Poignées de porte, interrupteurs, télécommandes, terminaux — points de contact fréquent.",
    suggested_risk_level: "important",
    cleaning_protocol:
      "1. Nettoyer au détergent avec lavette non abrasive.\n2. Insister sur zones touchées.\n3. Essuyer ou laisser sécher.",
    disinfection_protocol:
      "1. Appliquer désinfectant sur surface propre.\n2. Laisser agir le temps de contact sans rincer si produit sans rinçage.",
    product_used: "Détergent alimentaire + désinfectant sans rinçage (surfaces)",
    dosage: "Prêt à l’emploi ou selon dilution fabricant",
    contact_time: "1 à 5 min (selon produit)",
  },
  zone_dechets: {
    description: "Zone de collecte des déchets (local poubelles, tri, bacs extérieurs).",
    suggested_risk_level: "important",
    cleaning_protocol:
      "1. Sortir bacs et containers.\n2. Balayer et laver le sol au détergent.\n3. Nettoyer murs et abris si présents.\n4. Laver les bacs/containers, rincer, sécher.",
    disinfection_protocol:
      "1. Désinfecter sol et bacs après nettoyage.\n2. Traiter poignées et couvercles.\n3. Respecter le temps de contact.",
    product_used: "Détergent + désinfectant adapté extérieur/intérieur",
    dosage: "Selon fiche technique fabricant",
    contact_time: "15 min (sol et bacs)",
  },
  reserve: {
    description: "Réserve sèche ou zone de stockage non réfrigéré.",
    suggested_risk_level: "standard",
    cleaning_protocol:
      "1. Dépoussiérer étagères et produits si déplacés.\n2. Balayer puis laver le sol.\n3. Nettoyer étagères et zones de stockage.\n4. Contrôler absence de nuisibles et denrées abîmées.",
    disinfection_protocol:
      "1. Désinfecter si zone à risque (proximité aliments ouverts).\n2. Sinon nettoyage suffisant selon PND.",
    product_used: "Détergent alimentaire (+ désinfectant si besoin)",
    dosage: "Selon fiche technique fabricant",
    contact_time: "5 min si désinfection",
  },
  vehicule: {
    description: "Véhicule de livraison ou transport de denrées.",
    suggested_risk_level: "important",
    cleaning_protocol:
      "1. Vider et balayer l’habitacle/caisse.\n2. Nettoyer parois, sol et clayettes.\n3. Contrôler propreté des bacs isothermes.\n4. Vérifier température si transport réfrigéré.",
    disinfection_protocol:
      "1. Désinfecter surfaces de contact et caisse après nettoyage.\n2. Respecter le temps de contact avant chargement.",
    product_used: "Détergent alimentaire + désinfectant surfaces",
    dosage: "Selon fiche technique fabricant",
    contact_time: "5 à 15 min",
  },
  autre: {
    description: "Élément spécifique — à décrire selon usage et contact alimentaire.",
    suggested_risk_level: "standard",
    cleaning_protocol:
      "1. Identifier les zones sales et points de contact.\n2. Nettoyer au détergent adapté au matériau.\n3. Rincer si nécessaire.\n4. Contrôler visuellement l’absence de résidus.",
    disinfection_protocol:
      "1. Désinfecter si surface en contact alimentaire ou contact client.\n2. Respecter le temps de contact du produit.\n3. Adapter la fréquence au niveau de risque.",
    product_used: "Détergent alimentaire + désinfectant alimentaire",
    dosage: "Selon fiche technique fabricant",
    contact_time: "5 min minimum",
  },
};

export function getHygieneProtocolPreset(category: HygieneElementCategory): HygieneProtocolPreset {
  return PRESETS[category] ?? PRESETS.autre;
}

/** Applique le protocole type sur les champs du formulaire élément hygiène. */
export function applyHygieneProtocolPreset<T extends {
  category: HygieneElementCategory;
  description: string;
  cleaning_protocol: string;
  disinfection_protocol: string;
  product_used: string;
  dosage: string;
  contact_time: string;
  risk_level: HygieneRiskLevel;
}>(form: T): T {
  const preset = getHygieneProtocolPreset(form.category);
  return {
    ...form,
    description: preset.description,
    cleaning_protocol: preset.cleaning_protocol,
    disinfection_protocol: preset.disinfection_protocol,
    product_used: preset.product_used,
    dosage: preset.dosage,
    contact_time: preset.contact_time,
    risk_level: preset.suggested_risk_level,
  };
}
