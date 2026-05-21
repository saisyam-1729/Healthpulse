/**
 * Dermatology AI Assistant Service
 * 8-Step logic for skin condition interpretation and clinical guidance.
 */

const analyzeSkinCondition = ({ condition_name, confidence_score, symptoms = [] }) => {
    const condition = condition_name || "Unknown";
    const confidence = parseFloat(confidence_score) || 0;
    
    // STEP 1 — CONDITION INTERPRETATION & STEP 2 — SEVERITY ESTIMATION
    let severity = "mild";
    let consult_doctor = false;
    let warning = "";

    const lowerCondition = condition.toLowerCase();
    
    // Severity Rules
    if (confidence < 50) {
        severity = "uncertain";
    } else if (
        lowerCondition.includes("melanoma") || 
        lowerCondition.includes("cancer") || 
        lowerCondition.includes("malignant") ||
        lowerCondition.includes("deep wound")
    ) {
        severity = "severe";
        consult_doctor = true;
    } else if (
        lowerCondition.includes("infection") || 
        lowerCondition.includes("cellulitis") ||
        symptoms.includes("pain") || 
        symptoms.includes("swelling")
    ) {
        severity = "moderate";
        consult_doctor = true;
    } else {
        severity = "mild";
    }

    // STEP 7 — WARNING MESSAGE
    if (severity === "severe" || confidence < 50) {
        warning = "This assessment may not be fully accurate. Please consult a dermatologist.";
    }

    // STEP 3, 4, 5 — KNOWLEDGE BASE
    const knowledgeBase = {
        "acne": {
            description: "A common skin condition caused by clogged pores and excess oil.",
            medical: ["Use mild face wash twice daily", "Apply over-the-counter acne cream containing salicylic acid"],
            ayurvedic: ["Apply neem paste on affected area", "Use aloe vera gel regularly"],
            lifestyle: ["Avoid oily foods", "Drink plenty of water", "Do not touch pimples frequently"]
        },
        "pimple": {
            description: "Small skin inflammation typically caused by bacteria or clogged pores.",
            medical: ["Apply benzoyl peroxide gel", "Keep face clean with oil-free cleanser"],
            ayurvedic: ["Sandalwood and turmeric paste application", "Wash face with Triphala water"],
            lifestyle: ["Change pillowcases frequently", "Reduce dairy intake", "Avoid stress"]
        },
        "scar": {
            description: "A mark left on the skin after a surface injury or acne has healed.",
            medical: ["Use silicone gel sheets", "Apply vitamin E oil", "Consider chemical peels if persistent"],
            ayurvedic: ["Massage with Kumkumadi Tailam", "Apply fresh aloe vera pulp"],
            lifestyle: ["Use sunscreen to prevent darkening", "Maintain skin hydration", "Patience with healing time"]
        },
        "rash": {
            description: "An area of irritated or swollen skin, often itchy or red.",
            medical: ["Apply mild hydrocortisone cream", "Use calamine lotion for itching"],
            ayurvedic: ["Coconut oil application", "Cooling sandalwood paste", "Avoid harsh soaps"],
            lifestyle: ["Wear loose cotton clothing", "Identify and avoid allergens", "Stay in cool environment"]
        },
        "infection": {
            description: "Invasion of skin tissue by bacteria, fungi, or viruses.",
            medical: ["Apply topical antiseptic or antibiotic cream", "Keep the area clean and dry"],
            ayurvedic: ["Neem bark decoction wash", "Turmeric and honey application (anti-microbial)"],
            lifestyle: ["Avoid sharing personal items like towels", "Boost immunity with balanced diet", "Monitor for spreading redness"]
        },
        "wound": {
            description: "A break in the skin's surface, typically caused by a cut, scrape, or impact.",
            medical: ["Clean with saline solution", "Apply antiseptic ointment", "Cover with a sterile bandage"],
            ayurvedic: ["Apply Turmeric paste (anti-inflammatory)", "Use Jatyadi Tailam for faster healing"],
            lifestyle: ["Keep the area dry", "Monitor for signs of infection (pus, warmth)", "Avoid picking at scabs"]
        },
        "cut": {
            description: "A narrow opening in the skin caused by a sharp object.",
            medical: ["Apply pressure to stop bleeding", "Clean thoroughly", "Apply antibiotic ointment"],
            ayurvedic: ["Apply fresh Aloe Vera gel", "Use Calendula ointment"],
            lifestyle: ["Keep the wound clean", "Protect from dirt and debris"]
        },
        "melanoma": {
            description: "A serious type of skin cancer that develops from pigment-producing cells.",
            medical: ["URGENT: Surgical evaluation required", "Biopsy for definitive diagnosis"],
            ayurvedic: ["Supportive herbs like Ashwagandha (Consult professional)", "Antioxidant rich diet"],
            lifestyle: ["Strict sun protection", "Regular full-body skin checks", "Avoid tanning beds"]
        },
        "default": {
            description: "A detected skin anomaly requiring observation.",
            medical: ["Keep area clean", "Monitor for changes in size, color, or shape"],
            ayurvedic: ["Aloe vera application for soothing", "Coconut oil for barrier protection"],
            lifestyle: ["Maintain hygiene", "Avoid scratching the area", "Protect from sun exposure"]
        }
    };

    const key = Object.keys(knowledgeBase).find(k => lowerCondition.includes(k)) || "default";
    const data = knowledgeBase[key];

    // STEP 6 — RISK & SAFETY CHECK (Final Override)
    if (severity === "severe" || symptoms.includes("spreading") || symptoms.includes("painful")) {
        consult_doctor = true;
    }

    // STEP 8 — OUTPUT FORMAT (STRICT JSON)
    return {
        condition: condition,
        confidence: Math.round(confidence),
        severity: severity,
        description: data.description,
        medical_advice: data.medical,
        ayurvedic_advice: data.ayurvedic,
        lifestyle: data.lifestyle,
        advice: [...(data.medical || []), ...(data.ayurvedic || [])],
        consult_doctor: consult_doctor,
        warning: warning
    };
};

module.exports = { analyzeSkinCondition };
