export interface FormField {
  key: string;
  label: string;
  type: "text" | "number" | "slider" | "select" | "boolean" | "multi-select" | "file" | "textarea";
  options?: string[] | number[] | { label: string; value: string | number }[];
  placeholder?: string;
  condition?: (data: any) => boolean;
}

export interface FormSection {
  section: string;
  title: string;
  subtitle?: string;
  condition?: (data: any) => boolean;
  fields: FormField[];
}

export const HEADACHE_TYPES = [
  { label: "onboarding.options.headache.half", value: "half" },
  { label: "onboarding.options.headache.temporal", value: "temporal" },
  { label: "onboarding.options.headache.migraine", value: "migraine" },
  { label: "onboarding.options.headache.cluster", value: "cluster" },
  { label: "onboarding.options.headache.tension", value: "tension" },
  { label: "onboarding.options.headache.sinus", value: "sinus" }
];

export const BODY_PAIN_LOCATIONS = [
  { label: "onboarding.options.location.head", value: "head" },
  { label: "onboarding.options.location.neck", value: "neck" },
  { label: "onboarding.options.location.thorax", value: "thorax" },
  { label: "onboarding.options.location.abdomen", value: "abdomen" },
  { label: "onboarding.options.location.upperLimbs", value: "upper_limbs" },
  { label: "onboarding.options.location.lowerLimbs", value: "lower_limbs" },
  { label: "onboarding.options.location.back", value: "back" }
];

export const COMMON_SYMPTOMS = [
  { label: "onboarding.options.symptoms.cold", value: "cold" },
  { label: "onboarding.options.symptoms.coughSputum", value: "cough_sputum" },
  { label: "onboarding.options.symptoms.coughNoSputum", value: "cough_no_sputum" },
  { label: "onboarding.options.symptoms.numbness", value: "numbness" },
  { label: "onboarding.options.symptoms.tingling", value: "tingling" },
  { label: "onboarding.options.symptoms.pain", value: "pain" },
  { label: "onboarding.options.symptoms.vomiting", value: "vomiting" },
  { label: "onboarding.options.symptoms.looseMotion", value: "loose_motion" },
  { label: "onboarding.options.symptoms.abdDiscomfort", value: "abd_discomfort" },
  { label: "onboarding.options.symptoms.neckPain", value: "neck_pain" },
  { label: "onboarding.options.symptoms.lossAppetite", value: "loss_appetite" },
  { label: "onboarding.options.symptoms.fatigue", value: "fatigue" },
  { label: "onboarding.options.symptoms.bodyAche", value: "body_ache" },
  { label: "onboarding.options.symptoms.fever", value: "fever" },
  { label: "onboarding.options.symptoms.dizziness", value: "dizziness" }
];

export const ENT_ISSUES = [
  { label: "onboarding.options.ent.deafness", value: "deafness" },
  { label: "onboarding.options.ent.discharge", value: "discharge" },
  { label: "onboarding.options.ent.earPain", value: "ear_pain" },
  { label: "onboarding.options.ent.throatPain", value: "throat_pain" },
  { label: "onboarding.options.ent.nasalBleeding", value: "nasal_bleeding" },
  { label: "onboarding.options.ent.nasalObstruction", value: "nasal_obstruction" },
  { label: "onboarding.options.ent.polyp", value: "polyp" },
  { label: "onboarding.options.ent.deviatedSeptum", value: "deviated_septum" },
  { label: "onboarding.options.ent.lossTaste", value: "loss_taste" },
  { label: "onboarding.options.ent.oralUlcers", value: "oral_ulcers" }
];

export const OCULAR_ISSUES = [
  { label: "onboarding.options.ocular.redness", value: "redness" },
  { label: "onboarding.options.ocular.pain", value: "pain" },
  { label: "onboarding.options.ocular.lightIrritation", value: "light_irritation" },
  { label: "onboarding.options.ocular.excessiveTears", value: "excessive_tears" },
  { label: "onboarding.options.ocular.distantVision", value: "distant_vision" },
  { label: "onboarding.options.ocular.nearVision", value: "near_vision" },
  { label: "onboarding.options.ocular.squint", value: "squint" }
];

