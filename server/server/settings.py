"""
Django settings for server project.
"""
import os
from pathlib import Path
from datetime import timedelta
# Import matplotlib config early to prevent thread issues
import apps.utils.matplot_helper
# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure-nm(h5$+8_gol4^ho$vy@44u=c-r&8zn$vb@$x!nun#)-5w&%0_'

# Add a default JWT secret if not already present
JWT_SECRET = os.environ.get('JWT_SECRET', SECRET_KEY)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
REACT_APP_DIR = os.path.join(BASE_DIR, '../client/build')

STATICFILES_DIRS = [
    os.path.join(REACT_APP_DIR, 'static'),
]

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            os.path.join(BASE_DIR, 'templates'),
            os.path.join(REACT_APP_DIR),  # Make sure this is included
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}

ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '.ngrok.io',
    '.ngrok-free.app',
    '.lhr.life',
    '.serveo.net',
    '0ff3282ea8bc42.lhr.life',
    # '2bb480e9786dd541d32a878ce6317d77.serveo.net'
    'ca9474d69b72c66e22419218008721a5.serveo.net',
    '743112dfcb898bd2c5fa8dd9acce01e5.serveo.net'
]

# Add your tunnel domain to CSRF_TRUSTED_ORIGINS
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:3000',
    'https://9a14ed3c3e0e38.lhr.life',
    'http://9a14ed3c3e0e38.lhr.life',
    # Add any other domains you're using
]

# Application definition
# In your INSTALLED_APPS setting:
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',  # Django's built-in sessions app
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party apps
    "rest_framework",
    'corsheaders',
    'channels',
    # 'agora',
    # Your apps - use direct app names instead of config classes
    'apps.users',
    'apps.therapists',
    'apps.therapy_sessions',  # Use the new directory name
    'apps.chat_messages',  # Use the new directory name
    'apps.emotions',
    'apps.feedbacks',
    'apps.media',
    'apps.utils',
    'apps.payments',
    'apps.ai_services',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'apps.utils.middleware.HttpJWTAuthMiddleware',  # UPDATED to use renamed class
]

ROOT_URLCONF = 'server.urls'

# TEMPLATES = [
#     {
#         'BACKEND': 'django.template.backends.django.DjangoTemplates',
#         'DIRS': [
#             os.path.join(BASE_DIR, 'templates'),],
#         'APP_DIRS': True,
#         'OPTIONS': {
#             'context_processors': [
#                 'django.template.context_processors.debug',
#                 'django.template.context_processors.request',
#                 'django.contrib.auth.context_processors.auth',
#                 'django.contrib.messages.context_processors.messages',
#             ],
#         },
#     },
# ]

WSGI_APPLICATION = 'server.wsgi.application'
ASGI_APPLICATION = 'server.asgi.application'

# Channel layers config
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Database - using MongoDB instead of default
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.dummy'
    }
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': JWT_SECRET,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# Update this line in settings.py
MONGO_URI = os.environ.get(
    'MONGO_URI', 'mongodb+srv://nguyensngoc12:65smbABwDralpSmf@individualserver.byohaww.mongodb.net/')
MONGO_DB = os.environ.get('MONGO_DB', 'therapy_app_db')

# Add this near your other settings
STRIPE_WEBHOOK_SECRET = os.environ.get(
    'STRIPE_WEBHOOK_SECRET', 'whsec_a6e28fe75815917f32b27d37eff19a9c34ce2350ce747114c86d390863ed9fa0')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
        },
        'channels': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
        'pymongo': {  # Add MongoDB logging
            'handlers': ['console'],
            'level': 'INFO',
        },
        'apps': {  # Add app-level logging
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}

# CORS_ALLOW_ALL_ORIGINS = True  # For development only

# Update CORS settings
CORS_ALLOW_ALL_ORIGINS = True  # For testing only!
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

CORS_ALLOWED_ORIGINS = [
    # Add existing domains
    "http://localhost:3000",
    "https://rnmhv-113-23-110-140.a.free.pinggy.link",  # Add this
    "https://*.a.free.pinggy.link"  # Add this wildcard
]
