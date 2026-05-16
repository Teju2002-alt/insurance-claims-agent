// src/agent.js

const fs = require("fs");
const path = require("path");
const { validateFields } = require("./validator");
const { routeClaim } = require("./router");

async function readDocument(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".pdf") {
        const pdfParse = require("pdf-parse");
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    }

    return fs.readFileSync(filePath, "utf-8");
}

// Local extraction without Claude API
function extractLocalFields(text) {

    return {
        policyNumber:
            text.match(/Policy Number:\s*(.*)/i)?.[1] || null,

        policyholderName:
            text.match(/Policyholder Name:\s*(.*)/i)?.[1] || null,

        claimType:
            text.match(/Claim Type:\s*(.*)/i)?.[1] || null,

        incidentDate:
            text.match(/Date:\s*(.*)/i)?.[1] || null,

        incidentTime:
            text.match(/Time:\s*(.*)/i)?.[1] || null,

        location:
            text.match(/Location:\s*(.*)/i)?.[1] || null,

        assetType:
            text.match(/Asset Type:\s*(.*)/i)?.[1] || null,

        assetId:
            text.match(/Asset ID:\s*(.*)/i)?.[1] || null,

        estimatedDamage:
            parseInt(
                text.match(/Estimated Damage:\s*(\d+)/i)?.[1]
            ) || 0,

        description:
            text.match(/Description:\s*(.*)/i)?.[1] || ""
    };
}

async function processFNOL(filePath) {

    const filename = path.basename(filePath);

    const documentText =
        await readDocument(filePath);

    const extracted =
        extractLocalFields(documentText);

    const validation =
        validateFields(extracted);

    const routing =
        routeClaim(extracted, validation);

    return {
        metadata: {
            filename,
            processedAt: new Date()
        },

        extractedFields: extracted,

        missingFields:
            validation.missingFields,

        inconsistencies:
            validation.inconsistencies,

        fraudFlags:
            validation.fraudFlags,

        recommendedRoute:
            routing.route,

        reasoning:
            routing.reasoning,

        rulesFired:
            routing.rulesFired
    };
}

async function processBatch(files) {

    const results = [];

    for (const f of files) {
        results.push(await processFNOL(f));
    }

    return results;
}

module.exports = {
    processFNOL,
    processBatch
};