// src/extractor.js
// Uses Claude AI to extract structured fields from raw FNOL document text

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACTION_SYSTEM_PROMPT = `You are an expert insurance claims analyst. Your job is to extract structured information from First Notice of Loss (FNOL) documents.

Extract the following fields from the document:

POLICY INFORMATION:
- policyNumber
- policyholderName
- effectiveDateStart
- effectiveDateEnd

INCIDENT INFORMATION:
- incidentDate
- incidentTime
- incidentLocation
- incidentDescription

INVOLVED PARTIES:
- claimantName
- claimantPhone
- claimantEmail
- thirdParties (array of objects: {name, vehicle/contact, insurance})

ASSET DETAILS:
- assetType
- assetId
- estimatedDamage (extract the NUMERIC value in INR/currency, as a number only, no currency symbol)
- estimatedDamageCurrency (e.g., "INR")
- estimatedDamageRaw (the original string from document)

CLAIM DETAILS:
- claimType
- attachments (true/false/partial)
- attachmentDetails (list of attachments if mentioned)
- initialEstimate (numeric value)
- initialEstimateRaw (original string)

RULES:
- If a field is explicitly marked as [NOT PROVIDED] or is clearly missing, set it to null
- If a field is partially available, include what is available
- For estimatedDamage, convert to a plain number (e.g., "INR 18,500" → 18500, "INR 32,00,000" → 3200000)
- For claimType, normalize to one of: "property_damage", "injury", "theft", "natural_disaster", "commercial_property", "other"
- Return ONLY valid JSON with no markdown formatting, no code blocks, no explanation`;

/**
 * Extract fields from FNOL document text using Claude
 * @param {string} documentText - Raw text of the FNOL document
 * @param {string} filename - Name of the file being processed
 * @returns {Promise<Object>} Extracted fields object
 */
async function extractFields(documentText, filename = "unknown") {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Extract all fields from this FNOL document:\n\nFilename: ${filename}\n\n${documentText}`,
      },
    ],
  });

  const raw = response.content[0].text.trim();

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  return JSON.parse(cleaned);
}

module.exports = { extractFields };
