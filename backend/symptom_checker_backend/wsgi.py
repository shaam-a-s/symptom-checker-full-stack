import os
from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'symptom_checker_backend.settings')
application = get_wsgi_application()
