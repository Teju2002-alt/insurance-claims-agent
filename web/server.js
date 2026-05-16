// web/server.js — Express web server for the Insurance Claims Processing Agent UI

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const express = require("express");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const { processFNOL } = require("../src/agent");

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Multer setup (upload to temp dir) ────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, "../.tmp_uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${file.originalname}`;
    cb(null, unique);
  },
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = [".txt", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ─── Static files ──────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// ─── API: Process single FNOL ─────────────────────────────────────────────
app.post("/api/process", upload.single("fnol"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded or unsupported format (.txt, .pdf only)" });
  }

  const filePath = req.file.path;

  try {
    const result = await processFNOL(filePath);
    res.json({ status: "success", result });
  } catch (err) {
    console.error("Processing error:", err.message);
    res.status(500).json({ status: "error", error: err.message });
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
});

// ─── API: Process sample FNOLs ─────────────────────────────────────────────
app.post("/api/process-sample/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const samplePath = path.join(__dirname, `../sample-fnols/fnol_00${id}.txt`);

  if (!fs.existsSync(samplePath)) {
    return res.status(404).json({ error: `Sample FNOL #${id} not found` });
  }

  try {
    const result = await processFNOL(samplePath);
    res.json({ status: "success", result });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// ─── API: List available samples ──────────────────────────────────────────
app.get("/api/samples", (req, res) => {
  const sampleDir = path.join(__dirname, "../sample-fnols");
  const samples = fs.readdirSync(sampleDir)
    .filter((f) => /\.(txt|pdf)$/i.test(f))
    .map((f, i) => ({
      id: i + 1,
      filename: f,
      preview: fs.readFileSync(path.join(sampleDir, f), "utf-8").slice(0, 300) + "...",
    }));
  res.json(samples);
});

// ─── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛡  Insurance Claims Agent Web UI`);
  console.log(`   Running at http://localhost:${PORT}\n`);
});
