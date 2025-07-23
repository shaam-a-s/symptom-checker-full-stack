import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
from sklearn.naive_bayes import MultinomialNB
import joblib
import os
import json

print("Starting AI model and data generation...")

# --- Step 1: Load the new, larger dataset from CSV ---
try:
    df = pd.read_csv('symptom_data_enhanced.csv')
    print("Dataset loaded successfully.")
except FileNotFoundError:
    print("Error: 'symptom_data_enhanced.csv' not found. Please make sure the file is in the same directory.")
    exit()

# --- FIX: Data Cleaning Step ---
df.dropna(subset=['Symptoms'], inplace=True)
df['Symptoms'] = df['Symptoms'].astype(str)
df['Symptoms'] = df['Symptoms'].str.replace('_', ' ')

# --- Step 2: Create Disease Details JSON ---
disease_details = {}
for index, row in df.iterrows():
    disease_name = row['Disease'].strip()
    disease_details[disease_name] = {
        'description': row['Description'],
        'gender': row['Gender']
    }

output_dir = 'saved_model'
os.makedirs(output_dir, exist_ok=True)
details_path = os.path.join(output_dir, 'disease_details.json')
with open(details_path, 'w') as f:
    json.dump(disease_details, f, indent=4)

print(f"Disease details saved to '{details_path}'")

# --- Step 3: Create Master Symptom List for NLP ---
all_symptoms = set()
for s in df['Symptoms']:
    for symptom in s.split(','):
        all_symptoms.add(symptom.strip())

master_symptom_list_path = os.path.join(output_dir, 'master_symptom_list.json')
with open(master_symptom_list_path, 'w') as f:
    json.dump(list(all_symptoms), f, indent=4)

print(f"Master symptom list saved to '{master_symptom_list_path}'")

# --- Step 4: Feature Engineering and Label Encoding for the AI Model ---
X = df['Symptoms']
y = df['Disease']
le = LabelEncoder()
y_encoded = le.fit_transform(y)
vectorizer = TfidfVectorizer()
X_vectorized = vectorizer.fit_transform(X)

print("Features vectorized and labels encoded.")

# --- Step 5: Train the Model ---
model = MultinomialNB()
model.fit(X_vectorized, y_encoded)

print("Model trained successfully.")

# --- Step 6: Save the Model and Supporting Objects ---
joblib.dump(model, os.path.join(output_dir, 'disease_prediction_model.joblib'))
joblib.dump(le, os.path.join(output_dir, 'label_encoder.joblib'))
joblib.dump(vectorizer, os.path.join(output_dir, 'tfidf_vectorizer.joblib'))

print(f"Model and helper objects saved in '{output_dir}' directory.")
print("\nIMPORTANT: Delete the old 'saved_model' folder from 'backend' and move this new one there.")