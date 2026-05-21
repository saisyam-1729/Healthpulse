import * as fs from 'fs';

let code = fs.readFileSync('./src/pages/ReportUpload.tsx', 'utf8');

if (!code.includes('useTranslation')) {
  code = code.replace(
    'import { useState, useEffect } from "react";',
    'import { useState, useEffect } from "react";\nimport { useTranslation } from "react-i18next";'
  );
  code = code.replace(
    'const [isUploading, setIsUploading] = useState(false);',
    'const { t } = useTranslation();\n  const [isUploading, setIsUploading] = useState(false);'
  );
}

const replacements = {
  ">Health Reports &amp; Records<": ">{t('reports.title')}<",
  ">Comprehensive overview of your medical history and assessments<": ">{t('reports.subtitle')}<",
  
  ">Full Health Profile<": ">{t('reports.tabProfile')}<",
  ">Diagnostic Reports<": ">{t('reports.tabReports')}<",
  
  ">AI Health Assessment<": ">{t('reports.aiAssess')}<",
  ">Comprehensive medical data collected during onboarding<": ">{t('reports.aiAssessDesc')}<",
  
  ">Cancel Edit<": ">{t('reports.cancelEdit')}<",
  ">Update Profile<": ">{t('reports.updateProfile')}<",
  
  ">Basic Info<": ">{t('reports.basicInfo')}<",
  ">Vitals &amp; Vibe<": ">{t('reports.vitals')}<",
  ">Blood Pressure Issues?<": ">{t('reports.bpIssues')}<",
  ">Diabetes / Sugar?<": ">{t('reports.sugarIssues')}<",
  
  ">Lifestyle<": ">{t('reports.lifestyle')}<",
  ">Medical History<": ">{t('reports.medHist')}<",
  ">Past Surgical History<": ">{t('reports.pastSurgical')}<",
  
  ">Applying Changes...<": ">{t('reports.applying')}<",
  ">Save Health Profile Updates<": ">{t('reports.saveProfile')}<",
  
  ">No assessment data found. Complete onboarding to see your AI health profile.<": ">{t('reports.noData')}<",
  
  ">Upload Medical Records<": ">{t('reports.uploadTitle')}<",
  ">Digitize your lab results and prescriptions for AI tracking<": ">{t('reports.uploadDesc')}<",
  
  ">Drop PDF reports or images here<": ">{t('reports.dropzone')}<",
  ">Manual Entry Control<": ">{t('reports.manualEntry')}<",
  
  "Hemoglobin (g/dL)": "{t('reports.hemo')}",
  "Blood Sugar (mg/dL)": "{t('reports.bloodSugar')}",
  "Cholesterol (mg/dL)": "{t('reports.cholesterol')}",
  
  ">Analyzing Report...<": ">{t('reports.analyzing')}<",
  ">Analyze Report<": ">{t('reports.analyze')}<",
  
  ">Blood Report Analysis<": ">{t('reports.analysisTitle')}<",
  ">parameters detected from your PDF<": ">{t('reports.analysisDesc')}<",
  
  ">Normal<": ">{t('reports.normal')}<",
  ">Abnormal<": ">{t('reports.abnormal')}<",
  
  ">Parameter<": ">{t('reports.param')}<",
  ">Your Value<": ">{t('reports.yourValue')}<",
  ">Normal Range<": ">{t('reports.normalRange')}<",
  ">Status<": ">{t('reports.status')}<",
  
  ">High<": ">{t('reports.high')}<",
  ">Low<": ">{t('reports.low')}<",
  
  ">No Values Detected<": ">{t('reports.noValuesTitle')}<",
  ">We couldn't automatically extract blood test values from this PDF. This may happen with scanned reports or non-standard formats. Please use the manual entry fields above.<": ">{t('reports.noValuesDesc')}<",
  
  ">Bio Data<": ">{t('reports.bioData')}<",
  ">Age<": ">{t('onboarding.age')}<",
  ">Gender<": ">{t('onboarding.gender')}<",
  ">Marital Status<": ">{t('onboarding.marital')}<",
  ">Physically Handicapped?<": ">{t('onboarding.ph')}<",
  
  ">Clinical Basics<": ">{t('reports.clinicalBasics')}<",
  ">BP Reading<": ">{t('reports.bpReading')}<",
  ">Sugar Reading<": ">{t('reports.sugarReading')}<",
  ">Exhaustion<": ">{t('reports.exhaustion')}<",
  
  ">Medical Risk<": ">{t('reports.medicalRisk')}<",
  ">Stroke History<": ">{t('reports.strokeHist')}<",
  ">Cardiac History<": ">{t('reports.cardiacHist')}<",
  ">Trauma Hist.<": ">{t('reports.traumaHist')}<",
  ">Surgery Hist.<": ">{t('reports.surgeryHist')}<",
  
  ">Symptoms<": ">{t('reports.symptoms')}<",
  ">Headache<": ">{t('reports.headache')}<",
  ">Body Pain<": ">{t('onboarding.bodyPain')}<",
  ">Chest Pain<": ">{t('onboarding.chestPain')}<",
  ">Pain Level<": ">{t('reports.painLevel')}<",
  ">Low Energy<": ">{t('reports.lowEnergy')}<",
  ">Chest Pressure<": ">{t('reports.chestPressure')}<",
  
  ">Medication<": ">{t('reports.medication')}<",
  ">On Meds<": ">{t('reports.onMeds')}<",
  ">Meds Details<": ">{t('onboarding.medDetails')}<",
  ">Meds Hist.<": ">{t('reports.medsHist')}<",
  
  ">ENT &amp; Ocular<": ">{t('reports.entOcular')}<",
  ">ENT Issues<": ">{t('reports.entIssues')}<",
  ">Eye Issues<": ">{t('reports.eyeIssues')}<",
  
  ">Diet &amp; Digestive<": ">{t('reports.dietDigest')}<",
  ">Diet Type<": ">{t('onboarding.dietType')}<",
  ">Meals/Day<": ">{t('reports.mealsDay')}<",
  ">Food Type<": ">{t('onboarding.foodType')}<",
  ">Outside Food<": ">{t('reports.outsideFood')}<",
  
  ">Addictions<": ">{t('onboarding.step9')}<",
  ">Smoking<": ">{t('onboarding.smoking')}<",
  ">Alcohol<": ">{t('onboarding.alcohol')}<",
  ">Other Addictions<": ">{t('onboarding.otherAddictions')}<",
  
  ">Women's Health<": ">{t('reports.womensHealth')}<",
  ">Flow Type<": ">{t('reports.flowType')}<",
  ">Pads/Day<": ">{t('reports.padsDay')}<",
  ">Menopausal<": ">{t('reports.menopausal')}<",
  ">Pregnancy Status<": ">{t('onboarding.pregnancyStatus')}<",
  
  ">Conditions &amp; Selected Symptoms<": ">{t('reports.condSymp')}<",
  ">None<": ">{t('reports.none')}<"
};

for (const [key, value] of Object.entries(replacements)) {
  code = code.split(key).join(value);
}

fs.writeFileSync('./src/pages/ReportUpload.tsx', code);
console.log("Updated ReportUpload.tsx");
