import { getConventionConfig, type ConventionRegistryEntry } from "./conventionRegistry";
import { HCR_CDD_REASONS } from "./hcrLegislation";
import { validateContractDraft } from "./validateContractDraft";
import type {
  HcrContractDraft as WizardContractDraft,
  HcrContractKind,
  HcrGeneratedDocument,
  HcrValidationIssue,
} from "./types";

const CONTRACT_KIND_LABELS: Record<HcrContractKind, string> = {
  cdi: "CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE (CDI)",
  cdd: "CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE (CDD)",
  saisonnier: "CONTRAT DE TRAVAIL SAISONNIER",
  extra: "CONTRAT DE TRAVAIL EXTRA",
};

export interface ContractArticle {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
}

export interface HcrContractDraft {
  jobTitle: string;
  status: "employee" | "supervisor" | "executive";
  level: string;
  echelon: string;
  jobMissions: string;
  companyAddress: string;
  villeEtablissement: string;
  trialPeriodDuration: string;
  weeklyHours: number;
  monthlyGrossSalary: number;
  hourlyRate: number;
  pensionFund: string;
  healthInsurance: string;
  isPolyvalenceActive: boolean;
  mobilityZoneType: "ville" | "departement" | "radius";
  mobilityRadius?: number;
  isTrialRenewable: boolean;
  planningNoticeDays: number;
  planningScheduleGrid?: Record<string, string>;
  mutuelleEmployerShare: number;
  congesCalculMode: "ouvrables" | "ouvres";
  absenceJustificationHours: number;
  preavisMode: "auto" | "custom";
  customPreavisText?: string;
  villeSignature: string;
  dateSignature: string;
  representativeName: string;
  employeeFullName: string;
  montantPanier?: number;
  housingAddress?: string;
  housingValue?: number;
  housingChargesPayer?: "Salarié" | "Employeur";
  housingEvictionDays?: number;
  transportDeadline?: string;
  transportCoveragePercent: number;
  providedEquipment?: string;
  trainingName?: string;
  trainingCenter?: string;
  trainingCost?: number;
  deditDuration?: number;
  nonCompeteDuration?: number;
  nonCompeteRadius?: number;
  nonCompeteZones?: string;
  nonCompeteCompensation?: number;
  delegationMissions?: string;
  cctvLocations?: string;
  requiredDriverLicense?: string;
  protectedSavoirFaire?: string;
  uniformProvidedList?: string;
  laundryAllowance?: number;
  maxComplementaryHoursPercent?: number;
  forfaitJoursMax?: number;
  variableBonusMax?: number;
  variableBonusCriteria?: string;
  posTerminalId?: string;
}

export interface ContractOptions {
  modulation: boolean;
  avantagesRepas: boolean;
  logement: boolean;
  transport: boolean;
  materiel: boolean;
  exclusivite: boolean;
  image: boolean;
  dedit: boolean;
  nonConcurrence: boolean;
  delegation: boolean;
  videosurveillance: boolean;
  permis: boolean;
  confidentialiteRenforcee: boolean;
  tenueTravail: boolean;
  heuresComplementaires: boolean;
  forfaitJours: boolean;
  remunerationVariable: boolean;
  responsabiliteCaisse: boolean;
  charteInformatique: boolean;
  travailleurNuit: boolean;
}

