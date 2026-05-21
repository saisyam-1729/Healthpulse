const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const path = require('path');

const filePath = path.join(__dirname, 'uploads/1776364946456-Blood Report (1).pdf');

async function verifyHybrid() {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: dataBuffer });
        const result = await parser.getText();
        await parser.destroy();

        const cleanText = result.text
            .replace(/\r/g, "")
            .replace(/[ \t]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        const labelMap = {
            Hemoglobin: /haemoglobin|hb|hgb/i,
            WBC: /wbc|white|total count/i,
            Platelets: /platelet|plt/i,
            Glucose: /glucose|sugar|fbs|ppbs/i,
            TSH: /tsh|thyroid/i,
            ESR: /esr/i
        };

        const unitMap = {
            'gm%': 'Hemoglobin',
            'g/dl': 'Hemoglobin',
            'lakh': 'Platelets',
            'mg/dl': 'Glucose',
            'uiu': 'TSH',
            'miu': 'TSH',
            'mm': 'ESR',
            'cells': 'WBC'
        };

        const results = {};
        const matches = [...cleanText.matchAll(/([0-9]+\.?[0-9]*)\s*(gm%|g\/dl|mg\/dl|lakh|cells|uiu|miu|mm)/gi)];

        matches.forEach(match => {
            const val = parseFloat(match[1]);
            const unit = match[2].toLowerCase();
            const pos = match.index;
            const paramFromUnit = unitMap[unit] || (unit.includes('gm') ? 'Hemoglobin' : null);
            
            const windowStart = Math.max(0, pos - 200);
            const windowEnd = Math.min(cleanText.length, pos + 200);
            const windowText = cleanText.substring(windowStart, windowEnd);
            
            const isReferenceRange = /range|male|female|reference/i.test(windowText);
            const isPatientMeta = /age|year/i.test(windowText);

            Object.entries(labelMap).forEach(([param, regex]) => {
                if (regex.test(windowText)) {
                    const isUnitMatch = (param === paramFromUnit);
                    if (isReferenceRange && !isUnitMatch) return; 
                    if (isPatientMeta && val > 20 && val < 100) return; 

                    if (!results[param] || isUnitMatch) {
                        results[param] = val;
                    }
                }
            });

            if (paramFromUnit && !results[paramFromUnit]) {
                results[paramFromUnit] = val;
            }
        });

        console.log("Hybrid Extracted Data:", JSON.stringify(results, null, 2));

        // Assertions
        if (results.Hemoglobin === 11.9) console.log("✅ Hemoglobin Found (11.9)");
        if (results.WBC === 10950) console.log("✅ WBC Found (10950)");
        if (results.Platelets === 3.03) console.log("✅ Platelets Found (3.03 lakhs)");
        if (results.ESR === 37) console.log("✅ ESR Found (37)");

    } catch (err) {
        console.error("Error:", err);
    }
}

verifyHybrid();
