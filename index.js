#!/usr/bin/env node
// index.js — CLI entry point for the Insurance Claims Processing Agent

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { processFNOL, processBatch } = require("./src/agent");

// ─── Pretty print helpers ──────────────────────────────────────────────────
let chalk;
try {
  chalk = require("chalk");
} catch {
  chalk = { green: (s) => s, red: (s) => s, yellow: (s) => s, blue: (s) => s, bold: (s) => s, cyan: (s) => s, gray: (s) => s };
}

const ROUTE_COLORS = {
  "Fast-Track":         chalk.green,
  "Specialist Queue":   chalk.blue,
  "Manual Review":      chalk.yellow,
  "Investigation Flag": chalk.red,
  "Standard Review":    chalk.cyan,
};

function printBanner() {
  console.log(chalk.bold("\n╔══════════════════════════════════════════════════════╗"));
  console.log(chalk.bold("║   🛡  Insurance Claims Processing Agent  v1.0.0       ║"));
  console.log(chalk.bold("╚══════════════════════════════════════════════════════╝\n"));
}

function printResult(result) {
  const colorFn = ROUTE_COLORS[result.recommendedRoute] || ((s) => s);

  console.log(chalk.bold(`\n📄 File: ${result.metadata?.filename}`));
  console.log("─".repeat(60));

  if (result.status === "error") {
    console.log(chalk.red(`❌ Error: ${result.error}`));
    return;
  }

  // Route
  console.log(`📌 Route:     ${colorFn(chalk.bold(result.recommendedRoute))}`);
  console.log(`🔔 Rules:     ${result.rulesFired?.join(", ")}`);

  // Missing fields
  if (result.missingFields?.length > 0) {
    console.log(chalk.yellow(`\n⚠️  Missing Fields (${result.missingFields.length}):`));
    result.missingFields.forEach((f) => console.log(chalk.yellow(`   • ${f.label} [${f.section}]`)));
  } else {
    console.log(chalk.green("\n✅ All mandatory fields present"));
  }

  // Fraud flags
  if (result.fraudFlags?.length > 0) {
    console.log(chalk.red(`\n🚨 Fraud Keywords: ${result.fraudFlags.join(", ")}`));
  }

  // Inconsistencies
  if (result.inconsistencies?.length > 0) {
    console.log(chalk.yellow("\n⚡ Inconsistencies:"));
    result.inconsistencies.forEach((i) => console.log(chalk.yellow(`   • ${i}`)));
  }

  // Key extracted fields
  const ef = result.extractedFields || {};
  console.log("\n📋 Key Extracted Fields:");
  console.log(chalk.gray(`   Policy No:      ${ef.policyNumber || "N/A"}`));
  console.log(chalk.gray(`   Policyholder:   ${ef.policyholderName || "N/A"}`));
  console.log(chalk.gray(`   Claim Type:     ${ef.claimType || "N/A"}`));
  console.log(chalk.gray(`   Asset:          ${ef.assetType || "N/A"} (${ef.assetId || "N/A"})`));
  console.log(chalk.gray(`   Est. Damage:    ${ef.estimatedDamageRaw || ef.estimatedDamage || "N/A"}`));
  console.log(chalk.gray(`   Incident:       ${ef.incidentDate || "N/A"} @ ${ef.incidentTime || "N/A"}`));

  // Reasoning
  console.log(`\n💡 Reasoning:\n   ${result.reasoning}`);
}

function saveOutput(result, outputDir) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const baseName = (result.metadata?.filename || "claim").replace(/\.[^.]+$/, "");
  const outPath = path.join(outputDir, `${baseName}_result.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
  return outPath;
}

async function main() {
  printBanner();

  // Skip API key check for demo/testing
  if (!process.env.ANTHROPIC_API_KEY) {
  console.log("Running without Anthropic API...");
}

  const args = process.argv.slice(2);
  const outputDir = process.env.OUTPUT_DIR || "./outputs";

  // Collect file paths from args or default to sample-fnols directory
  let filePaths = args.filter((a) => !a.startsWith("--"));

  if (filePaths.length === 0) {
    const sampleDir = path.join(__dirname, "sample-fnols");
    if (fs.existsSync(sampleDir)) {
      filePaths = fs
        .readdirSync(sampleDir)
        .filter((f) => /\.(txt|pdf)$/i.test(f))
        .map((f) => path.join(sampleDir, f))
        .sort();
      console.log(chalk.cyan(`📂 No files specified. Processing all files in ./sample-fnols/ (${filePaths.length} files)\n`));
    }
  }

  if (filePaths.length === 0) {
    console.log("Usage: node index.js [file1.txt] [file2.pdf] ...");
    console.log("       node index.js          # processes all files in ./sample-fnols/");
    process.exit(0);
  }

  const allResults = [];

  for (const fp of filePaths) {
    if (!fs.existsSync(fp)) {
      console.error(chalk.red(`❌ File not found: ${fp}`));
      continue;
    }

    process.stdout.write(chalk.cyan(`\n⚙️  Processing ${path.basename(fp)}...`));
    try {
      const result = await processFNOL(fp);
      process.stdout.write(chalk.green(" ✓\n"));
      printResult(result);
      const savedPath = saveOutput(result, outputDir);
      console.log(chalk.gray(`\n💾 Result saved to: ${savedPath}`));
      allResults.push(result);
    } catch (err) {
      process.stdout.write(chalk.red(` ✗\n`));
      console.error(chalk.red(`   Error: ${err.message}`));
    }
  }

  // Save combined batch results
  if (allResults.length > 1) {
    const batchPath = path.join(outputDir, "batch_results.json");
    fs.writeFileSync(batchPath, JSON.stringify(allResults, null, 2), "utf-8");
    console.log(chalk.bold(`\n📦 Batch summary saved to: ${batchPath}`));
  }

  // Print summary table
  console.log(chalk.bold("\n\n═══════════════════════ SUMMARY ═══════════════════════"));
  allResults.forEach((r) => {
    const colorFn = ROUTE_COLORS[r.recommendedRoute] || ((s) => s);
    const missing = r.missingFields?.length ? chalk.yellow(` [${r.missingFields.length} missing]`) : "";
    const fraud = r.fraudFlags?.length ? chalk.red(" [FRAUD FLAG]") : "";
    console.log(`  ${r.metadata?.filename?.padEnd(25)} → ${colorFn(r.recommendedRoute?.padEnd(20))}${missing}${fraud}`);
  });
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
