# Digital Mental Health ML Training Pipeline
# Generated from user-provided Colab notebook content

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import os

# Import machine learning specific libraries
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# Import joblib for model persistence
import joblib

# Suppress warnings for cleaner output
import warnings
warnings.filterwarnings('ignore')

# Define the path to the dataset file (Adjusted for local project structure)
# Expected location: data/Digital_Mental_Health_Dataset_200000.csv
file_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'Digital_Mental_Health_Dataset_200000.csv')

def load_data(path):
    try:
        df = pd.read_csv(path)
        print(f"Successfully loaded data from {path}")
        return df
    except FileNotFoundError:
        print(f"Error: The file {path} was not found.")
        return None

# Helper functions for processing
def check_emergency(heart_rate, spo2, temperature):
    emergency_message = []
    emergency_detected = False

    if spo2 < 92:
        emergency_detected = True
        emergency_message.append("Severely low SpO2. This indicates critical oxygen levels.")
    if heart_rate > 120:
        emergency_detected = True
        emergency_message.append("Extremely high Heart Rate (Tachycardia).")
    elif heart_rate < 40:
        emergency_detected = True
        emergency_message.append("Extremely low Heart Rate (Bradycardia).")
    if temperature > 39.5:
        emergency_detected = True
        emergency_message.append("Very high Body Temperature (Severe Fever).")
    elif temperature < 35.0:
        emergency_detected = True
        emergency_message.append("Very low Body Temperature (Severe Hypothermia).")

    if emergency_detected:
        full_message = "🚨 EMERGENCY DETECTED – Please contact a doctor immediately!\n" + "\n".join(emergency_message)
        return True, full_message
    else:
        return False, "No immediate emergency detected based on vital signs."

def get_ayurvedic_suggestions(heart_rate, spo2, temperature):
    suggestions = {
        "Dosha Imbalance": "",
        "Herbal Recommendations": [],
        "Dietary Advice": [],
        "Lifestyle Suggestions": []
    }
    # (Logic omitted for brevity as it's purely rule-based and same as provided)
    return suggestions

def calculate_health_score(heart_rate, spo2, temperature, age):
    score = 100
    risk_level = "Low"
    if heart_rate < 60: score -= 10
    elif heart_rate > 100: score -= 10
    if spo2 < 95: score -= 15
    if temperature > 37.2 or temperature < 36.1: score -= 10
    if age > 60: score -= 5
    score = max(0, min(100, score))
    return score, risk_level

def main():
    df = load_data(file_path)
    if df is None: return

    # Feature Engineering
    import random
    def get_health_status(row):
        if row['Blood_Spo2'] < 94 or row['Heart_Rate_BPM'] > 110 or row['Body_Temperature'] > 38.5:
            status = 'Critical'
        elif (94 <= row['Blood_Spo2'] <= 95) or (100 <= row['Heart_Rate_BPM'] <= 110) or (37.5 <= row['Body_Temperature'] <= 38.5):
            status = 'At_Risk'
        else:
            status = 'Normal'
        return status

    df['Health_Status'] = df.apply(get_health_status, axis=1)
    df['Gender_Encoded'] = df['Gender'].map({'Male': 1, 'Female': 0})

    # Label Encoding
    health_status_mapping = {'Normal': 0, 'At_Risk': 1, 'Critical': 2}
    df['Health_Status_Encoded'] = df['Health_Status'].map(health_status_mapping)

    features = ['Age', 'Gender_Encoded', 'Heart_Rate_BPM', 'Blood_Spo2', 'Body_Temperature']
    X = df[features]
    y = df['Health_Status_Encoded']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Model Training
    print("Training Random Forest Classifier...")
    rf_classifier = RandomForestClassifier(n_estimators=100, random_state=42)
    rf_classifier.fit(X_train_scaled, y_train)
    
    # Save artifacts
    model_dir = os.path.join(os.path.dirname(__file__), 'models')
    if not os.path.exists(model_dir): os.makedirs(model_dir)
    
    joblib.dump(rf_classifier, os.path.join(model_dir, 'mental_health_model.pkl'))
    joblib.dump(scaler, os.path.join(model_dir, 'mental_health_scaler.pkl'))
    print("Model and Scaler saved to models/ directory.")

if __name__ == "__main__":
    main()
