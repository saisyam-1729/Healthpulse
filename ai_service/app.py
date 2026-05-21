from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import os
import pandas as pd
import numpy as np
from utils import check_emergency, get_prakriti_assessment, get_nearby_hospitals

app = Flask(__name__)
CORS(app)

# Load Models
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
try:
    rf_model = joblib.load(os.path.join(MODEL_DIR, 'rf_model.joblib'))
    nb_model = joblib.load(os.path.join(MODEL_DIR, 'nb_model.joblib'))
    dt_model = joblib.load(os.path.join(MODEL_DIR, 'dt_model.joblib'))
    features = joblib.load(os.path.join(MODEL_DIR, 'feature_names.joblib'))
    imputer = joblib.load(os.path.join(MODEL_DIR, 'imputer.joblib'))
    scaler = joblib.load(os.path.join(MODEL_DIR, 'scaler.joblib'))
except Exception as e:
    print(f"Models not fully loaded: {e}. Please run trainer.py first.")

@app.route('/ai/predict', methods=['POST'])
def predict_hybrid():
    data = request.json
    
    # 1. Parsing Input
    onboarding = data.get('onboarding', {})
    report_data = data.get('reportData', {})
    iot_data = data.get('iotData', {})
    
    age = int(onboarding.get('age', 30))
    gender_str = str(onboarding.get('gender', 'male')).lower()
    gender_num = 0 if gender_str == 'female' else 1
    
    hemoglobin = float(report_data.get('hemoglobin', 13.5))
    wbc = float(report_data.get('wbc', 7000))
    platelets = float(report_data.get('platelets', 250000))
    glucose = float(report_data.get('glucose', 90))
    tsh = float(report_data.get('tsh', 2.0))
    esr = float(report_data.get('esr', 10))
    
    heart_rate = float(iot_data.get('heartRate', 75))
    spo2 = float(iot_data.get('spo2', 98))
    temperature = float(iot_data.get('temperature', 37.0))
    
    # 2. Feature Engineering (Derived Flags)
    anemia_flag = int(hemoglobin < 12)
    inflammation_flag = int(esr > 20)
    diabetes_flag = int(glucose > 100)
    thyroid_flag = int(tsh > 4.2)
    stress_flag = int(heart_rate > 90)
    oxygen_flag = int(spo2 < 94)
    
    input_vector = [
        age, gender_num, hemoglobin, wbc, platelets, glucose, tsh, esr,
        heart_rate, spo2, temperature,
        anemia_flag, inflammation_flag, diabetes_flag, thyroid_flag, stress_flag, oxygen_flag
    ]
    
    input_df = pd.DataFrame([input_vector], columns=features)
    
    # 3. Preprocessing
    input_imp = imputer.transform(input_df)
    input_scaled = scaler.transform(input_imp)
    
    # 4. ML Model Prediction (Ensemble)
    p1 = rf_model.predict(input_scaled)[0]
    p2 = nb_model.predict(input_scaled)[0]
    p3 = dt_model.predict(input_scaled)[0]
    
    # Probabilities
    prob1 = np.max(rf_model.predict_proba(input_scaled))
    prob2 = np.max(nb_model.predict_proba(input_scaled))
    prob3 = np.max(dt_model.predict_proba(input_scaled))
    
    # 5. Majority Voting & Confidence
    preds = [p1, p2, p3]
    prediction = max(set(preds), key=preds.count)
    confidence = float((prob1 + prob2 + prob3) / 3.0)
    
    # 7. Safety Rule
    if confidence < 0.6:
        return "Low confidence — recommend medical consultation", 200
        
    # 8. Ayurvedic Mapping & 9. Recommendation Engine
    ayurvedic_map = {
        "Anemia": {
            "dosha": "Vata",
            "medicines": ["Ashwagandha", "Draksha"],
            "diet": ["Spinach", "Dates", "Jaggery"],
            "lifestyle": ["Sleep early", "Reduce stress"]
        },
        "Diabetes Risk": {
            "dosha": "Kapha",
            "medicines": ["Triphala", "Aloe Vera", "Karela"],
            "diet": ["High fiber", "Leafy greens", "Replace sugar"],
            "lifestyle": ["Regular exercise", "Fixed meal times"]
        },
        "Thyroid Imbalance": {
            "dosha": "Vata + Kapha",
            "medicines": ["Kanchanar Guggulu", "Ashwagandha"],
            "diet": ["Iodized salt", "Avoid raw cabbage"],
            "lifestyle": ["Yoga", "Warm environment"]
        },
        "Infection / Inflammation": {
            "dosha": "Pitta",
            "medicines": ["Tulsi", "Giloy", "Neem"],
            "diet": ["Cooling foods", "Sip warm water"],
            "lifestyle": ["Rest adequately", "Practice Nasya"]
        },
        "Normal": {
            "dosha": "Balanced",
            "medicines": ["Amritarishta"],
            "diet": ["Balanced diet", "Fresh fruits"],
            "lifestyle": ["Maintain routine", "Seasonal detox"]
        }
    }
    
    ayurveda = ayurvedic_map.get(prediction, ayurvedic_map["Normal"])
    
    # 10. Final Output
    return jsonify({
        "prediction": {
            "disease": prediction,
            "confidence": round(confidence, 4)
        },
        "clinical_flags": {
            "anemia_flag": bool(anemia_flag),
            "inflammation_flag": bool(inflammation_flag),
            "diabetes_flag": bool(diabetes_flag),
            "thyroid_flag": bool(thyroid_flag),
            "stress_flag": bool(stress_flag),
            "oxygen_flag": bool(oxygen_flag)
        },
        "ayurveda": ayurveda,
        "safety": {
            "alert": bool(confidence < 0.6) # Although handled above, kept for strict mapping consistency
        }
    })

# Kept for backward compatibility with frontend/backend
@app.route('/analyze', methods=['POST'])
def analyze():
    # Existing compatibility stub
    data = request.json
    symptoms = data.get('symptoms', [])
    onboarding = data.get('onboardingData', {})
    vitals = data.get('vitals', {})
    location = data.get('location', {})
    
    is_emergency, emergency_msg = check_emergency(vitals, onboarding)
    if is_emergency:
        return jsonify({
            'type': 'EMERGENCY',
            'message': emergency_msg,
            'hospitals': get_nearby_hospitals(location.get('lat'), location.get('lng'))
        })

    # Return dummy fallback if old route used
    return jsonify({
        'type': 'NORMAL',
        'predictedDisease': 'Check /ai/predict for robust analysis',
        'healthScore': 85,
        'riskLevel': 'low',
        'dosha': 'Vata',
        'recommendations': {'medicines': [], 'lifestyle': [], 'diet': []},
        'hospitals': []
    })

if __name__ == '__main__':
    if not os.path.exists(MODEL_DIR):
        print("Training models...")
        import trainer
    app.run(port=5002, debug=True)
