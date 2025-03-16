import os
import django
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'server.settings')
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from apps.utils.middleware import SimpleJWTAuthMiddlewareStack
from apps.chat_messages.routing import websocket_urlpatterns

# This application object handles both HTTP and WebSocket connections
application = ProtocolTypeRouter({
    "http": get_asgi_application(),  # Django's ASGI application for HTTP
    "websocket": AllowedHostsOriginValidator(
        SimpleJWTAuthMiddlewareStack(
            URLRouter(
                websocket_urlpatterns
            )
        )
    ),
})