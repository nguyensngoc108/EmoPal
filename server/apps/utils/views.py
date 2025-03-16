from django.views.generic import TemplateView
from django.views.decorators.cache import never_cache
from django.http import HttpResponse
import os
from django.conf import settings

@never_cache
def index(request):
    try:
        with open(os.path.join(settings.REACT_APP_DIR, 'index.html')) as f:
            return HttpResponse(f.read())
    except FileNotFoundError:
        return HttpResponse(
            """
            <h1>React App Not Found</h1>
            <p>Build your React app first</p>
            """,
            status=501,
        )