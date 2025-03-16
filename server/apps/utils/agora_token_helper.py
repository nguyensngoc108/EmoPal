import logging
from .RtcTokenBuilder2 import RtcTokenBuilder, Role_Publisher

logger = logging.getLogger(__name__)

def generate_rtc_token(app_id, app_certificate, channel_name, uid, expiration_seconds=3600):
    """
    Generate an Agora RTC token
    
    Args:
        app_id: Agora App ID
        app_certificate: Agora App Certificate 
        channel_name: Channel name for the session
        uid: User ID (integer)
        expiration_seconds: Token expiration in seconds (default: 3600)
        
    Returns:
        str: Generated token string
    """
    try:
        token = RtcTokenBuilder.build_token_with_uid(
            app_id,
            app_certificate,
            channel_name,
            uid,
            Role_Publisher,
            expiration_seconds,
            expiration_seconds
        )
        logger.info(f"Generated token for uid {uid} in channel {channel_name}")
        return token
    except Exception as e:
        logger.error(f"Failed to generate token: {str(e)}")
        raise