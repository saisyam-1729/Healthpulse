const path = require('path');

const extractValue = (pattern, text) => {
  try {
    const regex = new RegExp(pattern, "i");
    const match = text.match(regex);
    if (match) {
      const valText = (match[2] || match[1]).replace(/[^0-9.]/g, '');
      return parseFloat(valText);
    }
    return null;
  } catch {
    return null;
  }
};

const extractNumber = (text) => {
  if (!text) return null;
  const match = text.match(/([0-9]+\.?[0-9]*)/);
  return match ? parseFloat(match[1]) : null;
};

const testSamples = [
  {
    name: "Hemoglobin standard",
    text: "Hemoglobin: 14.5 g/dL",
    patterns: ["(haemoglobin|hb|hemoglobin|hgb)[^0-9]{0,20}([0-9]+\\.?[0-9]*)"]
  },
  {
    name: "Hb with typo",
    text: "Haemoglobln: 12.0",
    patterns: ["(haemoglobin|hb|hemoglobin|hgb)[^0-9]{0,20}([0-9]+\\.?[0-9]*)"]
  },
  {
    name: "Platelets in lakhs",
    text: "Platelet Count: 1.5 Lakhs/cumm",
    patterns: ["(platelet|plt)[^0-9]{0,20}([0-9]+\\.?[0-9]*)"]
  },
  {
    name: "WBC in k",
    text: "WBC Count: 8.5 k/uL",
    patterns: ["(wbc|white blood|tlc|leucocyte)[^0-9]{0,20}([0-9]+\\.?[0-9]*)"]
  },
  {
      name: "TSH multiline",
      text: "S.TSH\n0.85 mIU/L",
      patterns: ["(tsh|thyroid|s\.tsh)[^0-9]{0,20}([0-9]+\\.?[0-9]*)"]
  }
];

console.log("--- Extraction Test ---");
testSamples.forEach(sample => {
  console.log(`\nTesting: ${sample.name}`);
  console.log(`Text: "${sample.text.replace(/\n/g, '\\n')}"`);
  
  const lines = sample.text.split("\n");
  let foundVal = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || "";
    const combined = line + " " + nextLine;
    
    sample.patterns.forEach(pattern => {
       const val = extractValue(pattern, combined) || extractNumber(nextLine);
       if (val !== null) {
           let scaledVal = val;
           if (sample.name.includes("Platelets") && (combined.includes("lakh") || combined.includes("lac"))) scaledVal = val * 100000;
           else if (sample.name.includes("WBC") && (combined.includes("thousand") || combined.includes(" k"))) scaledVal = val * 1000;
           
           foundVal = scaledVal;
       }
    });
  }
  
  console.log(`Result: ${foundVal}`);
});
