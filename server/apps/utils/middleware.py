import jwt
from django.http import JsonResponse
from django.conf import settings
from ..users.models import User
from ..therapists.models import Therapist
from bson import ObjectId
from channels.middleware import BaseMiddleware
from channels.auth import AuthMiddlewareStack
from django.db import close_old_connections
from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from channels.sessions import CookieMiddleware, SessionMiddleware

class HttpJWTAuthMiddleware:  # RENAMED from JWTAuthMiddleware
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Skip authentication for Stripe webhooks completely
        if request.path == '/api/payments/webhook/' or request.path.endswith('/payments/webhook/'):
            return self.get_response(request)
            
        # Skip authentication for certain paths
        if (
            not request.path.startswith('/api/') or 
            request.path in ['/api/users/login/', '/api/users/register/', '/api/token/', '/api/token/refresh/'] or
            request.path.startswith('/api/therapists/register')
        ):
            return self.get_response(request)
            
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return JsonResponse({
                "success": False, 
                "message": "Authorization header required"
            }, status=401)
            
        token = auth_header.split(' ')[1]
        
        try:
            # Decode and verify token
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY,
                algorithms=['HS256']
            )
            
            # Check if token matches the one stored in database
            user_id = payload.get('user_id')
            if not user_id:
                raise jwt.InvalidTokenError("Invalid token payload")
                
            # Convert string ID to ObjectId if it's a valid format
            if len(user_id) == 24 and all(c in '0123456789abcdef' for c in user_id):
                user = User.find_by_id(user_id)
            else:
                # Handle non-standard IDs used in testing
                user = None
                
            if not user:
                return JsonResponse({
                    "success": False, 
                    "message": "User not found"
                }, status=401)
                
            # Check if token matches stored token
            stored_token = user.get('token')
            if not stored_token or stored_token != token:
                return JsonResponse({
                    "success": False, 
                    "message": "Invalid or expired token"
                }, status=401)
                
            request.user = user
                
        except jwt.ExpiredSignatureError:
            return JsonResponse({
                "success": False, 
                "message": "Token has expired"
            }, status=401)
        except jwt.InvalidTokenError as e:
            return JsonResponse({
                "success": False, 
                "message": f"Invalid token: {str(e)}"
            }, status=401)
            
        return self.get_response(request)

class JWTAuthMiddleware(BaseMiddleware):
    """Custom JWT authentication for WebSockets that works with MongoDB users"""
    
    async def __call__(self, scope, receive, send):
        """Process the connection, including WebSocket handshake."""
        # Extract authentication token:
        # 1. First check headers for HTTP requests
        headers = dict(scope.get('headers', []))
        # 2. Then check query string for WebSocket connections
        auth_token = None
        
        # For WebSocket connections, check query parameters
        if scope['type'] == 'websocket':
            query_string = scope.get('query_string', b'').decode()
            query_params = {k: v[0] for k, v in parse_qs(query_string).items()}
            auth_token = query_params.get('token')
            
            # If no token in query string, try to get from headers
            if not auth_token and b'authorization' in headers:
                auth_header = headers[b'authorization'].decode()
                if auth_header.startswith('Bearer '):
                    auth_token = auth_header[7:]
        
        # For HTTP requests, get token from headers
        elif scope['type'] == 'http' and b'authorization' in headers:
            auth_header = headers[b'authorization'].decode()
            if auth_header.startswith('Bearer '):
                auth_token = auth_header[7:]
        
        if not auth_token:
            if scope['type'] == 'websocket':
                print("No authentication token provided")
                await self.reject_websocket(scope, receive, send)
                return
            else:
                # For HTTP requests without token, just pass through to next middleware
                return await self.inner(scope, receive, send)
        
        # Verify token and get user
        try:
            user = self.verify_token(auth_token)
            if user:
                # Attach user to scope
                scope['user'] = user
                # Pass to inner application
                return await self.inner(scope, receive, send)
            else:
                if scope['type'] == 'websocket':
                    await self.reject_websocket(scope, receive, send)
                    return
        except Exception as e:
            print(f"Token verification error: {str(e)}")
            if scope['type'] == 'websocket':
                await self.reject_websocket(scope, receive, send)
                return
        
        # If we got here with a WebSocket, reject it
        if scope['type'] == 'websocket':
            await self.reject_websocket(scope, receive, send)
        else:
            return await self.inner(scope, receive, send)

    async def reject_websocket(self, scope, receive, send):
        """Helper method to reject WebSocket connections."""
        await send({
            "type": "websocket.close",
            "code": 4003,  # Custom close code for auth failure
        })
    
    @database_sync_to_async
    def get_user(self, user_id):
        """Get user from MongoDB"""
        return User.find_by_id(user_id)


# Create a shortcut function
def JWTAuthMiddlewareStack(inner):
    from channels.sessions import CookieMiddleware, SessionMiddleware
    return CookieMiddleware(SessionMiddleware(JWTAuthMiddleware(inner)))

# Add this new class to handle WebSocket auth more robustly
# Update the SimpleJWTAuthMiddleware to get user from session and/or cookies

class SimpleJWTAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # Add default user to scope
        scope['user'] = None
        
        # Check if this is a websocket connection
        if scope["type"] != "websocket":
            return await self.app(scope, receive, send)
        
        # First try to get user ID from session
        session = scope.get("session", {})
        user_id = session.get("user_id")
        
        if not user_id:
            # Try to get from cookies
            cookies = dict(scope.get("cookies", {}))
            user_id = cookies.get("user_id")
        
        if not user_id:
            # Try to get from query string
            query_string = scope.get("query_string", b"").decode()
            query_params = dict(qp.split('=') for qp in query_string.split('&') if '=' in qp)
            user_id = query_params.get("user_id")
        
        if user_id:
            # We found a user ID, get user from database
            try:
                user = await self.get_user(user_id)
                if user:
                    scope['user'] = user
                    print(f"WebSocket authenticated: {user_id}")
                else:
                    print(f"User not found for WebSocket connection: {user_id}")
            except Exception as e:
                print(f"Error getting user for WebSocket: {str(e)}")
        else:
            print("No user ID found for WebSocket connection")
            
        # Proceed with connection regardless of auth success
        # ChatConsumer will check for valid user and reject if needed
        return await self.app(scope, receive, send)

    @database_sync_to_async
    def get_user(self, user_id):
        return User.find_by_id(user_id)

# Create a shortcut function like Django's AuthMiddlewareStack
def SimpleJWTAuthMiddlewareStack(inner):
    return CookieMiddleware(SessionMiddleware(SimpleJWTAuthMiddleware(inner)))