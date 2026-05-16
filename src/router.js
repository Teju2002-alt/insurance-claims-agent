// src/router.js
// Applies deterministic routing rules to classify claims and assign workflows

const ROUTES = {
  INVESTIGATION_FLAG: "Investigation Flag",
  SPECIALIST_QUEUE:   "Specialist Queue",
  MANUAL_REVIEW:      "Manual Review",
  FAST_TRACK:         "Fast-Track",
  STANDARD_REVIEW:    "Standard Review",
};

const FAST_TRACK_THRESHOLD = 25000; // INR

/**
 * Determine the recommended route for a claim based on extracted data and validation results
 *
 * Priority order (highest to lowest):
 *   1. Investigation Flag  — fraud keywords detected
 *   2. Specialist Queue    — claim type is injury
 *   3. Manual Review       — mandatory fields missing
 *   4. Fast-Track          — complete + damage < 25,000
 *   5. Standard Review     — complete + damage >= 25,000
 *
 * @param {Object} extracted     - Fields from extractor
 * @param {Object} validation    - Results from validator { missingFields, inconsistencies, fraudFlags }
 * @returns {Object} { route, reasoning, rulesFired }
 */
function routeClaim(extracted, validation) {
  const { missingFields, inconsistencies, fraudFlags } = validation;
  const rulesFired = [];
  const reasoningParts = [];

  // ─── Rule 1: Investigation Flag ───────────────────────────────────────────
  if (fraudFlags.length > 0) {
    rulesFired.push("FRAUD_KEYWORDS_DETECTED");
    reasoningParts.push(
      `Fraud indicators detected in claim description: [${fraudFlags.join(", ")}]. ` +
      `This claim requires immediate investigation before any payout.`
    );
    if (inconsistencies.length > 0) {
      reasoningParts.push(`Additional inconsistencies noted: ${inconsistencies.join("; ")}.`);
    }
    return buildResult(ROUTES.INVESTIGATION_FLAG, rulesFired, reasoningParts);
  }

  // ─── Rule 2: Specialist Queue (Injury) ────────────────────────────────────
  const normalizedClaimType = (extracted.claimType || "").toLowerCase();
  if (
    normalizedClaimType === "injury" ||
    normalizedClaimType.includes("injury") ||
    normalizedClaimType.includes("bodily")
  ) {
    rulesFired.push("CLAIM_TYPE_INJURY");
    reasoningParts.push(
      `Claim type is identified as "${extracted.claimType}", which involves personal injury. ` +
      `Injury claims require specialist medical assessment, legal review, and rehabilitation coordination.`
    );
    if (missingFields.length > 0) {
      reasoningParts.push(
        `Note: ${missingFields.length} missing field(s) detected — the specialist team will also need to collect these: ` +
        `[${missingFields.map((f) => f.label).join(", ")}].`
      );
    }
    if (inconsistencies.length > 0) {
      reasoningParts.push(`Inconsistencies flagged: ${inconsistencies.join("; ")}.`);
    }
    return buildResult(ROUTES.SPECIALIST_QUEUE, rulesFired, reasoningParts);
  }

  // ─── Rule 3: Manual Review (Missing Fields) ───────────────────────────────
  if (missingFields.length > 0) {
    rulesFired.push("MISSING_MANDATORY_FIELDS");
    const missingLabels = missingFields.map((f) => `${f.label} (${f.section})`);
    reasoningParts.push(
      `${missingFields.length} mandatory field(s) are missing from this FNOL submission: ` +
      `[${missingLabels.join(", ")}]. ` +
      `The claim cannot be auto-processed until all required information is provided.`
    );
    if (inconsistencies.length > 0) {
      reasoningParts.push(`Inconsistencies also detected: ${inconsistencies.join("; ")}.`);
    }
    return buildResult(ROUTES.MANUAL_REVIEW, rulesFired, reasoningParts);
  }

  // ─── Rule 4: Fast-Track (Low Damage) ─────────────────────────────────────
  const damageAmount = typeof extracted.estimatedDamage === "number"
    ? extracted.estimatedDamage
    : null;

  if (damageAmount !== null && damageAmount < FAST_TRACK_THRESHOLD) {
    rulesFired.push("LOW_DAMAGE_FAST_TRACK");
    reasoningParts.push(
      `Estimated damage of ${extracted.estimatedDamageRaw || damageAmount} is below the fast-track threshold of INR ${FAST_TRACK_THRESHOLD.toLocaleString()}. ` +
      `All mandatory fields are present and no fraud indicators detected. ` +
      `Claim is eligible for automated fast-track processing with expedited settlement.`
    );
    if (inconsistencies.length > 0) {
      rulesFired.push("INCONSISTENCIES_NOTED");
      reasoningParts.push(`Minor inconsistencies noted for record: ${inconsistencies.join("; ")}.`);
    }
    return buildResult(ROUTES.FAST_TRACK, rulesFired, reasoningParts);
  }

  // ─── Rule 5: Standard Review (Default) ───────────────────────────────────
  rulesFired.push("STANDARD_REVIEW_DEFAULT");
  reasoningParts.push(
    `Claim is complete with all mandatory fields present and no fraud indicators detected. ` +
    `Estimated damage of ${extracted.estimatedDamageRaw || damageAmount || "undetermined"} meets or exceeds the fast-track threshold. ` +
    `Claim is routed to Standard Review for surveyor assignment and detailed assessment.`
  );
  if (inconsistencies.length > 0) {
    rulesFired.push("INCONSISTENCIES_NOTED");
    reasoningParts.push(`Inconsistencies flagged for reviewer attention: ${inconsistencies.join("; ")}.`);
  }
  return buildResult(ROUTES.STANDARD_REVIEW, rulesFired, reasoningParts);
}

function buildResult(route, rulesFired, reasoningParts) {
  return {
    route,
    rulesFired,
    reasoning: reasoningParts.join(" "),
  };
}

module.exports = { routeClaim, ROUTES, FAST_TRACK_THRESHOLD };
