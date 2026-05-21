const { analyzeSkinCondition } = require('../services/dermatologyService');

const runTests = () => {
    console.log("=== TESTING DERMATOLOGY AI ASSISTANT ===\n");

    const testCases = [
        {
            name: "Case 1: Typical Acne (High Confidence)",
            input: { condition_name: "Acne", confidence_score: 87, symptoms: ["redness"] }
        },
        {
            name: "Case 2: Melanoma (Serious Condition)",
            input: { condition_name: "Melanoma", confidence_score: 92, symptoms: ["itching"] }
        },
        {
            name: "Case 3: Infection (Moderate)",
            input: { condition_name: "Bacterial Infection", confidence_score: 80, symptoms: ["pain", "swelling"] }
        },
        {
            name: "Case 4: Uncertain Result (Low Confidence)",
            input: { condition_name: "Pimple", confidence_score: 42, symptoms: [] }
        }
    ];

    testCases.forEach(t => {
        console.log(`Running: ${t.name}`);
        const result = analyzeSkinCondition(t.input);
        console.log(JSON.stringify(result, null, 2));
        console.log("-----------------------------------\n");
    });
};

runTests();
