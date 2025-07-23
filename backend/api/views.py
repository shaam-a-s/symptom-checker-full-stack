from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers
import joblib
import os
import numpy as np
import json
from django.conf import settings
from django.core.mail import EmailMessage
from django.template.loader import get_template
from .models import Patient, Checkup
from xhtml2pdf import pisa
from io import BytesIO
import phonenumbers
from django.db.models import Q # Add this import at the top of the file
from django.http import HttpResponse


try:
    model_path = os.path.join(settings.BASE_DIR, 'saved_model', 'disease_prediction_model.joblib')
    le_path = os.path.join(settings.BASE_DIR, 'saved_model', 'label_encoder.joblib')
    vectorizer_path = os.path.join(settings.BASE_DIR, 'saved_model', 'tfidf_vectorizer.joblib')
    details_path = os.path.join(settings.BASE_DIR, 'saved_model', 'disease_details.json')
    symptom_list_path = os.path.join(settings.BASE_DIR, 'saved_model', 'master_symptom_list.json')

    model = joblib.load(model_path)
    le = joblib.load(le_path)
    vectorizer = joblib.load(vectorizer_path)
    with open(details_path, 'r') as f: disease_details_db = json.load(f)
    with open(symptom_list_path, 'r') as f: master_symptom_list = json.load(f)
    MODEL_LOADED = True
except FileNotFoundError as e:
    MODEL_LOADED = False
    print(f"WARNING: Could not load a required file. Error: {e}")

class PatientSerializer(serializers.ModelSerializer):
    contact = serializers.CharField(required=True)
    def validate_contact(self, value):
        try:
            parsed_number = phonenumbers.parse(value, None)
            if not phonenumbers.is_valid_number(parsed_number):
                raise serializers.ValidationError("Invalid phone number.")
        except phonenumbers.phonenumberutil.NumberParseException:
            raise serializers.ValidationError("Invalid phone number format.")
        return value
    class Meta:
        model = Patient
        fields = '__all__'

class CheckupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Checkup
        fields = '__all__'

