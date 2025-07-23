from django.urls import path


from .views import DiagnoseView, PatientView, PatientHistoryView, ExtractSymptomsView, EmailReportView, PatientLookupView, AllSymptomsView,PatientSearchView,AllSymptomsView

urlpatterns = [
    path('patients/search/', PatientSearchView.as_view(), name='patient-search'),
    path('diagnose/', DiagnoseView.as_view()),
    path('patients/', PatientView.as_view()),
    path('patients/lookup/', PatientLookupView.as_view()),
    path('patients/<uuid:patient_id>/history/', PatientHistoryView.as_view()),
    path('extract-symptoms/', ExtractSymptomsView.as_view()),
    path('email-report/', EmailReportView.as_view()),
    path('symptoms/', AllSymptomsView.as_view()),
    path('symptoms/', AllSymptomsView.as_view(), name='all-symptoms'),
]