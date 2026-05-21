/**
 * Medical Metadata Dictionary
 * Contains standard clinical ranges, valid units, and synonyms for 40+ biomarkers.
 */

const MEDICAL_DICTIONARY = [
  // --- HAEMATOLOGY ---
  {
    name: 'Hemoglobin',
    category: 'Haematology',
    synonyms: [/haemoglobin/i, /hemoglobin/i, /\bhb\b/i],
    validUnits: ['g/dl', 'gm/dl', 'g/l', 'gm/l'],
    humanRange: { min: 3, max: 25 },
    defaultRange: { min: 13.5, max: 17.5 }
  },
  {
    name: 'WBC',
    category: 'Haematology',
    synonyms: [/wbc/i, /total leucocyte/i, /white blood/i, /tlc/i],
    validUnits: ['cells/cumm', '/cmm', '/cumm', 'cells/mm3', '10^3/ul'],
    humanRange: { min: 100, max: 100000 },
    defaultRange: { min: 4000, max: 11000 }
  },
  {
    name: 'RBC',
    category: 'Haematology',
    synonyms: [/rbc/i, /red blood cell/i, /erythrocyte/i],
    validUnits: ['mil/cmm', 'mill/cumm', 'x10^6/ul', '10^12/l'],
    humanRange: { min: 1, max: 10 },
    defaultRange: { min: 4.5, max: 5.9 }
  },
  {
    name: 'Platelets',
    category: 'Haematology',
    synonyms: [/platelet/i, /\bplt\b/i, /thrombocyte/i],
    validUnits: ['cells/cumm', '/cmm', '/cumm', 'lakh/cumm', '10^3/ul'],
    humanRange: { min: 5000, max: 2000000 },
    defaultRange: { min: 150000, max: 450000 }
  },
  {
    name: 'PCV',
    category: 'Haematology',
    synonyms: [/pcv/i, /packed cell volume/i, /hematocrit/i, /hct/i],
    validUnits: ['%'],
    humanRange: { min: 10, max: 70 },
    defaultRange: { min: 36, max: 50 }
  },
  {
    name: 'MCV',
    category: 'Haematology',
    synonyms: [/mcv/i, /mean corpuscular volume/i],
    validUnits: ['fl'],
    humanRange: { min: 50, max: 150 },
    defaultRange: { min: 80, max: 100 }
  },
  {
    name: 'MCH',
    category: 'Haematology',
    synonyms: [/mch/i, /mean corpuscular hemoglobin/i],
    validUnits: ['pg'],
    humanRange: { min: 10, max: 50 },
    defaultRange: { min: 26, max: 34 }
  },
  {
    name: 'MCHC',
    category: 'Haematology',
    synonyms: [/mchc/i, /mean corpuscular hemoglobin concentration/i],
    validUnits: ['g/dl', '%'],
    humanRange: { min: 20, max: 50 },
    defaultRange: { min: 31, max: 37 }
  },
  {
    name: 'RDW',
    category: 'Haematology',
    synonyms: [/rdw/i, /red cell distribution width/i],
    validUnits: ['%', 'fl'],
    humanRange: { min: 5, max: 30 },
    defaultRange: { min: 11, max: 16 }
  },
  {
    name: 'Neutrophils',
    category: 'Haematology',
    synonyms: [/neutrophil/i, /polymorphs/i],
    validUnits: ['%', 'cells/cumm'],
    humanRange: { min: 0, max: 100 },
    defaultRange: { min: 40, max: 75 }
  },
  {
    name: 'Lymphocytes',
    category: 'Haematology',
    synonyms: [/lymphocyte/i],
    validUnits: ['%', 'cells/cumm'],
    humanRange: { min: 0, max: 100 },
    defaultRange: { min: 20, max: 45 }
  },
  {
    name: 'Monocytes',
    category: 'Haematology',
    synonyms: [/monocyte/i],
    validUnits: ['%', 'cells/cumm'],
    humanRange: { min: 0, max: 20 },
    defaultRange: { min: 2, max: 10 }
  },
  {
    name: 'Eosinophils',
    category: 'Haematology',
    synonyms: [/eosinophil/i],
    validUnits: ['%', 'cells/cumm'],
    humanRange: { min: 0, max: 20 },
    defaultRange: { min: 1, max: 6 }
  },
  {
    name: 'Basophils',
    category: 'Haematology',
    synonyms: [/basophil/i],
    validUnits: ['%', 'cells/cumm'],
    humanRange: { min: 0, max: 5 },
    defaultRange: { min: 0, max: 1 }
  },
  {
    name: 'ESR',
    category: 'Haematology',
    synonyms: [/esr/i, /erythrocyte sedimentation/i],
    validUnits: ['mm/hr', 'mm/1st hr'],
    humanRange: { min: 0, max: 150 },
    defaultRange: { min: 0, max: 20 }
  },

  // --- BIOCHEMISTRY ---
  {
    name: 'Glucose',
    category: 'Biochemistry',
    synonyms: [/glucose/i, /blood sugar/i, /fbs/i, /ppbs/i, /rbs/i],
    validUnits: ['mg/dl', 'mmol/l'],
    humanRange: { min: 20, max: 1000 },
    defaultRange: { min: 70, max: 140 }
  },
  {
    name: 'HbA1c',
    category: 'Biochemistry',
    synonyms: [/hba1c/i, /glycated/i, /glycosylated/i],
    validUnits: ['%'],
    humanRange: { min: 3, max: 20 },
    defaultRange: { min: 4, max: 5.7 }
  },
  {
    name: 'Urea',
    category: 'Kidney Function',
    synonyms: [/urea/i, /bun/i, /blood urea nitrogen/i],
    validUnits: ['mg/dl', 'mmol/l'],
    humanRange: { min: 2, max: 300 },
    defaultRange: { min: 7, max: 20 }
  },
  {
    name: 'Creatinine',
    category: 'Kidney Function',
    synonyms: [/creatinine/i, /creat/i],
    validUnits: ['mg/dl', 'umol/l'],
    humanRange: { min: 0.1, max: 20 },
    defaultRange: { min: 0.6, max: 1.2 }
  },
  {
    name: 'Uric Acid',
    category: 'Kidney Function',
    synonyms: [/uric acid/i],
    validUnits: ['mg/dl', 'umol/l'],
    humanRange: { min: 1, max: 20 },
    defaultRange: { min: 3.5, max: 7.2 }
  },
  {
    name: 'Bilirubin Total',
    category: 'Liver Function',
    synonyms: [/bilirubin total/i, /total bilirubin/i, /\bt\. bilirubin\b/i],
    validUnits: ['mg/dl', 'umol/l'],
    humanRange: { min: 0, max: 50 },
    defaultRange: { min: 0.1, max: 1.2 }
  },
  {
    name: 'SGOT',
    category: 'Liver Function',
    synonyms: [/sgot/i, /ast/i, /aspartate aminotransferase/i],
    validUnits: ['u/l', 'iu/l'],
    humanRange: { min: 0, max: 5000 },
    defaultRange: { min: 8, max: 48 }
  },
  {
    name: 'SGPT',
    category: 'Liver Function',
    synonyms: [/sgpt/i, /alt/i, /alanine aminotransferase/i],
    validUnits: ['u/l', 'iu/l'],
    humanRange: { min: 0, max: 5000 },
    defaultRange: { min: 7, max: 55 }
  },
  {
    name: 'Alkaline Phosphatase',
    category: 'Liver Function',
    synonyms: [/alkaline phosphatase/i, /alp/i],
    validUnits: ['u/l', 'iu/l'],
    humanRange: { min: 10, max: 2000 },
    defaultRange: { min: 40, max: 120 }
  },
  {
    name: 'Total Protein',
    category: 'Liver Function',
    synonyms: [/total protein/i, /prot\. total/i],
    validUnits: ['g/dl', 'g/l'],
    humanRange: { min: 2, max: 15 },
    defaultRange: { min: 6.0, max: 8.3 }
  },
  {
    name: 'Albumin',
    category: 'Liver Function',
    synonyms: [/albumin/i, /alb/i],
    validUnits: ['g/dl', 'g/l'],
    humanRange: { min: 1, max: 10 },
    defaultRange: { min: 3.5, max: 5.0 }
  },

  // --- LIPID PROFILE ---
  {
    name: 'Cholesterol',
    category: 'Lipid Profile',
    synonyms: [/cholesterol total/i, /total cholesterol/i, /chol/i],
    validUnits: ['mg/dl', 'mmol/l'],
    humanRange: { min: 50, max: 600 },
    defaultRange: { min: 100, max: 200 }
  },
  {
    name: 'Triglycerides',
    category: 'Lipid Profile',
    synonyms: [/triglycerides/i, /tg/i, /trig/i],
    validUnits: ['mg/dl', 'mmol/l'],
    humanRange: { min: 20, max: 2000 },
    defaultRange: { min: 50, max: 150 }
  },
  {
    name: 'HDL',
    category: 'Lipid Profile',
    synonyms: [/hdl/i, /hdl cholesterol/i, /good cholesterol/i],
    validUnits: ['mg/dl', 'mmol/l'],
    humanRange: { min: 5, max: 150 },
    defaultRange: { min: 40, max: 60 }
  },
  {
    name: 'LDL',
    category: 'Lipid Profile',
    synonyms: [/ldl/i, /ldl cholesterol/i, /bad cholesterol/i],
    validUnits: ['mg/dl', 'mmol/l'],
    humanRange: { min: 10, max: 500 },
    defaultRange: { min: 50, max: 100 }
  },

  // --- ENDOCRINOLOGY ---
  {
    name: 'TSH',
    category: 'Endocrinology',
    synonyms: [/tsh/i, /thyroid stimulating/i, /thyrotropin/i],
    validUnits: ['uIu/ml', 'miu/l', 'uIu/l'],
    humanRange: { min: 0.001, max: 150 },
    defaultRange: { min: 0.4, max: 4.2 }
  },
  {
    name: 'T3',
    category: 'Endocrinology',
    synonyms: [/t3/i, /triiodothyronine/i],
    validUnits: ['ng/dl', 'nmol/l'],
    humanRange: { min: 10, max: 800 },
    defaultRange: { min: 80, max: 200 }
  },
  {
    name: 'T4',
    category: 'Endocrinology',
    synonyms: [/t4/i, /thyroxine/i],
    validUnits: ['ug/dl', 'nmol/l'],
    humanRange: { min: 1, max: 30 },
    defaultRange: { min: 5, max: 12 }
  },

  // --- VITAMINS & MINERALS ---
  {
    name: 'Vitamin B12',
    category: 'Vitamins',
    synonyms: [/vitamin b12/i, /cobalamin/i, /b12/i],
    validUnits: ['pg/ml', 'pmol/l'],
    humanRange: { min: 10, max: 3000 },
    defaultRange: { min: 200, max: 900 }
  },
  {
    name: 'Vitamin D',
    category: 'Vitamins',
    synonyms: [/vitamin d/i, /25-hydroxy vitamin d/i, /vit d/i, /25-oh vit d/i],
    validUnits: ['ng/ml', 'nmol/l'],
    humanRange: { min: 1, max: 200 },
    defaultRange: { min: 30, max: 100 }
  },
  {
    name: 'Calcium',
    category: 'Minerals',
    synonyms: [/calcium/i, /ca\+\+/i],
    validUnits: ['mg/dl', 'mmol/l'],
    humanRange: { min: 4, max: 18 },
    defaultRange: { min: 8.5, max: 10.2 }
  },
  {
    name: 'Iron',
    category: 'Minerals',
    synonyms: [/iron/i, /serum iron/i, /fe/i],
    validUnits: ['ug/dl', 'umol/l'],
    humanRange: { min: 5, max: 500 },
    defaultRange: { min: 60, max: 170 }
  },

  // --- ELECTROLYTES ---
  {
    name: 'Sodium',
    category: 'Electrolytes',
    synonyms: [/sodium/i, /\bna\b/i],
    validUnits: ['meq/l', 'mmol/l'],
    humanRange: { min: 100, max: 180 },
    defaultRange: { min: 135, max: 145 }
  },
  {
    name: 'Potassium',
    category: 'Electrolytes',
    synonyms: [/potassium/i, /\bk\b/i],
    validUnits: ['meq/l', 'mmol/l'],
    humanRange: { min: 1, max: 10 },
    defaultRange: { min: 3.5, max: 5.0 }
  },
  {
    name: 'Chloride',
    category: 'Electrolytes',
    synonyms: [/chloride/i, /\bcl\b/i],
    validUnits: ['meq/l', 'mmol/l'],
    humanRange: { min: 50, max: 150 },
    defaultRange: { min: 96, max: 106 }
  }
];

module.exports = { MEDICAL_DICTIONARY };
