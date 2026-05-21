const mongoose = require('mongoose');
const Report = require('../models/Report');
const OnboardingData = require('../models/OnboardingData');
const HealthData = require('../models/HealthData');
const { analyzeReport } = require('../services/informaticsService');
const { MEDICAL_DICTIONARY } = require('../services/medicalMetadata');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── Import PDF & OCR Engines ───────────────────────────────────────────────
const { PDFParse } = require("pdf-parse");
const { createCanvas, ImageData } = require("canvas");
let Tesseract;

try {
  Tesseract = require("tesseract.js");
  console.log("[OCR] tesseract.js loaded successfully");
} catch (err) {
  console.log("[OCR] tesseract.js not available:", err.message);
}

// ─── Multer Setup ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, and PNG are allowed.'));
    }
  }
});

exports.upload = upload;

// STEP 2 — WEAK TEXT DETECTOR
function isWeakText(text) {
  return !text || text.length < 200 || !/[a-zA-Z]{10,}/.test(text);
}

// STEP 2 — NORMALIZE STATUS (STRICT)
function normalizeStatus(status) {
  if (!status) return "unknown";
  const s = status.toLowerCase();
  if (s.includes("low")) return "low";
  if (s.includes("high")) return "high";
  if (s.includes("normal")) return "normal";
  return "unknown";
}

/**
 * POST /api/reports/upload
 */
exports.uploadReport = async (req, res) => {
  console.log("Route hit: upload with Step 1-7 Extraction Pipeline");
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }

  let text = '';
  const fileBuffer = fs.readFileSync(req.file.path);

  // STEP 1 — PDF PARSING (v2 class-based)
  if (req.file.mimetype === 'application/pdf') {
    try {
      const parser = new PDFParse({ data: fileBuffer });
      const result = await parser.getText();
      text = result.text || '';
      console.log("[PDF] Extracted", text.length, "characters");
    } catch (err) {
      console.log("[PDF ERROR]", err.message);
    }
  }

  // STEP 3 — ALWAYS RUN OCR IF WEAK
  if (isWeakText(text)) {
    console.log("⚠️ PDF has no text → Running OCR");

    try {
      // Use pdf-parse's own internal pdfjs via getImage() to avoid
      // version mismatch between pdf-parse's bundled pdfjs (v5.4) and
      // any separately installed pdfjs-dist.
      const parser = new PDFParse({
        data: fileBuffer,
        canvasFactory: {
          create(w, h) { const c = createCanvas(w, h); return { canvas: c, context: c.getContext('2d') }; },
          reset(obj, w, h) { obj.canvas.width = w; obj.canvas.height = h; },
          destroy(obj) {}
        }
      });

      const imageResult = await parser.getImage({
        imageBuffer: true,
        first: 1 // Extract from page 1
      });

      if (imageResult.pages.length && imageResult.pages[0].images.length) {
        const img = imageResult.pages[0].images[0];
        console.log(`[OCR] Embedded image found: ${img.width}x${img.height}`);

        // img.data is already a PNG buffer — pass directly to Tesseract
        const pngBuffer = Buffer.from(img.data);
        const ocr = await Tesseract.recognize(pngBuffer, "eng");
        text = ocr?.data?.text || "";
        console.log("✅ OCR TEXT LENGTH:", text.length);
      } else {
        console.log("[OCR] No embedded images found in PDF.");
      }
    } catch (err) {
      console.log("❌ OCR FAILED:", err.message);
    }
  }

  // STEP 4 — HARD FAIL CHECK
  if (!text || text.length < 20) {
    return res.status(400).json({
      success: false,
      message: "Unable to read report. Try clearer image or PDF."
    });
  }

  // STEP 5 — CLEAN & OCR CORRECT TEXT
  const cleanedText = text
      .replace(/\r/g, "")
      .replace(/g\/d1/g, "g/dl")
      .replace(/ce11s/g, "cells")
      .replace(/Cholestero1/i, "Cholesterol")
      .replace(/1akh/gi, "lakh")
      .replace(/m1\/cmm/gi, "mil/cmm");

  const lines = cleanedText
      .split('\n')
      .map(line => line.replace(/\t/g, " ").replace(/\s+/g, " ").trim())
      .filter(line => line.length > 0);

  // STEP 6 — LOG FOR DEBUG
  console.log("TEXT LINES:", lines.length);

  // STEP 5 — HIGH-PRECISION EXTRACTION ENGINE (11-STEP)
  const medicalParser = require('../services/medicalParser');
  let extractedResults = medicalParser.process(cleanedText);

  // STEP 6 — LOG FOR DEBUG
  console.log("EXTRACTED BIOMARKERS:", extractedResults.length);

  // STEP 7 — FINAL NORMALIZATION & PREPARATION FOR INFORMATICS
  let parameters = extractedResults.map(p => ({
    ...p,
    test_name: p.parameter_name // Alias for legacy informatics engine compatibility
  }));

  // STEP 8 — VALIDATION
  if (!parameters.length) {
    return res.status(422).json({ 
      success: false, 
      message: "No valid medical parameters detected. Ensure the report is clear.",
      preview: text.slice(0, 200)
    });
  }


  // 8. Informatics Engine Analysis
  try {
    const user_id = new mongoose.Types.ObjectId(req.user.id);
    const onboarding = await OnboardingData.findOne({ user_id }).exec() || {};
    const sensors = await HealthData.findOne({ userId: user_id }).sort({ createdAt: -1 }).exec() || {};

    // STEP 6 — SAFE EXECUTION
    let informaticsOutput;
    try {
      informaticsOutput = analyzeReport({
        reportData: parameters,
        onboardingData: onboarding,
        sensorData: sensors
      });
    } catch (err) {
      console.log("Informatics error:", err.message);
      return res.status(500).json({ success: false, message: "Analysis failed", debug: err.message });
    }

    const newReport = new Report({
      userId: req.user.id,
      type: 'pdf',
      extractedData: parameters,
      analysis: {
        healthScore: informaticsOutput.summary.healthScore,
        riskLevel: informaticsOutput.summary.riskLevel,
        summary: informaticsOutput.summary,
        abnormal_parameters: informaticsOutput.abnormal_parameters || [],
        predictions: informaticsOutput.predictions,
        recommendations: informaticsOutput.recommendations,
        skin_analysis: informaticsOutput.skin_analysis || null,
        alert: informaticsOutput.alert
      },
      contextUsed: { onboardingSnapshot: onboarding, sensorSnapshot: sensors },
      filePath: req.file.path
    });

    await newReport.save();
    const retObj = newReport.toObject();
    retObj.analysis.parameters = retObj.extractedData;
    return res.json({ success: true, data: retObj });
  } catch (err) {
    console.error('[Reports] Pipeline Error:', err);
    return res.status(500).json({ success: false, message: 'Informatics Engine analysis failed.' });
  }
};

