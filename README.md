# 🛡 ClaimSight — Autonomous Insurance Claims Processing Agent

An AI-powered agent that processes First Notice of Loss (FNOL) documents, extracts structured data, identifies issues, and routes claims to the correct workflow — all powered by Claude AI.

---

## 📌 Overview

| Feature | Detail |
|---|---|
| **AI Model** | Claude claude-sonnet-4-20250514 (Anthropic) |
| **Language** | Node.js |
| **Interfaces** | CLI + Web UI |
| **Document Formats** | `.txt`, `.pdf` |
| **Routing Rules** | Fast-Track · Specialist Queue · Manual Review · Investigation Flag · Standard Review |

---

## 🧠 Architecture

```
FNOL Document (.txt / .pdf)
        │
        ▼
 ┌─────────────┐
 │  extractor  │  Claude AI → Structured JSON (all FNOL fields)
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │  validator  │  Rule-based → missingFields, inconsistencies, fraudFlags
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │   router    │  Priority rules → recommendedRoute + reasoning
 └──────┬──────┘
        │
        ▼
  JSON Output (saved to ./outputs/)
```

---

## 📋 Fields Extracted

### Policy Information
- Policy Number, Policyholder Name, Effective Dates

### Incident Information
- Date, Time, Location, Description

### Involved Parties
- Claimant Name, Phone, Email, Third Parties

### Asset Details
- Asset Type, Asset ID, Estimated Damage (numeric + raw)

### Claim Details
- Claim Type, Attachments, Initial Estimate

---

## 🔀 Routing Logic

| Rule | Condition | Route |
|---|---|---|
| **Fraud Keywords** | Description contains: `fraud`, `staged`, `inconsistent`, `suspicious`, etc. | 🚨 Investigation Flag |
| **Injury Claim** | `claimType = injury` | 🏥 Specialist Queue |
| **Missing Fields** | Any mandatory field is null/empty | 🔍 Manual Review |
| **Low Damage** | `estimatedDamage < INR 25,000` + all fields present | ⚡ Fast-Track |
| **Default** | All fields present, no flags | 📋 Standard Review |

Rules are evaluated in priority order (fraud first, default last).

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Anthropic API key ([get one here](https://console.anthropic.com))

### Installation

```bash
# 1. Clone / extract the project
cd insurance-claims-agent

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### Running the CLI

```bash
# Process all sample FNOLs
npm start

# Process a specific file
node index.js path/to/fnol.txt

# Process multiple files
node index.js fnol1.txt fnol2.pdf fnol3.txt
```

Results are saved to `./outputs/` as JSON files.

### Running the Web UI

```bash
npm run web
# Open http://localhost:3000
```

The web UI allows you to:
- Upload your own `.txt` or `.pdf` FNOL documents
- Process any of the 5 included sample FNOLs
- See the full extracted fields, validation results, routing decision, and raw JSON output

---

## 📁 Project Structure

```
insurance-claims-agent/
├── index.js                  # CLI entry point
├── package.json
├── .env.example
├── src/
│   ├── agent.js              # Main orchestrator
│   ├── extractor.js          # Claude AI field extraction
│   ├── validator.js          # Missing field & inconsistency detection
│   └── router.js             # Routing rules engine
├── web/
│   ├── server.js             # Express web server
│   └── public/
│       └── index.html        # Web UI
├── sample-fnols/
│   ├── fnol_001.txt          # Vehicle rear-end → Fast-Track
│   ├── fnol_002.txt          # Personal injury → Specialist Queue
│   ├── fnol_003.txt          # Suspicious fire → Investigation Flag
│   ├── fnol_004.txt          # Flood damage (incomplete) → Manual Review
│   └── fnol_005.txt          # Commercial fire → Standard Review
└── outputs/                  # Generated JSON results
```

---

## 📤 Output Format

```json
{
  "metadata": {
    "filename": "fnol_001.txt",
    "processedAt": "2025-05-15T10:30:00.000Z",
    "agentVersion": "1.0.0"
  },
  "extractedFields": {
    "policyNumber": "POL-2024-78432",
    "policyholderName": "Rajesh Kumar Sharma",
    "effectiveDateStart": "01-Jan-2024",
    "effectiveDateEnd": "31-Dec-2024",
    "incidentDate": "14-May-2025",
    "incidentTime": "10:35 AM",
    "incidentLocation": "MG Road, Bengaluru",
    "incidentDescription": "...",
    "claimantName": "Rajesh Kumar Sharma",
    "claimantPhone": "+91-9845012345",
    "claimantEmail": "rajesh.sharma@email.com",
    "thirdParties": [...],
    "assetType": "Private Motor Vehicle",
    "assetId": "KA-01-HH-4532",
    "estimatedDamage": 18500,
    "estimatedDamageRaw": "INR 18,500",
    "claimType": "property_damage",
    "attachments": true,
    "initialEstimate": 18500
  },
  "missingFields": [],
  "inconsistencies": [],
  "fraudFlags": [],
  "recommendedRoute": "Fast-Track",
  "rulesFired": ["LOW_DAMAGE_FAST_TRACK"],
  "reasoning": "Estimated damage of INR 18,500 is below the fast-track threshold..."
}
```

---

## 🧪 Sample FNOL Scenarios

| File | Scenario | Expected Route |
|---|---|---|
| `fnol_001.txt` | Vehicle rear-end, INR 18,500 damage, complete | ⚡ **Fast-Track** |
| `fnol_002.txt` | Injury collision with hospitalization | 🏥 **Specialist Queue** |
| `fnol_003.txt` | Fire with "staged", "fraud", "suspicious" in description | 🚨 **Investigation Flag** |
| `fnol_004.txt` | Flood damage with 6 missing mandatory fields | 🔍 **Manual Review** |
| `fnol_005.txt` | Commercial fire, INR 48L damage, complete | 📋 **Standard Review** |

---

## 🔧 Configuration

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Required |
| `PORT` | Web server port | `3000` |
| `OUTPUT_DIR` | Directory for JSON output files | `./outputs` |

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `@anthropic-ai/sdk` | Claude AI API client |
| `express` | Web server |
| `multer` | File upload handling |
| `pdf-parse` | PDF text extraction |
| `dotenv` | Environment variable management |
| `chalk` | CLI color output |
| `fs-extra` | File system utilities |

---

## 🛠 Approach

1. **Extraction (AI)**: The raw FNOL text is sent to Claude with a detailed system prompt that instructs it to extract all fields into a structured JSON object. Claude handles varied document formats, normalises claim types, and converts currency strings to numbers.

2. **Validation (Rule-based)**: A deterministic validator checks each mandatory field for null/missing values and applies cross-field consistency checks (e.g., damage vs. estimate mismatch).

3. **Fraud Detection**: The description and notes fields are scanned for a curated list of fraud indicator keywords.

4. **Routing (Priority Chain)**: Rules are evaluated in strict priority order — fraud first, then injury, then missing fields, then damage threshold, then default. The first matching rule determines the route.

5. **Output**: Results are returned as structured JSON and optionally saved to disk. The web UI renders an interactive breakdown of the result.

---

## 📄 License

MIT
