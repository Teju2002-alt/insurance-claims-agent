// src/validator.js
// Identifies missing mandatory fields and inconsistencies in extracted FNOL data

/**
 * All mandatory fields that must be present for a complete FNOL
 */
const MANDATORY_FIELDS = [
  { key: "policyNumber",       label: "Policy Number",          section: "Policy Information" },
  { key: "policyholderName",   label: "Policyholder Name",      section: "Policy Information" },
  { key: "effectiveDateStart", label: "Policy Effective Date",  section: "Policy Information" },
  { key: "incidentDate",       label: "Incident Date",          section: "Incident Information" },
  { key: "incidentTime",       label: "Incident Time",          section: "Incident Information" },
  { key: "incidentLocation",   label: "Incident Location",      section: "Incident Information" },
  { key: "incidentDescription",label: "Incident Description",   section: "Incident Information" },
  { key: "claimantName",       label: "Claimant Name",          section: "Involved Parties" },
  { key: "claimantPhone",      label: "Claimant Phone",         section: "Involved Parties" },
  { key: "assetType",          label: "Asset Type",             section: "Asset Details" },
  { key: "assetId",            label: "Asset ID",               section: "Asset Details" },
  { key: "estimatedDamage",    label: "Estimated Damage",       section: "Asset Details" },
  { key: "claimType",          label: "Claim Type",             section: "Claim Details" },
  { key: "attachments",        label: "Attachments",            section: "Claim Details" },
  { key: "initialEstimate",    label: "Initial Estimate",       section: "Claim Details" },
];

/**
 * Keywords that indicate potential fraud or investigation concerns
 */
const FRAUD_KEYWORDS = [
  "fraud",
  "fraudulent",
  "staged",
  "inconsistent",
  "suspicious",
  "fabricated",
  "false claim",
  "misrepresentation",
  "arson",
  "deliberately",
  "mysterious",
  "absconding",
];

/**
 * Check if a field value is considered missing/null
 */
function isMissing(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (
    typeof value === "string" &&
    (value.includes("[NOT PROVIDED]") || value.toLowerCase() === "not provided")
  )
    return true;
  return false;
}

/**
 * Validate extracted fields and return missing fields + inconsistencies
 * @param {Object} extracted - Fields extracted by the extractor
 * @returns {Object} { missingFields, inconsistencies, fraudFlags }
 */
function validateFields(extracted) {
  const missingFields = [];
  const inconsistencies = [];
  const fraudFlags = [];

  // Check mandatory fields
  for (const field of MANDATORY_FIELDS) {
    if (isMissing(extracted[field.key])) {
      missingFields.push({
        field: field.key,
        label: field.label,
        section: field.section,
      });
    }
  }

  // Check for inconsistencies
  // 1. Estimated damage vs initial estimate mismatch (>20% difference)
  if (
    extracted.estimatedDamage &&
    extracted.initialEstimate &&
    typeof extracted.estimatedDamage === "number" &&
    typeof extracted.initialEstimate === "number"
  ) {
    const diff = Math.abs(extracted.estimatedDamage - extracted.initialEstimate);
    const pct = (diff / Math.max(extracted.estimatedDamage, extracted.initialEstimate)) * 100;
    if (pct > 20) {
      inconsistencies.push(
        `Estimated damage (${extracted.estimatedDamageRaw}) differs significantly from initial estimate (${extracted.initialEstimateRaw}) by ${pct.toFixed(1)}%`
      );
    }
  }

  // 2. Incident date in the future
  if (extracted.incidentDate) {
    const parsedDate = new Date(extracted.incidentDate);
    if (!isNaN(parsedDate) && parsedDate > new Date()) {
      inconsistencies.push(
        `Incident date "${extracted.incidentDate}" appears to be in the future`
      );
    }
  }

  // 3. Attachments flagged as missing but initial estimate is high
  if (
    (extracted.attachments === false || extracted.attachments === "partial") &&
    extracted.estimatedDamage > 100000
  ) {
    inconsistencies.push(
      `High-value claim (${extracted.estimatedDamageRaw}) with missing or partial attachments`
    );
  }

  // Check description for fraud keywords
  const descriptionToCheck = [
    extracted.incidentDescription || "",
    extracted.attachmentDetails || "",
  ]
    .join(" ")
    .toLowerCase();

  for (const keyword of FRAUD_KEYWORDS) {
    if (descriptionToCheck.includes(keyword.toLowerCase())) {
      fraudFlags.push(keyword);
    }
  }

  return { missingFields, inconsistencies, fraudFlags };
}

module.exports = { validateFields, MANDATORY_FIELDS, FRAUD_KEYWORDS };
