from django.contrib import admin
from .models import Patient, Checkup

admin.site.register(Patient)
admin.site.register(Checkup)