class AllSymptomsView(APIView):
    def get(self, request, *args, **kwargs):
        if not MODEL_LOADED:
            return Response({"error": "Symptom list not loaded"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(master_symptom_list, status=status.HTTP_200_OK)

class ExtractSymptomsView(APIView):
    def post(self, request, *args, **kwargs):
        text = request.data.get('text', '').lower()
        if not text:
            return Response({"error": "No text provided"}, status=status.HTTP_400_BAD_REQUEST)
        found_symptoms = [s for s in master_symptom_list if s.lower() in text]
        return Response(list(set(found_symptoms)), status=status.HTTP_200_OK)

class PatientLookupView(APIView):
    def post(self, request, *args, **kwargs):
        friendly_id = request.data.get('friendly_id')
        if not friendly_id:
            return Response({"error": "Patient ID is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            patient = Patient.objects.get(friendly_id__iexact=friendly_id)
            serializer = PatientSerializer(patient)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Patient.DoesNotExist:
            return Response({"error": "Patient with this ID not found."}, status=status.HTTP_404_NOT_FOUND)

class PatientView(APIView):
    def post(self, request, *args, **kwargs):
        contact = request.data.get('contact')
        name = request.data.get('name')
        patient = None
        if contact: patient = Patient.objects.filter(contact=contact).first()
        if not patient and name: patient = Patient.objects.filter(name=name).first()
        
        if patient:
            serializer = PatientSerializer(patient)
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            serializer = PatientSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PatientHistoryView(APIView):
    def get(self, request, patient_id, *args, **kwargs):
        try:
            patient = Patient.objects.get(id=patient_id)
            history = patient.history.all()
            serializer = CheckupSerializer(history, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Patient.DoesNotExist:
            return Response({"error": "Patient not found"}, status=status.HTTP_404_NOT_FOUND)

class DiagnoseView(APIView):
    def post(self, request, *args, **kwargs):
        if not MODEL_LOADED:
            return Response({"error": "AI model is not loaded"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        symptoms = request.data.get('symptoms', [])
        patient_id = request.data.get('patientId')
        patient_gender = request.data.get('gender', 'Any').capitalize()

        if not all([symptoms, patient_id, patient_gender]):
            return Response({"error": "Symptoms, patientId, and gender are required"}, status=status.HTTP_400_BAD_REQUEST)

        symptom_string = " ".join(symptoms)
        symptom_vectorized = vectorizer.transform([symptom_string])
        probabilities = model.predict_proba(symptom_vectorized)[0]
        
        disease_indices = np.argsort(probabilities)[::-1]
        
        predictions = []
        for index in disease_indices:
            disease_name = le.inverse_transform([index])[0].strip()
            disease_info = disease_details_db.get(disease_name, {})
            
            if disease_info.get('gender') == 'Any' or disease_info.get('gender') == patient_gender:
                predictions.append({'name': disease_name, 'probability': probabilities[index], 'info': disease_info})
            if len(predictions) >= 5:
                break
        
        if not predictions:
            return Response([], status=status.HTTP_200_OK)

        top_probs = np.array([p['probability'] for p in predictions])
        prob_sum = top_probs.sum()

        final_predictions = []
        for i, pred in enumerate(predictions[:3]):
            normalized_prob = (pred['probability'] / prob_sum) * 100 if prob_sum > 0 else 33
            if i == 0: final_prob = int(min(98, 60 + normalized_prob / 4))
            else: final_prob = int(max(5, normalized_prob))
            
            final_predictions.append({
                'disease': pred['name'],
                'probability': final_prob,
                'description': pred['info'].get('description', 'No description available.'),
                'actions': [
                    "Consult a healthcare professional for an accurate diagnosis.",
                    "Follow the medical advice provided by your doctor.",
                    "Monitor your symptoms and report any changes."
                ]
            })

        try:
            patient = Patient.objects.get(id=patient_id)
            Checkup.objects.create(patient=patient, symptoms=symptoms, predictions=final_predictions)
        except Patient.DoesNotExist:
            return Response({"error": "Patient not found for saving checkup"}, status=status.HTTP_404_NOT_FOUND)
            
        return Response(final_predictions, status=status.HTTP_200_OK)


class EmailReportView(APIView):
    def post(self, request, *args, **kwargs):
        data = request.data
        print(data);
        is_pdf_download = data.get('as_pdf', False)

        try:
            # Render the HTML template with the provided data
            template = get_template('report_template.html')
            html = template.render(data)
            
            # Create a PDF file in memory
            pdf_file = BytesIO()
            pisa_status = pisa.CreatePDF(html, dest=pdf_file)
            if pisa_status.err:
                return Response({'error': 'Error generating PDF'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            pdf_file.seek(0)

            # If the request is for a PDF download, return the file directly
            if is_pdf_download:
                response = HttpResponse(pdf_file, content_type='application/pdf')
                response['Content-Disposition'] = f'attachment; filename="Diagnosis_Report_{data["patient"]["friendly_id"]}.pdf"'
                return response

            # Otherwise, attach the PDF to an email and send it
            email = EmailMessage(
                'Your AI Health Diagnosis Report',
                'Please find your diagnosis report attached.',
                settings.DEFAULT_FROM_EMAIL,
                [data['recipient_email']],
            )
            email.attach('Diagnosis_Report.pdf', pdf_file.getvalue(), 'application/pdf')
            email.send()
            
            return Response({"message": "Report sent successfully!"}, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"Email/PDF Error: {e}") # For debugging on the server
            return Response({"error": "An unexpected error occurred while processing the report."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Add this new class at the very bottom of the file
class PatientSearchView(APIView):
    def post(self, request, *args, **kwargs):
        query = request.data.get('query', '')
        if len(query) < 2:
            return Response([], status=status.HTTP_200_OK)

        # Search for patients where the name OR friendly_id contains the query
        patients = Patient.objects.filter(
            Q(name__icontains=query) | Q(friendly_id__icontains=query)
        )[:5] # Limit to 5 results for performance

        # Return only the necessary info for suggestions
        results = [
            {'name': p.name, 'friendly_id': p.friendly_id} for p in patients
        ]
        return Response(results, status=status.HTTP_200_OK)
# Add this new class at the very bottom of the file
class AllSymptomsView(APIView):
    def get(self, request, *args, **kwargs):
        if not MODEL_LOADED:
            return Response({"error": "Symptom list not loaded"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(master_symptom_list, status=status.HTTP_200_OK)
