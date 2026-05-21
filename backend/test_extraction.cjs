const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const path = require('path');

const filePath = path.join(__dirname, 'uploads/1776364946456-Blood Report (1).pdf');

async function testExtraction() {
  const fileBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: fileBuffer });
  const result = await parser.getText();
  let text = result.text || '';
  
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  const data = {};
  // The regex from reportController:
  // /([0-9]+\.?[0-9]*)\s*(gm%|mg\/dl|lakh|cells|uiu|miu|mm)/gi
  const matches = [...text.matchAll(/([0-9]+\.?[0-9]*)\s*(gm%|mg\/dl|lakh|cells|uiu|miu|mm)/gi)];
  
  console.log(`Found ${matches.length} matches.`);
  
  matches.forEach(match => {
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    console.log(`Match: value=${value}, unit=${unit}`);

    if (unit === "gm%") data.hemoglobin = value;
    if (unit === "lakh") data.platelets = value * 100000;
    if (unit === "mg/dl") data.glucose = value;
    if (unit === "uiu" || unit === "miu") data.tsh = value;
    if (unit === "mm") data.esr = value;
    if (unit === "cells") data.wbc = value;
  });
  
  const ranges = {
    hemoglobin: { min: 12, max: 15, unit: "gm%" },
    wbc: { min: 4000, max: 11000, unit: "cells/cumm" },
    platelets: { min: 150000, max: 450000, unit: "cells/cumm" },
    glucose: { min: 70, max: 110, unit: "mg/dl" },
    tsh: { min: 0.27, max: 4.2, unit: "uIU/ml" },
    esr: { min: 0, max: 20, unit: "mm/hr" }
  };

  function getStatus(value, range) {
    if (value == null) return "unknown";
    if (value < range.min) return "low";
    if (value > range.max) return "high";
    return "normal";
  }

  const parameters = Object.keys(data).map(key => {
    const value = data[key];
    const range = ranges[key];

    if (value == null) return null;

    return {
      name: key,
      value: value,
      unit: range.unit,
      range: `${range.min}-${range.max}`,
      status: getStatus(value, range)
    };
  }).filter(Boolean);

  const abnormalCount = parameters.filter(
    p => p.status === "high" || p.status === "low"
  ).length;

  let healthScore = 100;

  parameters.forEach(p => {
    if (p.status === "high" || p.status === "low") {
      healthScore -= 10;
    }
  });

  let riskLevel = "Low";

  if (abnormalCount >= 3) riskLevel = "High";
  else if (abnormalCount >= 1) riskLevel = "Moderate";

  const finalOutput = {
    success: true,
    summary: {
      healthScore,
      riskLevel,
      abnormalCount
    },
    parameters
  };

  console.log(JSON.stringify(finalOutput, null, 2));
  return finalOutput;
}

testExtraction();
