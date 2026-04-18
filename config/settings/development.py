"""
Settings de développement — machine locale.
"""
from .base import *

# ─── Debug ────────────────────────────────────────────────────────────────────

DEBUG = True
SECRET_KEY = 'django-insecure-dev-key-change-in-production-ritoto-Campus-2026'
ALLOWED_HOSTS = ['*']

# ─── Base de données SQLite locale ───────────────────────────────────────────

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db' / 'ritoto-Campus.sqlite3',
    }
}

# ─── Cache — mémoire locale (pas de Redis requis en dev) ─────────────────────

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# ─── WebSockets — Channel Layer en mémoire ────────────────────────────────────
# Pas besoin de Redis pour les WebSockets en développement

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}

# ─── CORS — tout autoriser en développement ───────────────────────────────────

CORS_ALLOW_ALL_ORIGINS = True
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8000',
    'http://localhost:8001',
]

# ─── Email — SMTP réel même en dev ───────────────────────────────────────────

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# ─── Logs ─────────────────────────────────────────────────────────────────────

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'WARNING',
        },
    },
}
