const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const path = require('path');

const filePath = path.join(__dirname, 'uploads/1776364946456-Blood Report (1).pdf');

async function testUpload() {
  const fileBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: fileBuffer });
  const result = await parser.getText();
  let text = result.text || '';
  
  const data = {};
  const regex = /([0-9]+\.?[0-9]*)\s*(gm%|g\/dl|mg\/dl|lakh|cells|uiu|miu|mm|uiu\/ml)/gi;
  const matches = [...text.matchAll(regex)];

  console.log(`Found ${matches.length} matches.`);
  matches.forEach(match => {
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === "gm%" || unit === "g/dl") data.hemoglobin = value;
    if (unit === "lakh") data.platelets = value * 100000;
    if (unit === "mg/dl") data.glucose = value;
    if (unit === "uiu" || unit === "miu" || unit === "uiu/ml") data.tsh = value;
    if (unit === "mm") data.esr = value;
    if (unit === "cells") data.wbc = value;
  });

  const extractedData = [];
  const meta = {
    hemoglobin: { name: 'Hemoglobin', unit: 'g/dL', range: '12-17.5', cat: 'Haematology' },
    wbc: { name: 'WBC', unit: '/µL', range: '4500-11000', cat: 'Haematology' },
    glucose: { name: 'Glucose', unit: 'mg/dL', range: '70-140', cat: 'Biochemistry' },
    tsh: { name: 'TSH', unit: 'mIU/L', range: '0.4-4.2', cat: 'Thyroid' },
    platelets: { name: 'Platelets', unit: '/µL', range: '150000-450000', cat: 'Haematology' },
    esr: { name: 'ESR', unit: 'mm/hr', range: '0-20', cat: 'Haematology' }
  };

  Object.entries(data).forEach(([key, val]) => {
    if (val !== null && meta[key]) {
      extractedData.push({
        test_name: meta[key].name,
        value: val,
        unit: meta[key].unit,
        range: meta[key].range,
        category: meta[key].cat
      });
    }
  });

  console.log("data:", data);
  console.log("extractedData:", extractedData);
}

testUpload();
