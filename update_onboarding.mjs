import * as fs from 'fs';

let code = fs.readFileSync('./src/pages/Onboarding.tsx', 'utf8');

// First add the import and hook initialization if missing.
if (!code.includes('useTranslation')) {
  code = code.replace(
    'import { useNavigate } from "react-router-dom";',
    'import { useNavigate } from "react-router-dom";\nimport { useTranslation } from "react-i18next";'
  );
  code = code.replace(
    'const { user } = useAuth();',
    'const { user } = useAuth();\n  const { t } = useTranslation();'
  );
}

const replacements = {
  "'Health Profile'": "t('onboarding.title')",
  ">Health Profile<": ">{t('onboarding.title')}<",
  ">Tell us about yourself<": ">{t('onboarding.subtitle0')}<",
  ">Describe any pain or discomfort<": ">{t('onboarding.subtitle1')}<",
  ">Select any symptoms you're experiencing</p>": ">{t('onboarding.subtitle2')}</p>",
  ">Please provide the following details<": ">{t('onboarding.subtitle3')}<",
  
  "'Basic Info'": "t('onboarding.step1')",
  "'Pain & Symptoms'": "t('onboarding.step2')",
  "'Common Symptoms'": "t('onboarding.step3')",
  "'Medical History'": "t('onboarding.step4')",
  "'Medications & Vitals'": "t('onboarding.step5')",
  "'Lifestyle & Sleep'": "t('onboarding.step6')",
  "'Physical Exam'": "t('onboarding.step7')",
  "'ENT & Ocular'": "t('onboarding.step8')",
  "'Substance Use'": "t('onboarding.step9')",
  "Women's Health": "{t('onboarding.stepWomen')}",
  "Sexual History": "{t('onboarding.stepSexual')}",
  "'Investigations & Imaging'": "t('onboarding.stepInvest')",
  "'Diet History'": "t('onboarding.stepDiet')",

  ">Assessment complete!<": ">{t('onboarding.complete')}<",
  ">Your health profile has been updated.<": ">{t('onboarding.completeDesc')}<",
  ">Assessment saved!<": ">{t('onboarding.saved')}<",
  ">Now create your account to finish.<": ">{t('onboarding.savedDesc')}<",
  
  ">Age<": ">{t('onboarding.age')}<",
  ">Gender<": ">{t('onboarding.gender')}<",
  ">Marital Status<": ">{t('onboarding.marital')}<",
  ">Are you Physically Handicapped (PH)?<": ">{t('onboarding.ph')}<",
  
  ">Male<": ">{t('onboarding.male')}<",
  ">Female<": ">{t('onboarding.female')}<",
  ">Other<": ">{t('onboarding.other')}<",
  
  ">Single / Unmarried<": ">{t('onboarding.single')}<",
  ">Married<": ">{t('onboarding.married')}<",
  ">Divorced<": ">{t('onboarding.divorced')}<",
  ">Widowed<": ">{t('onboarding.widowed')}<",
  
  ">Yes<": ">{t('onboarding.yes')}<",
  ">No<": ">{t('onboarding.no')}<",
  
  ">Headache Type<": ">{t('onboarding.headacheType')}<",
  ">No Headache<": ">{t('onboarding.noHeadache')}<",
  ">Body Pain Location(s)<": ">{t('onboarding.bodyPain')}<",
  ">Chest Pain Side<": ">{t('onboarding.chestPain')}<",
  ">No Chest Pain<": ">{t('onboarding.noChestPain')}<",
  ">Left<": ">{t('onboarding.left')}<",
  ">Right<": ">{t('onboarding.right')}<",
  ">Center<": ">{t('onboarding.center')}<",
  ">Both Sides<": ">{t('onboarding.bothSides')}<",
  ">Pressure on chest?<": ">{t('onboarding.chestPressure')}<",
  ">Pain Severity<": ">{t('onboarding.painSeverity')}<",
  ">No Pain<": ">{t('onboarding.noPain')}<",
  ">Mild<": ">{t('onboarding.mild')}<",
  ">Moderate<": ">{t('onboarding.moderate')}<",
  ">Severe<": ">{t('onboarding.severe')}<",
  ">Very Severe<": ">{t('onboarding.verySevere')}<",
  ">Low Energy?<": ">{t('onboarding.lowEnergy')}<",
  
  ">Existing Conditions<": ">{t('onboarding.existingCond')}<",
  ">Previous history of Stroke?<": ">{t('onboarding.strokeHist')}<",
  ">Previous Cardiac Arrest?<": ">{t('onboarding.cardiacHist')}<",
  ">Past Traumatic History<": ">{t('onboarding.pastTrauma')}<",
  ">Surgical History<": ">{t('onboarding.surgicalHist')}<",
  ">Currently on any medication?<": ">{t('onboarding.onMedication')}<",
  ">Medication Details<": ">{t('onboarding.medDetails')}<",
  ">Medications History (past)<": ">{t('onboarding.medHist')}<",
  
  ">Do you have BP (Blood Pressure issues)?<": ">{t('onboarding.hasBp')}<",
  ">BP Values (if known)<": ">{t('onboarding.bpValues')}<",
  ">Do you have Sugar (Diabetes)?<": ">{t('onboarding.hasSugar')}<",
  ">Sugar Values (if known)<": ">{t('onboarding.sugarValues')}<",
  
  ">Do you get proper sleep?<": ">{t('onboarding.properSleep')}<",
  ">Sleep Hours<": ">{t('onboarding.sleepHours')}<",
  ">Physical exhaustion during walk or exercise?<": ">{t('onboarding.exhaustion')}<",
  
  ">Any wound/scar marks?<": ">{t('onboarding.woundMarks')}<",
  ">Wound/Scar Details<": ">{t('onboarding.woundDetails')}<",
  ">Any fractures?<": ">{t('onboarding.fractures')}<",
  ">Fracture Details<": ">{t('onboarding.fractureDetails')}<",
  
  ">ENT Issues<": ">{t('onboarding.entIssues')}<",
  ">Ocular (Eye) Issues<": ">{t('onboarding.eyeIssues')}<",
  ">Family history of eye conditions?<": ">{t('onboarding.eyeHist')}<",
  
  ">Smoking<": ">{t('onboarding.smoking')}<",
  ">Never<": ">{t('onboarding.never')}<",
  ">Occasionally<": ">{t('onboarding.occasionally')}<",
  ">Regularly<": ">{t('onboarding.regularly')}<",
  ">Quit<": ">{t('onboarding.quit')}<",
  ">Duration<": ">{t('onboarding.duration')}<",
  ">Frequency<": ">{t('onboarding.frequency')}<",
  ">Alcohol<": ">{t('onboarding.alcohol')}<",
  ">Other Addictions<": ">{t('onboarding.otherAddictions')}<",
  
  ">Menstrual Flow<": ">{t('onboarding.flowType')}<",
  ">Light<": ">{t('onboarding.light')}<",
  ">Heavy<": ">{t('onboarding.heavy')}<",
  ">Irregular<": ">{t('onboarding.irregular')}<",
  ">Cycle Duration (days)<": ">{t('onboarding.cycleDays')}<",
  ">Pads per Day (1-5)<": ">{t('onboarding.padsPerDay')}<",
  ">Other Menstrual Symptoms<": ">{t('onboarding.otherMenstrual')}<",
  ">Menopausal?<": ">{t('onboarding.menopausal')}<",
  ">Pregnancy / Reproductive Status<": ">{t('onboarding.pregnancyStatus')}<",
  ">Not applicable<": ">{t('onboarding.notApplicable')}<",
  ">Pregnant<": ">{t('onboarding.pregnant')}<",
  ">Postpartum<": ">{t('onboarding.postpartum')}<",
  ">Trying to conceive<": ">{t('onboarding.trying')}<",
  ">Are you sexually active?<": ">{t('onboarding.sexuallyActive')}<",
  ">Prefer not to say<": ">{t('onboarding.preferNotToSay')}<",
  
  ">Have you done any blood investigations before?<": ">{t('onboarding.hasBloodReport')}<",
  ">Blood Investigations Done<": ">{t('onboarding.bloodInvest')}<",
  ">Imaging Done<": ">{t('onboarding.imagingDone')}<",
  
  ">Diet Type<": ">{t('onboarding.dietType')}<",
  ">Vegetarian<": ">{t('onboarding.veg')}<",
  ">Non-Vegetarian<": ">{t('onboarding.nonveg')}<",
  ">Vegan<": ">{t('onboarding.vegan')}<",
  ">Eggetarian<": ">{t('onboarding.eggetarian')}<",
  ">Meals per Day<": ">{t('onboarding.mealsPerDay')}<",
  ">Type of Food / Amount Description<": ">{t('onboarding.foodType')}<",
  ">Outside / Junk Food Intake<": ">{t('onboarding.outsideFood')}<",
  ">Weekly<": ">{t('onboarding.weekly')}<",
  ">Daily<": ">{t('onboarding.daily')}<",
  
  ">Back<": ">{t('common.back')}<",
  ">Next<": ">{t('common.next')}<",
  ">Complete<": ">{t('onboarding.completeBtn')}<",
  ">Save<": ">{t('common.save')}<",
  
  // Custom non-HTML-wrapped strings
  "label=\"Are you Physically Handicapped (PH)?\"": "label={t('onboarding.ph')}",
  "label=\"Have you done any blood investigations before?\"": "label={t('onboarding.hasBloodReport')}",
  
  "            <CardDescription>\n              {step === 0 ? \"Tell us about yourself\" : \n               step === 1 ? \"Describe any pain or discomfort\" :\n               step === 2 ? \"Select any symptoms you're experiencing\" :\n               \"Please provide the following details\"}\n            </CardDescription>": "            <CardDescription>\n              {step === 0 ? t('onboarding.subtitle0') : \n               step === 1 ? t('onboarding.subtitle1') :\n               step === 2 ? t('onboarding.subtitle2') :\n               t('onboarding.subtitle3')}\n            </CardDescription>",
  
  "const baseSteps = [\n      \"Basic Info\", \"Pain & Symptoms\", \"Common Symptoms\", \"Medical History\",\n      \"Medications & Vitals\", \"Lifestyle & Sleep\", \"Physical Exam\",\n      \"ENT & Ocular\", \"Substance Use\",\n    ];": "const baseSteps = [\n      t('onboarding.step1'),\n      t('onboarding.step2'),\n      t('onboarding.step3'),\n      t('onboarding.step4'),\n      t('onboarding.step5'),\n      t('onboarding.step6'),\n      t('onboarding.step7'),\n      t('onboarding.step8'),\n      t('onboarding.step9'),\n    ];",
      
  "return [...baseSteps, ...middleSteps, \"Investigations & Imaging\", \"Diet History\"];": "return [...baseSteps, ...middleSteps, t('onboarding.stepInvest'), t('onboarding.stepDiet')];"
};

for (const [key, value] of Object.entries(replacements)) {
  code = code.split(key).join(value);
}

fs.writeFileSync('./src/pages/Onboarding.tsx', code);
console.log("Updated Onboarding.tsx");