function money(value: number | undefined): string {
  const safeValue = Number.isFinite(value) ? Number(value) : 0;
  return safeValue.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateToFrench(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function replaceVariables(text: string, draft: HcrContractDraft, convention: ConventionRegistryEntry): string {
  const fallbackValues: Partial<Record<keyof HcrContractDraft, string>> = {
    healthInsurance: "l'organisme assureur retenu par l'établissement",
    jobMissions:
      "l'exécution des tâches inhérentes à sa qualification, l'accueil de la clientèle, la participation au bon déroulement du service et l'entretien de son poste de travail selon les normes HACCP",
    pensionFund: "l'institution de retraite complémentaire de branche obligatoire",
  };

  return text.replace(/\{([^}]+)\}/g, (match, expression) => {
    if (expression === "convention.mealOrBenefitArticle.template") {
      let template = convention.mealOrBenefitArticle.template;
      template = template.replace("{MontantPanier}", money(draft.montantPanier));
      return template;
    }

    if (expression === "draft.dateSignature") {
      return formatDateToFrench(draft.dateSignature);
    }

    const cleanKey = expression.replace("draft.", "");
    if (cleanKey in draft) {
      const key = cleanKey as keyof HcrContractDraft;
      const value = draft[key];
      if (key === "monthlyGrossSalary" || key === "hourlyRate" || key === "trainingCost" || key === "nonCompeteCompensation") {
        return money(value as number | undefined);
      }
      if (key === "dateSignature") {
        return formatDateToFrench(String(value));
      }
      if (value == null || value === "") return fallbackValues[key] ?? "";
      return String(value);
    }

    return match;
  });
}

export function getArticlesList(
  draft: HcrContractDraft,
  options: ContractOptions,
  convention: ConventionRegistryEntry
): ContractArticle[] {
  const isOvertimeStructure = draft.weeklyHours > 35;
  const hoursSuppSemaine = isOvertimeStructure ? draft.weeklyHours - 35 : 0;
  const hoursSuppMensuelles = (hoursSuppSemaine * 4.333).toFixed(2);
  const baseSalaryCalculated = (151.67 * draft.hourlyRate).toFixed(2);
  const overtimeSalaryCalculated = (draft.monthlyGrossSalary - parseFloat(baseSalaryCalculated)).toFixed(2);

  const finalMissions = draft.jobMissions && draft.jobMissions.trim() !== ""
    ? draft.jobMissions
    : "l'exécution des tâches inhérentes à sa qualification, l'accueil de la clientèle, la participation active au bon déroulement du service et l'entretien de son poste de travail selon les normes d'hygiène HACCP en vigueur.";
  const finalPension = draft.pensionFund || "l'institution de retraite complémentaire obligatoire de la branche";
  const finalHealth = draft.healthInsurance || "l'organisme assureur retenu par l'établissement";

  let mobilityText = "";
  if (draft.mobilityZoneType === "ville") {
    mobilityText = `dans tout autre établissement de l'entreprise situé dans le même secteur géographique limité à la ville de ${draft.villeEtablissement}.`;
  } else if (draft.mobilityZoneType === "radius") {
    mobilityText = `dans tout autre établissement de l'entreprise situé dans un rayon maximal de **${draft.mobilityRadius ?? 10} kilomètres** autour de l'établissement principal.`;
  } else {
    mobilityText = "dans tout autre établissement de l'entreprise situé dans le même secteur géographique limité au département de l'établissement.";
  }

  let scheduleGridText = "";
  if (draft.weeklyHours < 35 && draft.planningScheduleGrid) {
    scheduleGridText = `\n\nConformément à la législation sur le temps partiel, la répartition de la durée du travail est fixée comme suit :\n${Object.entries(draft.planningScheduleGrid)
      .map(([jour, heures]) => `* **${jour} :** ${heures}`)
      .join("\n")}`;
  }

  return [
    {
      id: "engagement",
      title: "CONDITIONS D'ENGAGEMENT",
      content: "Le présent contrat est conclu sous réserve de la réalisation de la Déclaration Préalable À l'Embauche (DPAE) auprès de l'URSSAF, que l'Employeur certifie avoir effectuée. Il est également soumis au résultat de la Visite d'Information et de Prévention (VIP) obligatoire auprès du Service de Prévention et de Santé au Travail. Pour les salariés de nationalité étrangère (hors UE/EEE), l'engagement est conditionné par la détention et le maintien en validité d'un titre de séjour régulier valant autorisation de travail en France. Le Salarié atteste sur l'honneur être libre de tout engagement professionnel et n'être soumis à aucune clause d'exclusivité.",
      isActive: true,
    },
    {
      id: "missions",
      title: "MISSIONS, CLASSIFICATION ET POLYVALENCE",
      content: `Le Salarié est engagé en qualité de : **{draft.jobTitle}**. Au regard de la grille de classification de la Convention Collective applicable, le poste correspond au Statut : **{draft.status}**, Niveau : **{draft.level}**, Échelon : **{draft.echelon}**.\n\nDans le cadre de ses fonctions, le Salarié sera particulièrement chargé des missions suivantes : ${finalMissions}\n\n${
        draft.isPolyvalenceActive
          ? "Compte tenu de la structure de l'établissement, les parties conviennent d'une clause de polyvalence. Le Salarié pourra être amené à effectuer des tâches connexes, d'entretien ou d'aide pour les nécessités du service sans que cela ne constitue une modification de son contrat."
          : "Le Salarié exécutera de manière exclusive les missions liées à sa qualification de {draft.jobTitle}, sous réserve des directives de sa hiérarchie directe."
      }`,
      isActive: true,
    },
    {
      id: "lieu",
      title: "LIEU DE TRAVAIL ET MOBILITÉ",
      content: `Le lieu de travail du Salarié est fixé à l'adresse suivante : {draft.companyAddress}. Toutefois, pour les besoins de l'exploitation, le Salarié accepte par avance d'être déplacé de manière temporaire ou définitive ${mobilityText}`,
      isActive: true,
    },
    {
      id: "essai",
      title: "PÉRIODE D'ESSAI",
      content: `Le présent contrat ne deviendra définitif qu'après une période d'essai de **{draft.trialPeriodDuration}**. Durant cette période, chacune des parties pourra rompre librement le contrat, sans indemnité d'aucune sorte. Cette rupture est soumise au respect d'un délai de prévenance réciproque obligatoire, calculé conformément aux articles L. 1221-25 et L. 1221-26 du Code du travail (soit 24 heures en deçà de 8 jours de présence, 48 heures entre 8 jours et 1 mois de présence, et 2 semaines après 1 mois de présence). ${
        draft.isTrialRenewable && convention.features.allowTrialRenewal
          ? "Cette période d'essai pourra faire l'objet d'un renouvellement unique d'un commun accord écrit entre les parties, conformément aux dispositions conventionnelles."
          : "Cette période d'essai est ferme et n'est pas renouvelable."
      }`,
      isActive: true,
    },
    {
      id: "duree",
      title: "DURÉE DU TRAVAIL ET HORAIRES",
      content: `La durée hebdomadaire de travail est fixée à **{draft.weeklyHours} heures**. Les horaires de travail sont fixés par la Direction et communiqués au Salarié par voie d'affichage ou via l'outil numérique. En raison des impératifs du secteur, les horaires et jours travaillés sont variables. Les plannings hebdomadaires seront notifiés au Salarié en respectant un délai de prévenance de **{draft.planningNoticeDays} jours**, sauf urgence ou circonstances exceptionnelles.${scheduleGridText}`,
      isActive: true,
    },
    {
      id: "remuneration",
      title: "RÉMUNÉRATION ET VENTILATION",
      content: isOvertimeStructure
        ? `En contrepartie de l'exécution de ses missions, le Salarié percevra une rémunération mensuelle brute lissée de **{draft.monthlyGrossSalary} €**.\n\nAfin de garantir une parfaite transparence conformément à la loi, cette rémunération est ventilée comme suit :\n* **Salaire de base (durée légale de 151,67h) :** ${baseSalaryCalculated} € (soit un taux horaire brut de {draft.hourlyRate} €).\n* **Heures supplémentaires structurelles (mensualisées à ${hoursSuppMensuelles}h) :** ${overtimeSalaryCalculated} € (majorées au taux conventionnel en vigueur).`
        : "En contrepartie de son activité, le Salarié percevra une rémunération mensuelle brute de **{draft.monthlyGrossSalary} €**, correspondant à un taux horaire brut de {draft.hourlyRate} € pour la durée légale de 151,67 heures mensuelles. Les heures supplémentaires éventuellement accomplies au-delà de la durée légale, à la demande expresse de la direction, seront rémunérées et majorées conformément aux dispositions légales et conventionnelles en vigueur.",
      isActive: true,
    },
    {
      id: "assurances",
      title: "ASSURANCES SOCIALES ET RETRAITE",
      content: `Le Salarié est obligatoirement affilié dès son embauche aux régimes de retraite complémentaire (${finalPension}) et de prévoyance collective santé (${finalHealth}) de l'entreprise. Le co-financement des cotisations de santé est assuré par l'Employeur à hauteur de **{draft.mutuelleEmployerShare} %**.`,
      isActive: true,
    },
    {
      id: "conges",
      title: "CONGÉS PAYÉS",
      content: draft.congesCalculMode === "ouvrables"
        ? "Le Salarié acquiert des congés payés au rythme de **2,5 jours ouvrables par mois** de travail effectif, soit **30 jours ouvrables par année complète**. La période de référence s'étend du 1er mai au 30 avril. L'ordre des départs et les dates de congés sont fixés unilatéralement par l'Employeur en fonction des nécessités d'exploitation."
        : "Le Salarié acquiert des congés payés au rythme de **2,08 jours ouvrés par mois** de travail effectif, soit **25 jours ouvrés par année complète**. La période de référence s'étend du 1er mai au 30 avril. L'ordre des départs et les dates de congés sont fixés unilatéralement par l'Employeur en fonction des nécessités de fonctionnement.",
      isActive: true,
    },
    {
      id: "absences",
      title: "ABSENCES ET JUSTIFICATIONS",
      content: "En cas d'absence imprévisible pour maladie ou accident, le Salarié doit obligatoirement en informer la Direction avant l'heure fixée pour sa prise de poste. Il doit impérativement transmettre un justificatif médical (arrêt de travail) dans un délai de **{draft.absenceJustificationHours} heures**. Tout manquement constitue une absence injustifiée exposant à des sanctions disciplinaires.",
      isActive: true,
    },
    {
      id: "obligations",
      title: "OBLIGATIONS PROFESSIONNELLES, IMAGE ET HYGIÈNE",
      content: "Le Salarié s'engage à exécuter ses tâches avec loyauté. Il est soumis à une obligation de discrétion absolue concernant les secrets commerciaux, techniques et recettes de l'établissement. Il s'interdit tout acte de dénigrement sur les réseaux sociaux. Il doit respecter scrupuleusement les consignes d'hygiène et la réglementation HACCP sur la sécurité des aliments.",
      isActive: true,
    },
    {
      id: "rgpd",
      title: "PROTECTION DES DONNÉES PERSONNELLES (RGPD)",
      content: "Le Salarié est informé que ses données personnelles font l'objet d'un traitement automatisé par l'Employeur aux fins de gestion administrative, de l'établissement de la paie, et de la configuration des plannings de travail, conformément aux directives européennes et à la réglementation de la CNIL en vigueur.",
      isActive: true,
    },
    {
      id: "rupture",
      title: "RUPTURE DE CONTRAT ET PRÉAVIS",
      content: draft.preavisMode === "custom" && draft.customPreavisText
        ? draft.customPreavisText
        : "Après expiration de la période d'essai, la rupture du présent contrat à l'initiative de l'une ou l'autre des parties (hors rupture conventionnelle ou cas de force majeure) devra respecter les délais de préavis fixés par la législation et les dispositions conventionnelles en vigueur. Pour le statut sélectionné, ce préavis est fixé réglementairement selon les barèmes de l'ancienneté conventionnelle (sauf cas de licenciement pour faute grave ou lourde). À l'expiration du contrat, l'Employeur remettra au Salarié son reçu pour solde de tout compte, son certificat de travail et son attestation France Travail.",
      isActive: true,
    },
    {
      id: "droit",
      title: "DROIT APPLICABLE",
      content: "Le présent contrat est régi par le droit du travail français. Tout litige relatif à son exécution, son interprétation ou sa rupture sera soumis à la compétence exclusive du Conseil de Prud'hommes du ressort de l'établissement.",
      isActive: true,
    },
    // 1. MODULATION DU TEMPS
    {
      id: "modulation",
      title: "AMÉNAGEMENT ET MODULATION DU TEMPS DE TRAVAIL",
      content: "Conformément aux dispositions conventionnelles en vigueur au sein de l'établissement, les parties conviennent que le temps de travail du Salarié est organisé dans le cadre d'un dispositif de modulation du temps de travail sur une période de référence annuelle.\n\n* **Fluctuations horaires :** La durée hebdomadaire de travail pourra fluctuer entre 0 heure et 48 heures selon les nécessités de l'exploitation et la saisonnalité de l'activité.\n* **Régularisation :** Les heures supplémentaires et les éventuels droits à repos seront décomptés et régularisés uniquement en fin de période de référence, après compensation arithmétique entre les semaines de haute et de basse activité, selon les taux majorés conventionnels.",
      isActive: options.modulation,
    },
    // 2. AVANTAGES REPAS
    {
      id: "avantages_repas",
      title: "FRAIS PROFESSIONNELS ET AVANTAGES REPAS",
      content: "{convention.mealOrBenefitArticle.template}",
      isActive: options.avantagesRepas,
    },
    // 3. LOGEMENT DE FONCTION
    {
      id: "logement",
      title: "LOGEMENT DE FONCTION ET CLAUSE D'ÉVICTION",
      content: "L'Employeur met à disposition du Salarié, à titre précaire et temporaire, un logement situé à : **{draft.housingAddress}**. Cet avantage est consenti exclusivement en raison de l'exécution du présent contrat et lié à la détention du poste.\n\n* **Redevance / Évaluation :** Cet avantage donne lieu à une retenue sur salaire (ou évaluation en nature) d'un montant mensuel brut de **{draft.housingValue} €**.\n* **Frais annexes :** Les charges d'eau, d'électricité et de chauffage sont à la charge exclusive de l'acteur désigné : **{draft.housingChargesPayer}**. Le Salarié s'oblige à souscrire une assurance habitation personnelle et à en fournir l'attestation.\n* **Restitution :** En cas de rupture du contrat, pour quelque motif que ce soit, cet avantage cessera immédiatement. Le Salarié s'engage formellement à libérer les lieux et à restituer les clés dans un délai maximal de **{draft.housingEvictionDays} jours** suivant la notification de la rupture, sans pouvoir se prévaloir des dispositions protectrices du droit au bail d'habitation, ni d'aucun maintien dans les lieux.",
      isActive: options.logement,
    },
    // 4. FRAIS DE TRANSPORT
    {
      id: "transport",
      title: "PRISE EN CHARGE DES FRAIS DE TRANSPORT COLLECTIF",
      content: "En application des dispositions de l'article L. 3261-2 du Code du travail, l'Employeur prendra en charge **{draft.transportCoveragePercent} %** du coût des titres d'abonnements nominatifs souscrits par le Salarié pour l'intégralité du trajet entre sa résidence habituelle et le lieu de travail.\n\n* **Modalités de remboursement :** Le versement sera effectué mensuellement sur le bulletin de paie, sous réserve expresse de la présentation d'un justificatif d'achat valide (reçu, facture ou pass transport actif) transmis à la direction avant le **{draft.transportDeadline}** de chaque mois.\n* **Changement de situation :** Le Salarié s'engage à signaler immédiatement et par écrit toute modification de son lieu de résidence ou de son mode de transport.",
      isActive: options.transport,
    },
    // 5. MATÉRIEL PROFESSIONNEL
    {
      id: "materiel",
      title: "MISE À DISPOSITION DE MATÉRIEL PROFESSIONNEL",
      content: "Pour les besoins exclusifs et impératifs de l'exercice de ses fonctions, l'Entreprise confie au Salarié le matériel professionnel suivant, qui demeure la propriété entière et insaisissable de l'établissement : **{draft.providedEquipment}**.\n\n* **Obligations de garde :** Le Salarié s'engage à maintenir ce matériel en parfait état d'entretien, à l'utiliser de manière strictement professionnelle conformément aux notes de service, et à en assurer la conservation vigilante.\n* **Restitution impérative :** Ce matériel devra être restitué spontanément et en bon état à première demande de l'Employeur, et de plein droit le jour de la cessation effective des fonctions, quel qu'en soit le motif déclencheur.",
      isActive: options.materiel,
    },
    // 6. EXCLUSIVITÉ
    {
      id: "exclusivite",
      title: "EXCLUSIVITÉ DE SERVICE",
      content: "Le Salarié s'engage à consacrer l'exclusivité de son activité professionnelle au service de l'Employeur et s'interdit expressément d'exercer toute autre activité professionnelle, de quelque nature que ce soit, pour son compte ou celui d'un tiers, de manière rémunérée ou bénévole, sauf accord écrit préalable écrit de la direction.",
      isActive: options.exclusivite && draft.weeklyHours >= 35,
    },
    // 7. DROIT À L'IMAGE
    {
      id: "image",
      title: "AUTORISATION DE DROIT À L'IMAGE ET VALORISATION",
      content: "Dans le cadre des actions de communication, de promotion et de valorisation commerciale de l'établissement, le Salarié autorise expressément et à titre gracieux l'Employeur à le photographier, le filmer ou l'enregistrer en situation de travail.\n\n* **Supports d'exploitation autorisés :** Cette autorisation s'apply aux réseaux sociaux officiels de l'établissement (Instagram, TikTok, Facebook), au site internet de l'entreprise, ainsi qu'aux supports physiques internes (menus, flyers, livrets d'accueil).\n* **Garanties :** L'Employeur s'engage à ce que les diffusions ne portent nullement atteinte à la dignité, à la réputation ni à la vie privée du Salarié. Cette autorisation est consentie pour toute la durée d'exécution du présent contrat.",
      isActive: options.image,
    },
    // 8. DÉDIT-FORMATION
    {
      id: "dedit",
      title: "CLAUSE DE DÉDIT-FORMATION ET REMBOURSEMENT",
      content: "En contrepartie du financement intégral par l'Entreprise de la formation spécifique **{draft.trainingName}** dispensée par l'organisme **{draft.trainingCenter}**, d'un coût réel et justifié de **{draft.trainingCost} €**, le Salarié s'engage à mettre ses compétences au service de l'établissement.\n\n* **Durée d'engagement :** Le Salarié s'engage à rester au service de l'entreprise pour une durée minimale de **{draft.deditDuration} mois** à compter de la fin de ladite formation.\n* **Remboursement dégressif :** En cas de rupture du contrat à l'initiative du Salarié (démission) ou pour faute de sa part avant l'expiration de ce délai, le Salarié s'engage à rembourser les frais de formation engagés au prorata du temps restant à courir.",
      isActive: options.dedit,
    },
    // 9. NON-CONCURRENCE
    {
      id: "non_concurrence",
      title: "CLAUSE DE NON-CONCURRENCE ET CONTREPARTIE",
      content: "Compte tenu de la nature des fonctions du Salarié et des connaissances acquises au sein de l'établissement, les parties conviennent d'une clause de non-concurrence en cas de rupture du contrat.\n\n* **Limitation temporelle :** Cette interdiction est fixée pour une durée de **{draft.nonCompeteDuration} mois** à compter de la date de départ effectif.\n* **Limitation géographique :** Le Salarié s'interdit d'exercer une activité concurrente, de s'intéresser directement ou indirectement à un fonds de commerce similaire, dans un rayon de **{draft.nonCompeteRadius} kilomètres** autour de l'établissement ou limité spécifiquement aux territoires suivants : {draft.nonCompeteZones}.\n* **Contrepartie financière :** Pendant toute la durée de l'interdiction, l'Employeur versera mensuellement au Salarié une indemnité brute spéciale égale à **{draft.nonCompeteCompensation} €**. L'Employeur se réserve le droit de lever cette clause sans indemnité sous un délai de 15 jours suivant la rupture.",
      isActive: options.nonConcurrence,
    },
    // 10. DÉLÉGATION DE POUVOIR
    {
      id: "delegation",
      title: "DÉLÉGATION DE POUVOIR ET DE RESPONSABILITÉ OPERATIONNELLE",
      content: "En sa qualité de cadre ou d'agent de maîtrise, le Salarié se voit confier une délégation de pouvoir opérationnelle et permanente. Il assure la responsabilité directe de la conformité réglementaire de l'établissement dans les domaines d'actions suivants : **{draft.delegationMissions}**. Il veillera notamment au respect strict des normes d'hygiène HACCP, de la sécurité du personnel et de la traçabilité des denrées.",
      isActive: options.delegation,
    },
    // 11. VIDÉOSURVEILLANCE
    {
      id: "videosurveillance",
      title: "VIDÉOSURVEILLANCE ET TRANSPARENCE RGPD",
      content: "Le Salarié est formellement informé que l'établissement est équipé d'un système de vidéosurveillance pour la sécurité des biens, des marchandises et des personnes, déclaré en préfecture et conforme aux directives de la CNIL. Des caméras sont implantées de manière fixe dans les zones suivantes : **{draft.cctvLocations}**. Les enregistrements pourront être utilisés comme moyen de preuve en cas de litige ou d'infraction constatée.",
      isActive: options.videosurveillance,
    },
    // 12. PERMIS DE CONDUIRE
    {
      id: "permis",
      title: "PERMIS DE CONDUIRE ET OBLIGATIONS DE SÉCURITÉ VÉHICULE",
      content: "Pour les besoins impératifs de ses missions (livraisons, approvisionnements), le Salarié certifie être titulaire d'un permis de conduire de catégorie **{draft.requiredDriverLicense}** en cours de validité. Il s'engage fermement à maintenir ce titre valide, à respecter le code de la route et à informer immédiatement et par écrit l'Employeur de toute suspension, annulation ou retrait de points affectant son permis.",
      isActive: options.permis,
    },
    // 13. CONFIDENTIALITÉ RENFORCÉE
    {
      id: "confidentialite_renforcee",
      title: "CONFIDENTIALITÉ ET PROTECTION STRICTE DU SAVOIR-FAIRE",
      content: "Le Salarié s'engage à observer le secret professionnel et la confidentialité la plus absolue concernant les éléments exclusifs de l'établissement, identifiés comme suit : **{draft.protectedSavoirFaire}** (notamment les recettes culinaires, les fiches techniques du chef, les tarifs des fournisseurs négociés et les bases de données clients). Tout détournement ou divulgation donnera lieu à des poursuites judiciaires immédiates.",
      isActive: options.confidentialiteRenforcee,
    },
    // 14. TENUE DE TRAVAIL
    {
      id: "tenue_travail",
      title: "TENUE DE TRAVAIL OBLIGATOIRE ET INDEMNITÉ D'ENTRETIEN",
      content: "Le port de la tenue de travail réglementaire fournie par l'établissement est obligatoire pendant l'intégralité des heures de service : **{draft.uniformProvidedList}**. En contrepartie des obligations d'entretien et de nettoyage irréprochables qui incombent au Salarié, l'Employeur versera une indemnité forfaitaire mensuelle de nettoyage d'un montant brut de **{draft.laundryAllowance} €**.",
      isActive: options.tenueTravail,
    },
    // 15. HEURES COMPLÉMENTAIRES (TEMPS PARTIEL)
    {
      id: "heures_complementaires",
      title: "HEURES COMPLÉMENTAIRES ET MAJORATIONS (TEMPS PARTIEL)",
      content: "Conformément aux dispositions conventionnelles, l'Employeur pourra demander au Salarié d'effectuer des heures complémentaires dans la limite maximale de **{draft.maxComplementaryHoursPercent}%** de la durée hebdomadaire contractuelle fixée. Chaque heure complémentaire accomplie donnera lieu à une majoration de salaire brute conformément aux taux légaux de la branche.",
      isActive: options.heuresComplementaires && draft.weeklyHours < 35,
    },
    // 16. FORFAIT JOURS
    {
      id: "forfait_jours",
      title: "CONVENTION DE FORFAIT EN JOURS ANNUELS (CADRES AUTONOMES)",
      content: "Conformément aux dispositions de l'Avenant n°1 du 13 juillet 2004 à la Convention Collective applicable, les parties conviennent que la durée du travail du Salarié est organisée sous forme d'une convention de forfait annuel fixé à **{draft.forfaitJoursMax} jours** de travail par année civile complète. Le Salarié gère librement l'organisation de son temps de travail. L'Employeur assurera un suivi régulier de la charge de travail via un entretien annuel dédié, garantissant le respect des repos quotidiens (11h) et hebdomadaires (35h).",
      isActive: options.forfaitJours && draft.status === 'executive',
    },
    // 17. RÉMUNÉRATION VARIABLE
    {
      id: "remuneration_variable",
      title: "RÉMUNÉRATION VARIABLE, OBJECTIFS ET PERFORMANCE",
      content: "En complément de son salaire fixe, le Salarié pourra percevoir une prime de rémunération variable d'un montant maximum de **{draft.variableBonusMax} €** par période, indexée sur la réalisation d'objectifs précis, mesurables et réalistes définis par la direction. Les critères de performance retenus pour la période en cours sont les suivants : **{draft.variableBonusCriteria}**.",
      isActive: options.remunerationVariable,
    },
    // 18. RESPONSABILITÉ DE CAISSE
    {
      id: "responsabilite_caisse",
      title: "RESPONSABILITÉ DE CAISSE ET MANIEMENT DE FONDS",
      content: "Dans le cadre de ses fonctions, le Salarié est amené à manipuler des fonds et à utiliser le terminal de caisse enregistré sous l'identifiant : **{draft.posTerminalId}**. Le Salarié s'engage à respecter scrupuleusement la procédure interne de comptage de son fond de caisse à la prise de poste et de clôture en fin de shift. Il est formellement interdit de confier son code d'accès personnel ou l'accès physique à son tiroir-caisse à un tiers. Tout écart ou anomalie constatée devra être immédiatement consigné et signalé à la direction.",
      isActive: options.responsabiliteCaisse,
    },
    // 19. CHARTE INFORMATIQUE
    {
      id: "charte_informatique",
      title: "UTILISATION DU SYSTÈME INFORMATIQUE ET D'INTERNET",
      content: "Le matériel informatique, les tablettes d'encaissement et le réseau Wi-Fi de l'établissement sont mis à disposition du Salarié pour un usage strictement et exclusivement professionnel. Le Salarié s'interdit d'extraire, copier ou transmettre des données de l'entreprise (fichiers clients, recettes, tarifs fournisseurs). Tout téléchargement illégal ou utilisation frauduleuse de la connexion internet engagera la responsabilité civile et pénale exclusive du Salarié, conformément aux réglementations de l'Arcom.",
      isActive: options.charteInformatique,
    },
    // 20. TRAVAILLEUR DE NUIT
    {
      id: "travailleur_nuit",
      title: "STATUT DE TRAVAILLEUR DE NUIT STIPULÉ",
      content: "Compte tenu des horaires d'ouverture et d'exploitation de l'établissement, le Salarié accomplit de manière régulière son service sur la plage horaire légale de nuit (entre 22h00 et 07h00). Il bénéficie à ce titre du statut de travailleur de nuit. En contrepartie, le Salarié acquiert un droit à repos compensateur de nuit obligatoire calculé selon les modalités de la Convention Collective applicable, et fera l'objet d'un suivi médical renforcé auprès du Service de Prévention et de Santé au Travail.",
      isActive: options.travailleurNuit,
    },
    {
      id: "temps_partiel_verrou",
      title: "TEMPS PARTIEL ET CUMUL D'EMPLOIS",
      content: "Le Salarié atteste formellement que le cumul de ses éventuelles activités professionnelles parallèles ne le conduit pas à dépasser les durées maximales légales du travail fixées par le droit français (soit 48 heures au cours d'une même semaine et 10 heures quotidiennes). Le Salarié s'engage à notifier immédiatement l'Employeur de toute modification de sa situation pluridisciplinaire.",
      isActive: draft.weeklyHours < 35,
    },
  ];
}

function buildTermSummary(draft: WizardContractDraft): string {
  const term = draft.termDetails;
  if (!term) return "";

  const lines: string[] = [];

  if (draft.contractKind === "cdd" || draft.contractKind === "saisonnier") {
    lines.push(
      draft.contractKind === "saisonnier"
        ? "**Nature :** contrat saisonnier"
        : "**Nature :** contrat à durée déterminée (CDD)"
    );
    if (term.reason) {
      const reasonLabel = HCR_CDD_REASONS[term.reason]?.label;
      if (reasonLabel) lines.push(`**Motif :** ${reasonLabel}`);
    }
    if (term.replacedEmployeeName?.trim()) {
      const replaced = term.replacedEmployeePosition?.trim()
        ? `${term.replacedEmployeeName} (${term.replacedEmployeePosition})`
        : term.replacedEmployeeName;
      lines.push(`**Salarié remplacé :** ${replaced}`);
    }
    if (term.hasUncertainTerm) {
      lines.push("**Durée :** terme imprécis");
    } else if (term.endDate) {
      lines.push(`**Date de fin de contrat :** ${formatDateToFrench(term.endDate)}`);
    }
    if (term.minimumDuration?.trim()) {
      lines.push(`**Durée minimale :** ${term.minimumDuration}`);
    }
  }

  if (draft.contractKind === "extra") {
    if (term.extraMission?.trim()) lines.push(`**Mission :** ${term.extraMission}`);
    if (term.extraDates?.trim()) lines.push(`**Date(s) :** ${term.extraDates}`);
    if (term.banquetDate?.trim()) lines.push(`**Date du banquet :** ${term.banquetDate}`);
  }

  return lines.length > 0 ? lines.join("\n") : "";
}

/** Identification des parties — lien employeur / salarié en tête de contrat. */
export function buildContractPreamble(draft: WizardContractDraft, convention: ConventionRegistryEntry): string {
  const employer = draft.employer;
  const employee = draft.employee;
  const legalFormPart = employer.legalForm.trim() ? `, ${employer.legalForm.trim()}` : "";

  const employerBlock = [
    "**L'EMPLOYEUR :**",
    `${employer.legalName || employer.companyName}${legalFormPart}, immatriculée au Registre du Commerce et des Sociétés sous le numéro SIRET **${employer.siret}**, dont l'établissement est situé **${employer.address}**, URSSAF de rattachement : **${employer.urssafOffice}**, représentée par **${employer.representativeName}**, en sa qualité de **${employer.representativeRole || "Gérant"}**, dûment habilité(e) aux fins des présentes,`,
    "Ci-après dénommée **« l'Employeur »**,",
  ].join("\n");

  const birthPart = employee.birthDate
    ? `, né(e) le **${formatDateToFrench(employee.birthDate)}**${employee.birthPlace?.trim() ? ` à **${employee.birthPlace.trim()}**` : ""}`
    : "";

  const employeeBlock = [
    "**LE SALARIÉ :**",
    `**${employee.firstName} ${employee.lastName}**, demeurant **${employee.address}**, de nationalité **${employee.nationality}**${birthPart}, immatriculé(e) à la Sécurité sociale sous le n° **${employee.socialSecurityNumber}**,`,
    "Ci-après dénommé(e) **« le Salarié »**,",
  ].join("\n");

  const effectDate = draft.termDetails?.startDate || draft.signatureDate;
  const effectLine = effectDate
    ? `Le présent contrat prendra effet le **${formatDateToFrench(effectDate)}**.`
    : "";

  const termSummary = buildTermSummary(draft);

  return [
    `## ${CONTRACT_KIND_LABELS[draft.contractKind]}`,
    `### ${convention.headerLabel}`,
    `#### **ENTRE LES SOUSSIGNÉS**`,
    "D'une part,",
    employerBlock,
    "Et d'autre part,",
    employeeBlock,
    termSummary || null,
    effectLine || null,
    `Les parties déclarent vouloir contracter dans le cadre du Code du travail et de la **${convention.fullLabel}** (IDCC **${convention.idcc}**).`,
    "**IL A ÉTÉ CONVENU CE QUI SUIT :**",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function renderContractArticles(
  draft: HcrContractDraft,
  options: ContractOptions,
  convention: ConventionRegistryEntry
): string {
  const rawArticles = getArticlesList(draft, options, convention);
  const articlesContent = rawArticles
    .filter((article) => article.isActive)
    .map((article, index) => {
      const cleanTitle = article.title.replace(/^ARTICLE\s+\d+\s*—\s*/i, "").trim();
      const localizedContent = replaceVariables(article.content.trim(), draft, convention);
      return `#### **ARTICLE ${index + 1} — ${cleanTitle}**\n${localizedContent.trim()}`;
    })
    .join("\n\n");

  const footer = `\n\n***\n\nFait en deux exemplaires originaux, à **${draft.villeSignature}**, le **${formatDateToFrench(draft.dateSignature)}**.\n\n*(La mention manuscrite 'Lu et approuvé' est obligatoire avant la signature)*\n\n**Pour l'Employeur** — ${draft.representativeName || "Le Gérant"} | **Le Salarié** — ${draft.employeeFullName}\n[Signature et cachet] | [Signature]`;

  return `${articlesContent}${footer}`;
}

function markdownInlineToHtml(value: string): string {
  return value
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
}

function markdownToContractHtml(markdown: string): string {
  const blocks = markdown.split("\n\n");
  const html: string[] = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]!;
    const safe = block
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

    if (safe.startsWith("# ")) {
      html.push(`<h1>${markdownInlineToHtml(safe.slice(2))}</h1>`);
    } else if (safe.startsWith("## ")) {
      html.push(`<h2>${markdownInlineToHtml(safe.slice(3))}</h2>`);
    } else if (safe.startsWith("### ")) {
      html.push(`<h3>${markdownInlineToHtml(safe.slice(4))}</h3>`);
    } else if (safe.startsWith("#### ")) {
      html.push(`<h4>${markdownInlineToHtml(safe.slice(5))}</h4>`);
    } else if (safe === "---") {
      html.push("<hr />");
    } else if (safe.includes("\n| --- |")) {
      const rows = safe.split("\n").filter((row) => !row.includes("---"));
      html.push(
        `<table>${rows
          .map((row) => {
            const cells = row.split("|").map((cell) => cell.trim()).filter(Boolean);
            return `<tr>${cells.map((cell) => `<td>${markdownInlineToHtml(cell)}</td>`).join("")}</tr>`;
          })
          .join("")}</table>`
      );
    } else if (safe.includes("\n* ")) {
      const lines = safe.split("\n");
      const first = lines.shift();
      if (first) html.push(`<p>${markdownInlineToHtml(first)}</p>`);
      html.push(
        `<ul>${lines
          .filter((line) => line.startsWith("* "))
          .map((line) => `<li>${markdownInlineToHtml(line.slice(2))}</li>`)
          .join("")}</ul>`
      );
    } else {
      html.push(`<p>${markdownInlineToHtml(safe.replaceAll("\n", "<br />"))}</p>`);
    }
  }

  return html.join("\n");
}

function cityFromAddress(address: string): string {
  const postalMatch = /\b\d{5}\s+([^,\n]+)/.exec(address);
  if (postalMatch?.[1]) return postalMatch[1].trim();
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? "";
}

function adaptWizardDraft(draft: WizardContractDraft, convention: ConventionRegistryEntry): HcrContractDraft {
  return {
    jobTitle: draft.jobAndPay.jobTitle,
    status: draft.jobAndPay.status,
    level: draft.jobAndPay.level,
    echelon: draft.jobAndPay.echelon,
    jobMissions: draft.jobAndPay.missions,
    companyAddress: draft.employer.address,
    villeEtablissement: cityFromAddress(draft.employer.address),
    trialPeriodDuration: `${draft.clauses.trialPeriodValue} ${draft.clauses.trialPeriodUnit}`,
    weeklyHours: draft.jobAndPay.weeklyHours,
    monthlyGrossSalary: draft.jobAndPay.monthlyGross,
    hourlyRate: draft.jobAndPay.hourlyRateGross,
    pensionFund: draft.employer.retirementFund,
    healthInsurance: draft.employer.healthProvider,
    housingAddress: draft.clauses.housingAddress,
    housingValue: draft.clauses.housingValue,
    housingChargesPayer: draft.clauses.housingChargesPayer,
    housingEvictionDays: draft.clauses.housingEvictionDays,
    transportDeadline: draft.clauses.transportDeadline,
    transportCoveragePercent: Math.max(draft.clauses.transportCoveragePercent ?? 50, 50),
    providedEquipment: draft.clauses.providedEquipment || draft.clauses.workClothesDescription,
    trainingName: draft.clauses.trainingName,
    trainingCenter: draft.clauses.trainingCenter,
    trainingCost: draft.clauses.trainingCost,
    deditDuration: draft.clauses.deditDuration,
    nonCompeteDuration: draft.clauses.nonCompeteDuration,
    nonCompeteRadius: draft.clauses.nonCompeteRadius,
    nonCompeteZones: draft.clauses.nonCompeteZones,
    nonCompeteCompensation:
      draft.clauses.nonCompeteCompensation ?? (Number(draft.clauses.nonCompeteFinancialCompensation) || undefined),
    montantPanier: draft.clauses.mealBasketAmount,
    villeSignature: draft.signatureCity,
    dateSignature: draft.signatureDate,
    representativeName: draft.employer.representativeName,
    employeeFullName: `${draft.employee.firstName} ${draft.employee.lastName}`.trim(),
    isPolyvalenceActive: draft.clauses.isPolyvalenceActive,
    mobilityZoneType: draft.clauses.mobilityZoneType,
    mobilityRadius: draft.clauses.mobilityRadius,
    isTrialRenewable: draft.clauses.isTrialRenewable && convention.features.allowTrialRenewal,
    planningNoticeDays: draft.clauses.planningNoticeDays || convention.features.defaultPlanningNoticeDays,
    planningScheduleGrid: draft.clauses.planningScheduleGrid,
    mutuelleEmployerShare: Math.max(draft.clauses.mutuelleEmployerShare || 0, convention.features.minMutuelleEmployerShare),
    congesCalculMode: draft.clauses.congesCalculMode,
    absenceJustificationHours: draft.clauses.absenceJustificationHours || convention.features.defaultAbsenceJustificationHours,
    preavisMode: convention.features.preavisCalculMode === "auto" ? "auto" : draft.clauses.preavisMode,
    customPreavisText: draft.clauses.customPreavisText,
    delegationMissions: draft.clauses.delegationMissions,
    cctvLocations: draft.clauses.cctvLocations,
    requiredDriverLicense: draft.clauses.requiredDriverLicense,
    protectedSavoirFaire: draft.clauses.protectedSavoirFaire,
    uniformProvidedList: draft.clauses.uniformProvidedList,
    laundryAllowance: draft.clauses.laundryAllowance,
    maxComplementaryHoursPercent: draft.clauses.maxComplementaryHoursPercent,
    forfaitJoursMax: draft.clauses.forfaitJoursMax,
    variableBonusMax: draft.clauses.variableBonusMax,
    variableBonusCriteria: draft.clauses.variableBonusCriteria,
    posTerminalId: draft.clauses.posTerminalId,
  };
}

function adaptWizardOptions(draft: WizardContractDraft): ContractOptions {
  return {
    modulation: draft.clauses.workingTimeModulation,
    avantagesRepas: draft.clauses.mealBenefits,
    logement: draft.clauses.logement,
    transport: draft.clauses.transport,
    materiel: draft.clauses.materiel || draft.clauses.workClothes,
    exclusivite: draft.clauses.exclusivite,
    image: draft.clauses.image,
    dedit: draft.clauses.dedit,
    nonConcurrence: draft.clauses.nonCompete,
    delegation: draft.clauses.delegation,
    videosurveillance: draft.clauses.videosurveillance,
    permis: draft.clauses.permis,
    confidentialiteRenforcee: draft.clauses.confidentialiteRenforcee,
    tenueTravail: draft.clauses.tenueTravail,
    heuresComplementaires: draft.clauses.heuresComplementaires,
    forfaitJours: draft.clauses.forfaitJours,
    remunerationVariable: draft.clauses.remunerationVariable,
    responsabiliteCaisse: draft.clauses.responsabiliteCaisse,
    charteInformatique: draft.clauses.charteInformatique,
    travailleurNuit: draft.clauses.travailleurNuit,
  };
}

export function buildContractDocument(draft: WizardContractDraft): HcrGeneratedDocument {
  const validationIssues: HcrValidationIssue[] = validateContractDraft(draft);
  const convention = getConventionConfig(draft.employer.collectiveAgreementIdcc);
  const adapted = adaptWizardDraft(draft, convention);
  const options = adaptWizardOptions(draft);
  const preamble = buildContractPreamble(draft, convention);
  const articles = renderContractArticles(adapted, options, convention);
  const markdown = `${preamble}\n\n${articles}`;

  return {
    title: `${draft.contractKind.toUpperCase()} - ${draft.employee.firstName} ${draft.employee.lastName}`.trim(),
    markdown,
    html: markdownToContractHtml(markdown),
    validationIssues,
  };
}
