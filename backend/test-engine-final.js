const { analyzeReport } = require('./services/informaticsService');

const OCR_TEXT = `5 KRUPA Dr. Pavan P. Ratunavar
$ $2 M.B.B.S., M.D., D.N.B. (Pathology)
NAME : MR REVANTH Reg. ID: 11703
AGE & SEX: 23 Years / Male REGISTERED ON : 26/08/2024 12:00PM
: HAEMATOLOGY: nn
TEST RESULT UNIT BIOLOGICAL REF RANGE
Haemoglobin -10.4 gm /dl 13.5-16
Total Leucocytes (WBC) Count 4820 /cmm 4000-11000
Red blood cell count - 5.94 mil/cmm ~~ 4.5-6.5
(PCV) Packed Cell Volume - 45.5 % 40-54
P-LCR 2413.0 % 11.0-45.0
Neutrophils +63 % 45-80
Lymphocytes #311 % 20-45
Monocytes - 04 % 02-10
Eosinophils +02 % 01-06
Basophils ‘0 % 00-01
Platelet count + 276000 /cmm 150000-450000`;

function extract(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const extractedData = [];
    const unitMap = { 'gm/dl': 'Hemoglobin', '/cmm': 'WBC', 'mil/cmm': 'RBC', '%': 'Biomarker' };

    lines.forEach((line, index) => {
        const valRegex = /([0-9]+.?[0-9]*)\s*(gm\s*\/dl|g\s*\/dl|mg\s*\/dl|%|cells|cumm|cells\/cumm|lakh|uIU\/ml|mm\/hr|fl|pg|picograms)/i;
        const match = line.match(valRegex);
        if (!match) return;

        const val = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        
        let name = "Unknown";
        for (let offset = -2; offset <= 2; offset++) {
            const i = index + offset;
            if (i >= 0 && i < lines.length) {
                const n = lines[i].match(/^[A-Za-z\s()\-]{3,}/);
                if (n && !n[0].includes('RESULT')) { name = n[0].split(/[+-]/)[0].trim(); break; }
            }
        }

        let range = null, min = null, max = null;
        const rm = line.match(/([\d.]+)\s*[-–—]\s*([\d.]+)/);
        if (rm) { min = parseFloat(rm[1]); max = parseFloat(rm[2]); range = `${min}-${max}`; }

        let status = "normal";
        if (min !== null && val < min) status = "low";
        else if (max !== null && val > max) status = "high";

        extractedData.push({ parameter_name: name, test_name: name, value: val, unit: unit, range, min, max, status, category: "Haematology" });
    });
    return extractedData;
}

const data = extract(OCR_TEXT);
const analysis = analyzeReport({ reportData: data, onboardingData: {}, sensorData: {} });

console.log("=== FINAL ENGINE OUTPUT (STEP 8 SPEC) ===");
console.log(JSON.stringify(analysis, null, 2));