/**
 * POST /api/reports/manual
 */
exports.manualEntry = async (req, res) => {
  try {
    const { hemoglobin, sugar, glucose, tsh, platelets, wbc, esr, lymphocytes, neutrophils, monocytes, eosinophils } = req.body;
    const manualData = [
      { test_name: 'Hemoglobin', value: hemoglobin, unit: 'g/dL', range: '13.5-17.5', category: 'Haematology' },
      { test_name: 'Glucose', value: glucose || sugar, unit: 'mg/dL', range: '70-140', category: 'Biochemistry' },
      { test_name: 'TSH', value: tsh, unit: 'mIU/L', range: '0.4-4.2', category: 'Endocrinology' },
      { test_name: 'Platelets', value: platelets, unit: '/µL', range: '150000-450000', category: 'Haematology' },
      { test_name: 'WBC', value: wbc, unit: '/µL', range: '4000-11000', category: 'Haematology' },
      { test_name: 'ESR', value: esr, unit: 'mm/hr', range: '0-20', category: 'Haematology' },
      { test_name: 'Neutrophils', value: neutrophils, unit: '%', range: '40-75', category: 'Haematology' },
      { test_name: 'Lymphocytes', value: lymphocytes, unit: '%', range: '20-45', category: 'Haematology' },
      { test_name: 'Monocytes', value: monocytes, unit: '%', range: '2-10', category: 'Haematology' },
      { test_name: 'Eosinophils', value: eosinophils, unit: '%', range: '1-6', category: 'Haematology' }
    ].filter(d => d.value !== undefined && d.value !== null && d.value !== "");

    const user_id = new mongoose.Types.ObjectId(req.user.id);
    const onboarding = await OnboardingData.findOne({ user_id }).exec() || {};
    const sensors = await HealthData.findOne({ userId: user_id }).sort({ createdAt: -1 }).exec() || {};
    
    // STEP 3 & 4 — FULL NORMALIZATION & STATUS CALCULATION
    const medicalParser = require('../services/medicalParser');
    let parameters = manualData.map(p => {
        const val = parseFloat(p.value);
        const range = medicalParser.parseRangeFromLine(p.range || "");
        
        // Use provided range or fallback to dictionary defaults
        const min = range.min !== null ? range.min : (MEDICAL_DICTIONARY.find(d => d.name === p.test_name)?.defaultRange.min || null);
        const max = range.max !== null ? range.max : (MEDICAL_DICTIONARY.find(d => d.name === p.test_name)?.defaultRange.max || null);
        
        const status = medicalParser.calculateStatus(val, min, max);

        return {
            test_name: p.test_name,
            parameter_name: p.test_name,
            value: val,
            unit: p.unit,
            range: p.range,
            min,
            max,
            status: status,
            category: p.category
        };
    }).filter(p => !isNaN(p.value));

    if (!parameters.length) {
        return res.status(422).json({ success: false, message: "No structured data found" });
    }

    // STEP 6 — SAFE EXECUTION
    let informaticsOutput;
    try {
        informaticsOutput = analyzeReport({
            reportData: parameters,
            onboardingData: onboarding,
            sensorData: sensors
        });
    } catch (err) {
        console.log("Informatics error:", err.message);
        return res.status(500).json({ success: false, message: "Analysis failed", debug: err.message });
    }
    
    const newReport = new Report({
      userId: req.user.id,
      type: 'manual',
      extractedData: informaticsOutput.parameters,
      analysis: {
        healthScore: informaticsOutput.summary.healthScore,
        riskLevel: informaticsOutput.summary.riskLevel,
        summary: informaticsOutput.summary,
        abnormal_parameters: informaticsOutput.abnormal_parameters || [],
        predictions: informaticsOutput.predictions,
        recommendations: informaticsOutput.recommendations,
        skin_analysis: informaticsOutput.skin_analysis || null,
        alert: informaticsOutput.alert
      },
      contextUsed: { onboardingSnapshot: onboarding, sensorSnapshot: sensors }
    });
    await newReport.save();
    const retObj = newReport.toObject();
    retObj.analysis.parameters = retObj.extractedData;
    return res.json({ success: true, data: retObj });
  } catch (err) {
    console.error('[Reports] Manual error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process manual entry.' });
  }
};

/**
 * GET /api/reports
 */
exports.getReports = async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20);
    const enrichedReports = reports.map(r => {
      const obj = r.toObject();
      if (obj.analysis) {
        obj.analysis.parameters = obj.extractedData || [];
      }
      return obj;
    });
    return res.json({ success: true, data: enrichedReports });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch reports.' });
  }
};
