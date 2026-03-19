"""
Django settings for ritoto-express project.
"""

from pathlib import Path
import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-default-key-change-me')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DJANGO_DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Application definition
INSTALLED_APPS = [
    'simpleui',
            # General use templates & template tags (should appear first)
 #    'django_daisy',
    'django.contrib.admin',
  #  'django.contrib.humanize',  # Required
#   django-modal-actions
  'django_modal_actions',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
     'rest_framework.authtoken',
      'drf_yasg',
    # Third party apps
    'rest_framework',
    'corsheaders',
    
    # Local apps
    'apps.authentification',
    'apps.administration',
    'apps.commandes',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
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

WSGI_APPLICATION = 'config.wsgi.application'

# Database - SQLite
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / os.getenv('DB_NAME', 'db/ritoto-express.sqlite3'),
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Custom User Model
AUTH_USER_MODEL = 'authentification.Utilisateur'

# Internationalization
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Porto-Novo'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'static'

# Media files (Uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
    'DATETIME_FORMAT': '%d/%m/%Y %H:%M:%S',
}

# CORS settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
]
CORS_ALLOW_ALL_ORIGINS = DEBUG  # Seulement en développement

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
]

# Senfenico Payment API
SENFENICO_API_KEY = os.getenv('SENFENICO_API_KEY', '')
SENFENICO_WEBHOOK_SECRET = os.getenv('SENFENICO_WEBHOOK_SECRET', '')

# Google Authentication (à configurer plus tard)
# Configuration Google OAuth
GOOGLE_OAUTH2_CLIENT_ID = os.getenv('GOOGLE_OAUTH2_CLIENT_ID', '')
GOOGLE_OAUTH2_CLIENT_SECRET = os.getenv('GOOGLE_OAUTH2_CLIENT_SECRET', '')

# Frontend URL pour les emails
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

# Email configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@ritoto-express.com')

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.authentification.authentication.AuthentificationEmailMotDePasse',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    # ... autres configurations
}

# # Logger
# LOGGING = {
#     'version': 1,
#     'disable_existing_loggers': False,
#     'formatters': {
#         'verbose': {
#             'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
#             'style': '{',
#         },
#     },
#     'handlers': {
#         'file': {
#             'level': 'INFO',
#             'class': 'logging.FileHandler',
#             'filename': 'logs/authentification.log',
#             'formatter': 'verbose',
#         },
#     },
#     'loggers': {
#         'apps.authentification': {
#             'handlers': ['file'],
#             'level': 'INFO',
#             'propagate': True,
#         },
#     },
# }
# Créer les dossiers nécessaires
os.makedirs(MEDIA_ROOT, exist_ok=True)
os.makedirs(STATIC_ROOT, exist_ok=True)
os.makedirs(BASE_DIR / 'db', exist_ok=True)
# DAISY_SETTINGS = {
#     # Branding
#     'SITE_TITLE': 'Django Admin',
#     'SITE_HEADER': 'Administration',
#     'INDEX_TITLE': 'Hi, welcome to your dashboard',
#     'SITE_LOGO': '/static/admin/img/daisyui-logomark.svg',
    
#     # Customization
#     'EXTRA_STYLES': [],  # Additional CSS files
#     'EXTRA_SCRIPTS': [],  # Additional JS files
#     'LOAD_FULL_STYLES': False,  # Load complete DaisyUI library
#     'SHOW_CHANGELIST_FILTER': False,  # Auto-open filter sidebar
#     'DONT_SUPPORT_ME': False,  # Hide GitHub link
#     'SIDEBAR_FOOTNOTE': '',  # Custom sidebar footer text
    
#     # Theme Configuration
#     'DEFAULT_THEME': None,  # e.g., 'corporate', 'dark'
#     'DEFAULT_THEME_DARK': None,  # Dark mode default
#     'SHOW_THEME_SELECTOR': True,  # Show/hide theme dropdown
#     'THEME_LIST': [
#         {'name': 'Light', 'value': 'light'},
#         {'name': 'Dark', 'value': 'dark'},
#         # Add custom themes...
#     ],
    
#     # Third-Party App Customization
#     'APPS_REORDER': {
#         'auth': {
#             'icon': 'fa-solid fa-person-military-pointing',
#             'name': 'Authentication',
#             'hide': False,
#             'divider_title': "Auth",
#         },
#     },
# }