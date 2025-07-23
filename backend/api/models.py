from django.db import models
import uuid

class Patient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    friendly_id = models.CharField(max_length=20, unique=True, blank=True)
    name = models.CharField(max_length=100)
    age = models.CharField(max_length=10, blank=True, null=True)
    gender = models.CharField(max_length=10, blank=True, null=True)
    contact = models.CharField(max_length=20, unique=True, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.friendly_id:
            self.friendly_id = f"PAT-{str(uuid.uuid4())[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.friendly_id})"

class Checkup(models.Model):
    patient = models.ForeignKey(Patient, related_name='history', on_delete=models.CASCADE)
    symptoms = models.JSONField()
    predictions = models.JSONField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Checkup for {self.patient.name} at {self.timestamp.strftime('%Y-%m-%d %H:%M')}"
