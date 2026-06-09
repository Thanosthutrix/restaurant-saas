import { HCR_CDD_REASONS, minimumHourlyWageFor } from "./hcrLegislation";
import { getConventionConfig } from "./conventionRegistry";
import { calculateTrialPeriodLimit } from "./trialPeriod";
import type { HcrContractDraft, HcrValidationIssue } from "./types";

function required(value: string | undefined | null): boolean {
  return value != null && value.trim().length > 0;
}

function pushRequired(issues: HcrValidationIssue[], path: string, label: string, value: string | undefined | null) {
  if (!required(value)) {
    issues.push({ path, message: `${label} est obligatoire.`, severity: "blocking" });
  }
}

function pushRequiredPositiveNumber(
  issues: HcrValidationIssue[],
  path: string,
  label: string,
  value: number | undefined | null
) {
  if (!Number.isFinite(value) || Number(value) <= 0) {
    issues.push({ path, message: `${label} est obligatoire.`, severity: "blocking" });
  }
}

export function validateContractDraft(draft: HcrContractDraft): HcrValidationIssue[] {
  const issues: HcrValidationIssue[] = [];
  const convention = getConventionConfig(draft.employer.collectiveAgreementIdcc);

  pushRequired(issues, "employer.legalName", "La raison sociale de l'employeur", draft.employer.legalName);
  pushRequired(issues, "employer.siret", "Le SIRET", draft.employer.siret);
  pushRequired(issues, "employer.urssafOffice", "L'URSSAF de rattachement", draft.employer.urssafOffice);
  pushRequired(issues, "employer.address", "L'adresse de l'entreprise", draft.employer.address);
  pushRequired(issues, "employer.representativeName", "Le représentant légal", draft.employer.representativeName);
  pushRequired(issues, "employer.retirementFund", "La caisse de retraite", draft.employer.retirementFund);
  pushRequired(issues, "employer.healthProvider", "L'organisme de prévoyance/mutuelle", draft.employer.healthProvider);

  pushRequired(issues, "employee.firstName", "Le prénom du salarié", draft.employee.firstName);
  pushRequired(issues, "employee.lastName", "Le nom du salarié", draft.employee.lastName);
  pushRequired(issues, "employee.address", "L'adresse du salarié", draft.employee.address);
  pushRequired(issues, "employee.socialSecurityNumber", "Le numéro de sécurité sociale", draft.employee.socialSecurityNumber);
  pushRequired(issues, "employee.nationality", "La nationalité du salarié", draft.employee.nationality);

  pushRequired(issues, "jobAndPay.jobTitle", "L'intitulé du poste", draft.jobAndPay.jobTitle);
  pushRequired(issues, "jobAndPay.missions", "Les missions exactes attendues", draft.jobAndPay.missions);
  if (!Number.isFinite(draft.jobAndPay.weeklyHours) || draft.jobAndPay.weeklyHours <= 0) {
    issues.push({ path: "jobAndPay.weeklyHours", message: "Le volume hebdomadaire doit être supérieur à 0.", severity: "blocking" });
  }
  if (!Number.isFinite(draft.jobAndPay.hourlyRateGross) || draft.jobAndPay.hourlyRateGross <= 0) {
    issues.push({ path: "jobAndPay.hourlyRateGross", message: "Le taux horaire brut est obligatoire.", severity: "blocking" });
  }

  const minimum = minimumHourlyWageFor(draft.jobAndPay.level, draft.jobAndPay.echelon);
  if (minimum != null && draft.jobAndPay.hourlyRateGross < minimum) {
    issues.push({
      path: "jobAndPay.hourlyRateGross",
      message: `Le taux horaire est inférieur au minimum HCR indicatif (${minimum.toFixed(2)} €).`,
      severity: "blocking",
    });
  }

  if (draft.contractKind === "cdd") {
    const term = draft.termDetails;
    if (!term) {
      issues.push({ path: "termDetails", message: "Les informations CDD sont obligatoires.", severity: "blocking" });
    } else {
      if (!term.reason) {
        issues.push({ path: "termDetails.reason", message: "Le motif précis du CDD est obligatoire.", severity: "blocking" });
      } else if (HCR_CDD_REASONS[term.reason]?.requiresReplacementName) {
        pushRequired(issues, "termDetails.replacedEmployeeName", "Le nom du salarié remplacé", term.replacedEmployeeName);
        pushRequired(issues, "termDetails.replacedEmployeePosition", "Le poste du salarié remplacé", term.replacedEmployeePosition);
      }
      pushRequired(issues, "termDetails.startDate", "La date de début", term.startDate);
      if (term.hasUncertainTerm) {
        pushRequired(issues, "termDetails.minimumDuration", "La durée minimale", term.minimumDuration);
      } else {
        pushRequired(issues, "termDetails.endDate", "La date de fin", term.endDate);
      }
    }
  }

  if (draft.contractKind === "saisonnier") {
    const term = draft.termDetails;
    if (!term) {
      issues.push({ path: "termDetails", message: "Les informations du contrat saisonnier sont obligatoires.", severity: "blocking" });
    } else {
      pushRequired(issues, "termDetails.startDate", "La date de début", term.startDate);
      pushRequired(issues, "termDetails.endDate", "La date de fin", term.endDate);
    }
  }

  if (draft.contractKind === "extra") {
    const term = draft.termDetails;
    if (!term) {
      issues.push({ path: "termDetails", message: "Les informations du contrat Extra sont obligatoires.", severity: "blocking" });
    } else {
      pushRequired(issues, "termDetails.extraDates", "Les dates de l'Extra", term.extraDates);
      pushRequired(issues, "termDetails.extraMission", "La mission de l'Extra", term.extraMission);
    }
  }

  if (draft.clauses.trialPeriod) {
    const limit = calculateTrialPeriodLimit(draft);
    if (!limit.canCalculate) {
      issues.push({
        path: "clauses.trialPeriodValue",
        message: limit.label,
        severity: "blocking",
      });
    }
    if (!Number.isFinite(draft.clauses.trialPeriodValue) || draft.clauses.trialPeriodValue < 0) {
      issues.push({
        path: "clauses.trialPeriodValue",
        message: "La période d'essai doit être un nombre positif ou nul.",
        severity: "blocking",
      });
    } else if (draft.clauses.trialPeriodUnit !== limit.unit || draft.clauses.trialPeriodValue > limit.maxValue) {
      issues.push({
        path: "clauses.trialPeriodValue",
        message: `La période d'essai saisie dépasse le plafond autorisé (${limit.maxValue} ${limit.unit}).`,
        severity: "blocking",
      });
    }
  }

  if (draft.clauses.nonCompete) {
    pushRequiredPositiveNumber(
      issues,
      "clauses.nonCompeteDuration",
      "La durée de la clause de non-concurrence",
      draft.clauses.nonCompeteDuration
    );
    pushRequiredPositiveNumber(
      issues,
      "clauses.nonCompeteRadius",
      "Le rayon géographique de la clause de non-concurrence",
      draft.clauses.nonCompeteRadius
    );
    pushRequiredPositiveNumber(
      issues,
      "clauses.nonCompeteCompensation",
      "La contrepartie financière mensuelle de la clause de non-concurrence",
      draft.clauses.nonCompeteCompensation
    );
  }

  if (draft.clauses.logement) {
    pushRequired(issues, "clauses.housingAddress", "L'adresse précise du logement de fonction", draft.clauses.housingAddress);
  }

  if (draft.clauses.transport) {
    pushRequired(
      issues,
      "clauses.transportDeadline",
      "La date limite de remise des justificatifs de transport",
      draft.clauses.transportDeadline
    );
    if ((draft.clauses.transportCoveragePercent ?? 50) < 50) {
      issues.push({
        path: "clauses.transportCoveragePercent",
        message: "Le taux de prise en charge des transports ne peut pas être inférieur à 50 %.",
        severity: "blocking",
      });
    }
  }

  if (draft.clauses.materiel) {
    pushRequired(issues, "clauses.providedEquipment", "La liste du matériel professionnel fourni", draft.clauses.providedEquipment);
  }

  if (draft.clauses.exclusivite && draft.jobAndPay.weeklyHours < 35) {
    issues.push({
      path: "clauses.exclusivite",
      message: "La clause d'exclusivité est interdite pour un contrat à temps partiel.",
      severity: "blocking",
    });
  }

  if (draft.clauses.dedit) {
    pushRequired(issues, "clauses.trainingName", "L'intitulé de la formation financée", draft.clauses.trainingName);
    pushRequired(issues, "clauses.trainingCenter", "L'organisme de formation", draft.clauses.trainingCenter);
    pushRequiredPositiveNumber(issues, "clauses.trainingCost", "Le coût de la formation", draft.clauses.trainingCost);
    pushRequiredPositiveNumber(issues, "clauses.deditDuration", "La durée d'engagement de la clause de dédit-formation", draft.clauses.deditDuration);
  }

  if (draft.clauses.delegation) {
    pushRequired(issues, "clauses.delegationMissions", "Les missions couvertes par la délégation de pouvoir", draft.clauses.delegationMissions);
  }

  if (draft.clauses.videosurveillance) {
    pushRequired(issues, "clauses.cctvLocations", "Les zones concernées par la vidéosurveillance", draft.clauses.cctvLocations);
  }

  if (draft.clauses.confidentialiteRenforcee) {
    pushRequired(
      issues,
      "clauses.protectedSavoirFaire",
      "Le savoir-faire protégé par la confidentialité renforcée",
      draft.clauses.protectedSavoirFaire
    );
  }

  if (draft.clauses.tenueTravail) {
    pushRequired(issues, "clauses.uniformProvidedList", "La liste des tenues de travail fournies ou imposées", draft.clauses.uniformProvidedList);
  }

  if (draft.clauses.heuresComplementaires) {
    if (draft.jobAndPay.weeklyHours >= 35) {
      issues.push({
        path: "clauses.heuresComplementaires",
        message: "Les heures complémentaires sont réservées aux contrats à temps partiel.",
        severity: "blocking",
      });
    }
    if ((draft.clauses.maxComplementaryHoursPercent ?? 0) > 10) {
      issues.push({
        path: "clauses.maxComplementaryHoursPercent",
        message: "Le plafond des heures complémentaires ne peut pas dépasser 10 %.",
        severity: "blocking",
      });
    }
  }

  if (draft.clauses.forfaitJours && draft.jobAndPay.status !== "executive") {
    issues.push({
      path: "clauses.forfaitJours",
      message: "La clause de forfait jours est réservée aux salariés cadres.",
      severity: "blocking",
    });
  }

  if (draft.clauses.remunerationVariable) {
    pushRequiredPositiveNumber(issues, "clauses.variableBonusMax", "Le plafond de rémunération variable", draft.clauses.variableBonusMax);
    pushRequired(issues, "clauses.variableBonusCriteria", "Les critères objectifs de rémunération variable", draft.clauses.variableBonusCriteria);
  }

  if (draft.clauses.responsabiliteCaisse) {
    pushRequired(issues, "clauses.posTerminalId", "L'identifiant de caisse ou TPE", draft.clauses.posTerminalId);
  }

  if (convention.mealOrBenefitArticle.requiredVariables?.includes("MontantPanier")) {
    if (!Number.isFinite(draft.clauses.mealBasketAmount) || draft.clauses.mealBasketAmount <= 0) {
      issues.push({
        path: "clauses.mealBasketAmount",
        message: "Le montant du panier repas est obligatoire pour la Restauration Rapide.",
        severity: "blocking",
      });
    }
  }

  if (draft.clauses.mutuelleEmployerShare < convention.features.minMutuelleEmployerShare) {
    issues.push({
      path: "clauses.mutuelleEmployerShare",
      message: `La part patronale mutuelle ne peut pas être inférieure à ${convention.features.minMutuelleEmployerShare} %.`,
      severity: "blocking",
    });
  }

  pushRequired(issues, "signatureCity", "La ville de signature", draft.signatureCity);
  pushRequired(issues, "signatureDate", "La date de signature", draft.signatureDate);

  issues.push({
    path: "legal.review",
    message: "Les constantes juridiques HCR doivent être vérifiées avant signature.",
    severity: "warning",
  });

  return issues;
}
