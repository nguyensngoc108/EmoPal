from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from apps.users.models import User

class TokenAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        # Get the session from scope
        session = scope.get('session', {})
        user_id = session.get('user_id')
        
        if user_id:
            # Add user to scope
            scope['user_id'] = user_id
            scope['user'] = await self.get_user(user_id)
        else:
            # Add empty user to scope
            scope['user_id'] = None
            scope['user'] = None
        
        return await super().__call__(scope, receive, send)
    
    @database_sync_to_async
    def get_user(self, user_id):
        """Get user from database asynchronously"""
        return User.find_by_id(user_id)