const { analyzeReport } = require('./services/informaticsService');

const PARAMETER_DICTIONARY = [
  { name: 'Hemoglobin', synonyms: [/haemoglobin/i, /hemoglobin/i, /\bhb\b/i], category: 'Haematology' },
  { name: 'WBC', synonyms: [/wbc/i, /total leucocyte/i, /white blood/i], category: 'Haematology' },
  { name: 'RBC', synonyms: [/rbc/i, /red blood cell/i], category: 'Haematology' },
  { name: 'Platelets', synonyms: [/platelet/i, /\bplt\b/i], category: 'Haematology' },
  { name: 'Glucose', synonyms: [/glucose/i, /blood sugar/i, /fbs/i, /ppbs/i], category: 'Biochemistry' },
  { name: 'HbA1c', synonyms: [/hba1c/i, /glycated/i], category: 'Biochemistry' },
  { name: 'TSH', synonyms: [/tsh/i, /thyroid stimulating/i, /thyrotropin/i], category: 'Endocrinology' },
  { name: 'ESR', synonyms: [/esr/i, /erythrocyte sedimentation/i], category: 'Haematology' },
  { name: 'Cholesterol', synonyms: [/cholesterol/i, /hdl/i, /ldl/i, /lipid/i, /triglyceride/i], category: 'Lipid Profile' }
];

const SECTION_HEADERS = [
  { name: 'Haematology', regex: /^(HAEMATOLOGY|HEMATOLOGY|CELL COUNT|BLOOD REPORT)$/i },
  { name: 'Biochemistry', regex: /^(BIOCHEMISTRY|DIABETIC PROFILE)$/i },
  { name: 'Endocrinology', regex: /^(ENDOCRINOLOGY|THYROID PROFILE|HORMONES)$/i }
];

const OCR_TEXT = `
HAEMATOLOGY
Hemoglobin
15.4 g/dl 13.5-17.0
Total Leucocyte Count (WBC)
10950 cells/cumm 4000-10000
Platelet count
276000 /cmm 150000-450000

BIOCHEMISTRY
Glucose Fasting
110.5 mg/dl < 100
`;

function parseOCR(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let currentCategory = "General";
    const extractedData = [];

    lines.forEach((line, index) => {
        const foundSection = SECTION_HEADERS.find(s => s.regex.test(line));
        if (foundSection) { currentCategory = foundSection.name; return; }

        const matchedParam = PARAMETER_DICTIONARY.find(p => p.synonyms.some(s => s.test(line)));
        if (!matchedParam) return;
        
        console.log(`[DEBUG] Found Parameter: ${matchedParam.name} on line: "${line}"`);

        const contextLines = [];
        for (let i = 0; i <= 3; i++) {
            if (lines[index + i]) contextLines.push(lines[index + i]);
        }

        let value = null, unit = null, rangeStr = "", min = null, max = null, status = "unknown";
        const valUnitRegex = /([0-9]+\.[0-9]+|[0-9]+)\s*(g\/dl|gm\/dl|mg\/dl|%|cells\/cumm|\/cmm|cells|cumm|lakh|uIU\/ml|miu\/ml|mm\/hr|fl|pg|picograms|mil\/cmm)/i;

        for (const ctxLine of contextLines) {
            console.log(`  [DEBUG] Checking context line: "${ctxLine}"`);
            const vMatch = ctxLine.match(valUnitRegex);
            if (vMatch) {
                value = parseFloat(vMatch[1]);
                unit = vMatch[2].toLowerCase();
                console.log(`    [DEBUG] Match Found! Value: ${value}, Unit: ${unit}`);
                
                const rMatch = ctxLine.match(/([\d.]+)\s*[-–—]\s*([\d.]+)/) || ctxLine.match(/([<>])\s*([\d.]+)/);
                if (rMatch) {
                    console.log(`    [DEBUG] Range Found: ${rMatch[0]}`);
                    if (rMatch[0].includes('-') || rMatch[0].includes('–') || rMatch[0].includes('—')) {
                        min = parseFloat(rMatch[1]); max = parseFloat(rMatch[2]);
                        rangeStr = `${min}-${max}`;
                    } else {
                        const op = rMatch[1]; const b = parseFloat(rMatch[2]);
                        if (op === '<') { max = b; rangeStr = `<${max}`; } else { min = b; rangeStr = `>${min}`; }
                    }
                }
                break;
            }
        }

        if (value === null) return;

        if (min !== null && max !== null) {
            if (value < min) status = "low"; else if (value > max) status = "high"; else status = "normal";
        } else if (min !== null) { status = value < min ? "low" : "normal"; }
        else if (max !== null) { status = value > max ? "high" : "normal"; }

        extractedData.push({
            category: currentCategory !== "General" ? currentCategory : matchedParam.category,
            parameter_name: matchedParam.name,
            test_name: matchedParam.name,
            value,
            unit,
            range: rangeStr || null,
            min,
            max,
            status
        });
    });
    return extractedData;
}

const parameters = parseOCR(OCR_TEXT);
const analysis = analyzeReport({ reportData: parameters, onboardingData: {}, sensorData: {} });

console.log("=== 12-STEP PRODUCTION ENGINE VERIFICATION ===");
console.log(JSON.stringify(analysis, null, 2));
