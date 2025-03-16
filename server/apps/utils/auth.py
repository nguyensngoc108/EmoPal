import jwt
from datetime import datetime, timedelta
from django.conf import settings
from apps.users.models import User
def generate_jwt_token(user):
    """Generate a JWT token for the user"""
    # Set token to expire in 3 days
    from datetime import datetime, timedelta
    import jwt
    from django.conf import settings
    
    expiration = datetime.utcnow() + timedelta(days=3)
    
    payload = {
        'user_id': str(user.get('_id')),
        'email': user.get('email'),
        'username': user.get('username'),
        'role': user.get('role', 'user'),
        'exp': int(expiration.timestamp()),
    }
    
    token = jwt.encode(
        payload, 
        settings.SECRET_KEY, 
        algorithm='HS256'
    )
    
    # Save token to user in database
    from apps.users.models import User
    User.update_token(str(user.get('_id')), token, expiration)
    
    return token

def generate_refresh_token(user):
    """Generate a refresh token with longer expiration"""
    # Set refresh token to expire in 30 days
    expiration = datetime.utcnow() + timedelta(days=30)
    
    payload = {
        'user_id': str(user.get('_id')),
        'token_type': 'refresh',
        'exp': expiration,
    }
    
    token = jwt.encode(
        payload, 
        settings.SECRET_KEY, 
        algorithm='HS256'
    )
    
    return token

def get_user_from_request(request):
    """Get user from request using JWT token"""
    # Skip authentication for Stripe webhooks
    if request.path.endswith('/payments/webhook/'):
        return None
        
    auth_header = request.headers.get('Authorization', '')
    
    if not auth_header.startswith('Bearer '):
        return None
        
    token = auth_header.split(' ')[1]
    
    try:
        # Decode the token to get user_id
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY,
            algorithms=['HS256']
        )
        
        user_id = payload.get('user_id')
        if not user_id:
            return None
            
        # Import here to avoid circular imports
        from apps.users.models import User
        return User.find_by_id(user_id)
        
    except Exception as e:
        print(f"Authentication error: {str(e)}")
        return None