export const CONDITIONS = [
  { label: "Diabetes", value: "diabetes" },
  { label: "Hypertension", value: "hypertension" },
  { label: "Stroke", value: "stroke" },
  { label: "Heart Disease", value: "heart_disease" },
  { label: "Asthma", value: "asthma" },
  { label: "Thyroid Disorder", value: "thyroid_disorder" }
];

export const BLOOD_INVESTIGATIONS = ["CBC", "CRP", "LFT", "TFT", "RFT", "Lipid Profile", "Urine Routine", "HbA1c", "ESR"];
export const IMAGING_TYPES = ["X-Ray", "CT Scan", "MRI Scan", "PET Scan", "Mammography", "Ultrasound", "ECG", "Echo"];

export const onboardingSchema: FormSection[] = [
  {
    section: "basic_info",
    title: "onboarding.step1",
    subtitle: "onboarding.subtitle0",
    fields: [
      { key: "age", label: "onboarding.age", type: "number" },
      { 
        key: "gender", 
        label: "onboarding.gender", 
        type: "select", 
        options: [
          { label: "onboarding.male", value: "male" },
          { label: "onboarding.female", value: "female" },
          { label: "onboarding.other", value: "other" }
        ]
      },
      { 
        key: "marital_status", 
        label: "onboarding.marital", 
        type: "select",
        options: [
          { label: "onboarding.single", value: "single" },
          { label: "onboarding.married", value: "married" },
          { label: "onboarding.divorced", value: "divorced" },
          { label: "onboarding.widowed", value: "widowed" }
        ]
      },
      { key: "physically_handicapped", label: "onboarding.ph", type: "boolean" }
    ]
  },
  {
    section: "pain_symptoms",
    title: "onboarding.step2",
    subtitle: "onboarding.subtitle1",
    fields: [
      {
        key: "headache_type",
        label: "onboarding.headacheType",
        type: "select",
        options: [
          { label: "onboarding.noHeadache", value: "none" },
          ...HEADACHE_TYPES
        ]
      },
      {
        key: "body_pain_location",
        label: "onboarding.bodyPain",
        type: "multi-select",
        options: BODY_PAIN_LOCATIONS
      },
      {
        key: "chest_pain_side",
        label: "onboarding.chestPain",
        type: "select",
        options: [
          { label: "onboarding.noChestPain", value: "none" },
          { label: "onboarding.left", value: "left" },
          { label: "onboarding.right", value: "right" },
          { label: "onboarding.center", value: "center" },
          { label: "onboarding.bothSides", value: "both" }
        ]
      },
      { key: "chest_pressure", label: "onboarding.chestPressure", type: "boolean" },
      {
        key: "pain_severity",
        label: "onboarding.painSeverity",
        type: "select",
        options: [
          { label: "onboarding.noPain", value: "none" },
          { label: "onboarding.mild", value: "mild" },
          { label: "onboarding.moderate", value: "moderate" },
          { label: "onboarding.severe", value: "severe" },
          { label: "onboarding.verySevere", value: "very_severe" }
        ]
      },
      { key: "low_energy", label: "onboarding.lowEnergy", type: "boolean" }
    ]
  },
  {
    section: "common_symptoms",
    title: "onboarding.step3",
    subtitle: "onboarding.subtitle2",
    fields: [
      {
        key: "common_symptoms",
        label: "",
        type: "multi-select",
        options: COMMON_SYMPTOMS
      }
    ]
  },
  {
    section: "medical_history",
    title: "onboarding.step4",
    subtitle: "onboarding.subtitle3",
    fields: [
      {
        key: "conditions",
        label: "onboarding.existingCond",
        type: "multi-select",
        options: CONDITIONS
      },
      { key: "stroke_history", label: "onboarding.strokeHist", type: "boolean" },
      { key: "cardiac_arrest_history", label: "onboarding.cardiacHist", type: "boolean" },
      { key: "past_traumatic_history", label: "onboarding.pastTrauma", type: "text", placeholder: "onboarding.placeholder.traumatic" },
      { key: "surgical_history", label: "onboarding.surgicalHist", type: "text", placeholder: "onboarding.placeholder.surgical" }
    ]
  },
  {
    section: "medications_vitals",
    title: "onboarding.step5",
    subtitle: "onboarding.subtitle3",
    fields: [
      { key: "on_medication", label: "onboarding.onMedication", type: "boolean" },
      { 
        key: "medication_details", 
        label: "onboarding.medDetails", 
        type: "text", 
        placeholder: "onboarding.placeholder.meds",
        condition: (data) => data.on_medication
      },
      { key: "medications_history", label: "onboarding.medHist", type: "text", placeholder: "onboarding.placeholder.medsHistory" },
      { key: "has_bp", label: "onboarding.hasBp", type: "boolean" },
      { 
        key: "bp_values", 
        label: "onboarding.bpValues", 
        type: "text", 
        placeholder: "onboarding.placeholder.bp",
        condition: (data) => data.has_bp
      },
      { key: "has_sugar", label: "onboarding.hasSugar", type: "boolean" },
      { 
        key: "sugar_values", 
        label: "onboarding.sugarValues", 
        type: "text", 
        placeholder: "onboarding.placeholder.sugar",
        condition: (data) => data.has_sugar
      }
    ]
  },
  {
    section: "lifestyle_sleep",
    title: "onboarding.step6",
    subtitle: "onboarding.subtitle3",
    fields: [
      { key: "proper_sleep", label: "onboarding.properSleep", type: "boolean" },
      { key: "sleep_hours", label: "onboarding.sleepHours", type: "slider" },
      { key: "physical_exhaustion", label: "onboarding.exhaustion", type: "boolean" }
    ]
  },
  {
    section: "physical_exam",
    title: "onboarding.step7",
    subtitle: "onboarding.subtitle3",
    fields: [
      { key: "wound_scar_marks", label: "onboarding.woundMarks", type: "boolean" },
      { 
        key: "wound_details", 
        label: "onboarding.woundDetails", 
        type: "text", 
        placeholder: "onboarding.placeholder.wound",
        condition: (data) => data.wound_scar_marks
      },
      { key: "fractures", label: "onboarding.fractures", type: "boolean" },
      { 
        key: "fracture_details", 
        label: "onboarding.fractureDetails", 
        type: "text", 
        placeholder: "onboarding.placeholder.fracture",
        condition: (data) => data.fractures
      }
    ]
  },
  {
    section: "ent_ocular",
    title: "onboarding.step8",
    subtitle: "onboarding.subtitle3",
    fields: [
      { key: "ent_issues", label: "onboarding.entIssues", type: "multi-select", options: ENT_ISSUES },
      { key: "ocular_issues", label: "onboarding.eyeIssues", type: "multi-select", options: OCULAR_ISSUES },
      { key: "ocular_family_history", label: "onboarding.eyeHist", type: "boolean" }
    ]
  },
  {
    section: "substance_use",
    title: "onboarding.step9",
    subtitle: "onboarding.subtitle3",
    fields: [
      {
        key: "smoking",
        label: "onboarding.smoking",
        type: "select",
        options: [
          { label: "onboarding.never", value: "never" },
          { label: "onboarding.occasionally", value: "occasionally" },
          { label: "onboarding.regularly", value: "regularly" },
          { label: "onboarding.quit", value: "quit" }
        ]
      },
      { 
        key: "smoking_duration", 
        label: "onboarding.duration", 
        type: "text", 
        placeholder: "onboarding.placeholder.duration",
        condition: (data) => data.smoking && data.smoking !== "never"
      },
      { 
        key: "smoking_frequency", 
        label: "onboarding.frequency", 
        type: "text", 
        placeholder: "onboarding.placeholder.frequency",
        condition: (data) => data.smoking && data.smoking !== "never"
      },
      {
        key: "alcohol",
        label: "onboarding.alcohol",
        type: "select",
        options: [
          { label: "onboarding.never", value: "never" },
          { label: "onboarding.occasionally", value: "occasionally" },
          { label: "onboarding.regularly", value: "regularly" },
          { label: "onboarding.quit", value: "quit" }
        ]
      },
      { 
        key: "alcohol_duration", 
        label: "onboarding.duration", 
        type: "text", 
        placeholder: "onboarding.placeholder.duration",
        condition: (data) => data.alcohol && data.alcohol !== "never"
      },
      { 
        key: "alcohol_frequency", 
        label: "onboarding.frequency", 
        type: "text", 
        placeholder: "onboarding.placeholder.frequency",
        condition: (data) => data.alcohol && data.alcohol !== "never"
      },
      { key: "other_addictions", label: "onboarding.otherAddictions", type: "text", placeholder: "onboarding.placeholder.addictions" }
    ]
  },
  {
    section: "women_health",
    title: "onboarding.stepWomen",
    subtitle: "onboarding.subtitle3",
    condition: (data) => data.gender === "female",
    fields: [
      {
        key: "menstrual_flow",
        label: "onboarding.flowType",
        type: "select",
        options: [
          { label: "onboarding.light", value: "light" },
          { label: "onboarding.moderate", value: "moderate" },
          { label: "onboarding.heavy", value: "heavy" },
          { label: "onboarding.irregular", value: "irregular" }
        ]
      },
      { key: "cycle_duration", label: "onboarding.cycleDays", type: "text", placeholder: "onboarding.placeholder.cycle" },
      {
        key: "pads_per_day",
        label: "onboarding.padsPerDay",
        type: "select",
        options: [
          { label: "1", value: "1" },
          { label: "2", value: "2" },
          { label: "3", value: "3" },
          { label: "4", value: "4" },
          { label: "5", value: "5" }
        ]
      },
      { key: "menstrual_other_symptoms", label: "onboarding.otherMenstrual", type: "text", placeholder: "onboarding.placeholder.menstrual" },
      { key: "menopausal", label: "onboarding.menopausal", type: "boolean" },
      {
        key: "womens_health",
        label: "onboarding.pregnancyStatus",
        type: "select",
        options: [
          { label: "onboarding.notApplicable", value: "na" },
          { label: "onboarding.pregnant", value: "pregnant" },
          { label: "onboarding.postpartum", value: "postpartum" },
          { label: "onboarding.trying", value: "trying" }
        ]
      }
    ]
  },
  {
    section: "sexual_history",
    title: "onboarding.stepSexual",
    subtitle: "onboarding.subtitle3",
    condition: (data) => data.marital_status === "married",
    fields: [
      {
        key: "sexually_active",
        label: "onboarding.sexuallyActive",
        type: "select",
        options: [
          { label: "onboarding.yes", value: "yes" },
          { label: "onboarding.no", value: "no" },
          { label: "onboarding.preferNotToSay", value: "prefer_not_to_say" }
        ]
      }
    ]
  },
  {
    section: "investigations_imaging",
    title: "onboarding.stepInvest",
    subtitle: "onboarding.subtitle3",
    fields: [
      { key: "has_blood_report", label: "onboarding.hasBloodReport", type: "boolean" },
      {
        key: "blood_investigations",
        label: "onboarding.bloodInvest",
        type: "multi-select",
        options: BLOOD_INVESTIGATIONS.map(v => ({ label: v, value: v })),
        condition: (data) => data.has_blood_report
      },
      {
        key: "imaging_done",
        label: "onboarding.imagingDone",
        type: "multi-select",
        options: IMAGING_TYPES.map(v => ({ label: v, value: v }))
      }
    ]
  },
  {
    section: "diet_history",
    title: "onboarding.stepDiet",
    subtitle: "onboarding.subtitle3",
    fields: [
      {
        key: "diet_type",
        label: "onboarding.dietType",
        type: "select",
        options: [
          { label: "onboarding.veg", value: "veg" },
          { label: "onboarding.nonveg", value: "nonveg" },
          { label: "onboarding.vegan", value: "vegan" },
          { label: "onboarding.eggetarian", value: "eggetarian" }
        ]
      },
      {
        key: "meals_per_day",
        label: "onboarding.mealsPerDay",
        type: "select",
        options: [
          { label: "onboarding.options.diet.1meal", value: "1" },
          { label: "onboarding.options.diet.2meals", value: "2" },
          { label: "onboarding.options.diet.3meals", value: "3" },
          { label: "onboarding.options.diet.4meals", value: "4" },
          { label: "onboarding.options.diet.5meals", value: "5" }
        ]
      },
      { key: "food_type", label: "onboarding.foodType", type: "text", placeholder: "onboarding.placeholder.food" },
      {
        key: "outside_food_intake",
        label: "onboarding.outsideFood",
        type: "select",
        options: [
          { label: "onboarding.never", value: "never" },
          { label: "onboarding.rarely", value: "rarely" },
          { label: "onboarding.weekly", value: "weekly" },
          { label: "onboarding.daily", value: "daily" }
        ]
      }
    ]
  }
];
