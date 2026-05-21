const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const { createCanvas } = require('canvas');
const Tesseract = require('tesseract.js');

async function test() {
  const fileBuffer = fs.readFileSync('uploads/1776592798844-Blood Report 26-08-24.pdf');
  
  // STEP 1: pdf-parse text extraction
  const parser1 = new PDFParse({ data: fileBuffer });
  const result = await parser1.getText();
  let text = result.text || '';
  console.log("[STEP 1] pdf-parse text length:", text.length);

  // STEP 2: Check if weak
  const isWeak = !text || text.length < 200 || !/[a-zA-Z]{10,}/.test(text);
  console.log("[STEP 2] isWeakText:", isWeak);

  // STEP 3: OCR if weak
  if (isWeak) {
    console.log("[STEP 3] Running OCR...");
    const parser2 = new PDFParse({
      data: fileBuffer,
      canvasFactory: {
        create(w, h) { const c = createCanvas(w, h); return { canvas: c, context: c.getContext('2d') }; },
        reset(obj, w, h) { obj.canvas.width = w; obj.canvas.height = h; },
        destroy(obj) {}
      }
    });
    const imageResult = await parser2.getImage({ imageBuffer: true, first: 1 });
    if (imageResult.pages.length && imageResult.pages[0].images.length) {
      const img = imageResult.pages[0].images[0];
      const pngBuffer = Buffer.from(img.data);
      const ocr = await Tesseract.recognize(pngBuffer, 'eng');
      text = ocr?.data?.text || '';
      console.log("[STEP 3] OCR text length:", text.length);
    }
  }

  // STEP 5: Clean + OCR correction
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

  console.log("[STEP 5] Cleaned lines:", lines.length);
  console.log("--- ALL LINES ---");
  lines.forEach((l, i) => console.log(`  ${i}: ${l}`));
  console.log("--- END LINES ---");

  // STEP 6: Universal Extraction Engine
  const extractedData = [];

  const nameContext = [
    { regex: /haemoglobin|hemoglobin|hb\b/i, name: 'Hemoglobin', cat: 'Haematology' },
    { regex: /wbc|total leucocyte|white blood/i, name: 'WBC', cat: 'Haematology' },
    { regex: /rbc|red blood cell/i, name: 'RBC', cat: 'Haematology' },
    { regex: /pcv|packed cell volume/i, name: 'PCV', cat: 'Haematology' },
    { regex: /\bmcv\b|mean corpuscular volume/i, name: 'MCV', cat: 'Haematology' },
    { regex: /\bmchc\b|mean co[rp]uscular hb conc/i, name: 'MCHC', cat: 'Haematology' },
    { regex: /\bmch\b|mean corpuscular hemoglobin/i, name: 'MCH', cat: 'Haematology' },
    { regex: /platelet|plt/i, name: 'Platelets', cat: 'Haematology' },
    { regex: /rdw/i, name: 'RDW', cat: 'Haematology' },
    { regex: /mpv/i, name: 'MPV', cat: 'Haematology' },
    { regex: /p-lcr|plcr/i, name: 'P-LCR', cat: 'Haematology' },
    { regex: /neutrophil/i, name: 'Neutrophils', cat: 'Haematology' },
    { regex: /lymphocyte/i, name: 'Lymphocytes', cat: 'Haematology' },
    { regex: /eosinophil/i, name: 'Eosinophils', cat: 'Haematology' },
    { regex: /monocyte/i, name: 'Monocytes', cat: 'Haematology' },
    { regex: /basophil/i, name: 'Basophils', cat: 'Haematology' },
    { regex: /glucose|sugar|fbs|ppbs/i, name: 'Glucose', cat: 'Biochemistry' },
    { regex: /hba1c/i, name: 'HbA1c', cat: 'Biochemistry' },
    { regex: /tsh|thyroid/i, name: 'TSH', cat: 'Endocrinology' },
    { regex: /esr/i, name: 'ESR', cat: 'Haematology' },
    { regex: /hdl/i, name: 'HDL', cat: 'Lipid Profile' },
    { regex: /ldl/i, name: 'LDL', cat: 'Lipid Profile' },
    { regex: /cholesterol/i, name: 'Cholesterol', cat: 'Lipid Profile' },
    { regex: /triglyceride/i, name: 'Triglycerides', cat: 'Lipid Profile' },
    { regex: /creatinine/i, name: 'Creatinine', cat: 'Biochemistry' },
    { regex: /urea/i, name: 'Urea', cat: 'Biochemistry' },
    { regex: /bilirubin/i, name: 'Bilirubin', cat: 'Biochemistry' },
  ];

  lines.forEach((line, index) => {
    // Skip metadata
    if (/age|year|month|date|time|sex|gender|\bdr\b|doctor|address|phone|hospital|name|reg|ref|sample|report/i.test(line)) return;
    if (/haematology|biochemistry|test\s+result\s+unit|complete blood|biological/i.test(line)) return;

    // Try to find numeric value + unit on this line
    // Pattern: number followed by optional unit text
    const allMatches = [...line.matchAll(/(\d+\.?\d*)\s*([a-zA-Z/%]*)/g)];
    if (allMatches.length === 0) return;

    // Find the FIRST plausible value+unit combo
    let rawVal = null, rawUnit = '', matchIdx = 0;
    for (const m of allMatches) {
      const unit = m[2].toLowerCase();
      if (/gm|g\/dl|mg|cmm|cumm|lakh|uiu|miu|mm|%|cells|fl|pg|picogram|micron/i.test(unit) || unit === '') {
        rawVal = m[1];
        rawUnit = m[2];
        matchIdx = m.index;
        break;
      }
    }
    if (!rawVal) return;

    // Find range on same line: "13.5-16" or "4000-11000"
    let min = null, max = null, rangeStr = '';
    // Get ALL number-dash-number patterns
    const rangeMatches = [...line.matchAll(/([\d.]+)\s*[-–—]\s*([\d.]+)/g)];
    if (rangeMatches.length > 0) {
      // Use the LAST range match (ranges usually come after the value)
      const rm = rangeMatches[rangeMatches.length - 1];
      min = parseFloat(rm[1]);
      max = parseFloat(rm[2]);
      rangeStr = `${min}-${max}`;
    }

    // Try < or > range
    if (!rangeStr) {
      const ltMatch = line.match(/<\s*([\d.]+)/);
      const gtMatch = line.match(/>\s*([\d.]+)/);
      if (ltMatch) { max = parseFloat(ltMatch[1]); rangeStr = `<${max}`; }
      if (gtMatch) { min = parseFloat(gtMatch[1]); rangeStr = `>${min}`; }
    }

    // Discover parameter name
    let paramName = '';
    let cat = 'General';
    const textBefore = line.substring(0, matchIdx).trim();
    
    // Check nameContext first
    const foundCtx = nameContext.find(n => n.regex.test(line));
    if (foundCtx) {
      paramName = foundCtx.name;
      cat = foundCtx.cat;
    } else {
      // Use text before the number
      const nameMatch = textBefore.match(/^[A-Za-z\s()\-]+/);
      if (nameMatch) paramName = nameMatch[0].trim();
    }

    if (!paramName || paramName.length < 2) return;

    const val = parseFloat(rawVal);
    let finalVal = val;
    if (paramName === 'Platelets' && finalVal < 1000) finalVal *= 100000;

    // Status
    let status = 'Unknown';
    if (min !== null && max !== null) {
      if (finalVal < min) status = 'Low';
      else if (finalVal > max) status = 'High';
      else status = 'Normal';
    } else if (min !== null) {
      status = finalVal < min ? 'Low' : 'Normal';
    } else if (max !== null) {
      status = finalVal > max ? 'High' : 'Normal';
    }

    // Dedup
    const existIdx = extractedData.findIndex(e => e.test_name === paramName);
    const entry = {
      name: paramName,
      test_name: paramName,
      value: finalVal,
      unit: rawUnit,
      range: rangeStr || null,
      min, max, status, category: cat
    };

    if (existIdx === -1) {
      extractedData.push(entry);
    } else if (!extractedData[existIdx].range && rangeStr) {
      extractedData[existIdx] = entry;
    }
  });

  console.log("\n=== EXTRACTED PARAMETERS ===");
  console.log(`Total: ${extractedData.length}`);
  extractedData.forEach(p => {
    console.log(`  ${p.category} | ${p.test_name}: ${p.value} ${p.unit} [${p.range}] → ${p.status}`);
  });
}

test().catch(console.error);
