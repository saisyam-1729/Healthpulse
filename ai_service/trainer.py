import os
import posixpath
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
import joblib

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
if not os.path.exists(MODEL_DIR):
    os.makedirs(MODEL_DIR)

# --- 1. Dataset Generation ---
# In lieu of a direct Kaggle/UCI download (to ensure repeatability and no external dependencies here),
# we generate a robust synthetic clinical dataset representing physical/medical bounds.

def generate_data(n_samples=1500):
    np.random.seed(42)
    classes = ['Anemia', 'Diabetes Risk', 'Thyroid Imbalance', 'Infection / Inflammation', 'Normal']
    
    # Base feature arrays
    data = {
        'age': np.random.randint(18, 80, n_samples),
        'gender': np.random.randint(0, 2, n_samples), # 0: F, 1: M
        'hemoglobin': np.random.normal(13.5, 1.5, n_samples),
        'wbc': np.random.normal(7000, 1500, n_samples),
        'platelets': np.random.normal(250000, 50000, n_samples),
        'glucose': np.random.normal(90, 10, n_samples),
        'tsh': np.random.normal(2.0, 0.8, n_samples),
        'esr': np.random.normal(10, 5, n_samples),
        'heartRate': np.random.normal(75, 8, n_samples),
        'spo2': np.random.normal(98, 1, n_samples),
        'temperature': np.random.normal(37.0, 0.3, n_samples),
        'disease': np.random.choice(classes, n_samples)
    }
    
    df = pd.DataFrame(data)
    
    # Introduce class-specific biases to create meaningful patterns
    
    # Anemia (Low Hb)
    df.loc[df['disease'] == 'Anemia', 'hemoglobin'] = np.random.normal(10.5, 1.0, sum(df['disease'] == 'Anemia'))
    
    # Diabetes Risk (High glucose)
    df.loc[df['disease'] == 'Diabetes Risk', 'glucose'] = np.random.normal(130, 20, sum(df['disease'] == 'Diabetes Risk'))
    
    # Thyroid Imbalance (High TSH)
    df.loc[df['disease'] == 'Thyroid Imbalance', 'tsh'] = np.random.normal(6.5, 1.5, sum(df['disease'] == 'Thyroid Imbalance'))
    
    # Infection / Inflammation (High ESR, High WBC, High Temp)
    inflam_mask = df['disease'] == 'Infection / Inflammation'
    df.loc[inflam_mask, 'esr'] = np.random.normal(35, 10, sum(inflam_mask))
    df.loc[inflam_mask, 'wbc'] = np.random.normal(12000, 2000, sum(inflam_mask))
    df.loc[inflam_mask, 'temperature'] = np.random.normal(38.5, 0.5, sum(inflam_mask))
    
    # Adding some noise (missing values) to simulate real-world data
    for col in ['hemoglobin', 'wbc', 'glucose', 'tsh', 'esr']:
        df.loc[df.sample(frac=0.05).index, col] = np.nan
        
    return df

df = generate_data()

# --- 2. Feature Engineering ---

def create_derived_features(df):
    # Rule-based derived features as per constraints
    df['anemia_flag'] = (df['hemoglobin'] < 12).astype(int)
    df['inflammation_flag'] = (df['esr'] > 20).astype(int)
    df['diabetes_flag'] = (df['glucose'] > 100).astype(int)
    df['thyroid_flag'] = (df['tsh'] > 4.2).astype(int)
    df['stress_flag'] = (df['heartRate'] > 90).astype(int)
    df['oxygen_flag'] = (df['spo2'] < 94).astype(int)
    return df

df = create_derived_features(df)

# Defined feature list (original numericals + derived flags)
feature_cols = [
    'age', 'gender', 'hemoglobin', 'wbc', 'platelets', 'glucose', 'tsh', 'esr', 
    'heartRate', 'spo2', 'temperature',
    'anemia_flag', 'inflammation_flag', 'diabetes_flag', 'thyroid_flag', 'stress_flag', 'oxygen_flag'
]

X = df[feature_cols]
y = df['disease']

# --- 3. Preprocessing (Impute & Normalize) ---
# Train/Test Split (80/20) as instructed
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)

imputer = SimpleImputer(strategy='median')
X_train_imp = imputer.fit_transform(X_train)
X_test_imp = imputer.transform(X_test)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train_imp)
X_test_scaled = scaler.transform(X_test_imp)

# --- 4. Model Training (Ensemble of 3) ---
print("Training models...")
rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
nb_model = GaussianNB()
dt_model = DecisionTreeClassifier(random_state=42)

rf_model.fit(X_train_scaled, y_train)
nb_model.fit(X_train_scaled, y_train)
dt_model.fit(X_train_scaled, y_train)

# Evaluate simple accuracy
rf_acc = rf_model.score(X_test_scaled, y_test)
print(f"Random Forest Accuracy: {rf_acc:.2f}")

# Save models and preprocessors
joblib.dump(rf_model, os.path.join(MODEL_DIR, 'rf_model.joblib'))
joblib.dump(nb_model, os.path.join(MODEL_DIR, 'nb_model.joblib'))
joblib.dump(dt_model, os.path.join(MODEL_DIR, 'dt_model.joblib'))
joblib.dump(imputer, os.path.join(MODEL_DIR, 'imputer.joblib'))
joblib.dump(scaler, os.path.join(MODEL_DIR, 'scaler.joblib'))
joblib.dump(feature_cols, os.path.join(MODEL_DIR, 'feature_names.joblib'))

print("All artifacts successfully saved to:", MODEL_DIR)
