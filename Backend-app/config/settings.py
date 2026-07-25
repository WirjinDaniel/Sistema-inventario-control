from pathlib import Path
from datetime import timedelta
from decouple import config
from django.http import HttpRequest


def environment_callback(request: HttpRequest):
    if config('DEBUG', default=False, cast=bool):
        return ["Desarrollo", "warning"]
    return ["Producción", "danger"]

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='*').split(',')

DJANGO_APPS = [
    'unfold',
    'unfold.contrib.filters',
    'unfold.contrib.forms',
    'unfold.contrib.inlines',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'channels',
    'django_celery_beat',
]

LOCAL_APPS = [
    'apps.usuarios',
    'apps.inventario',
    'apps.ventas',
    'apps.clientes',
    'apps.compras',
    'apps.gastos',
    'apps.reportes',
    'apps.dashboard',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

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
        'DIRS': [BASE_DIR / 'templates'],
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
ASGI_APPLICATION = 'config.asgi.application'

# ── Base de datos ─────────────────────────────────────────────────────────────
# Usa SQLite localmente; cambia USE_SQLITE=False en .env para usar SQL Server
USE_SQLITE = config('USE_SQLITE', default=True, cast=bool)

if USE_SQLITE:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'mssql',
            'NAME': config('DB_NAME', default='colmado_db'),
            'USER': config('DB_USER', default='sa'),
            'PASSWORD': config('DB_PASSWORD', default=''),
            'HOST': config('DB_HOST', default='localhost'),
            'PORT': config('DB_PORT', default='1433'),
            'OPTIONS': {
                'driver': 'ODBC Driver 17 for SQL Server',
            },
        }
    }

# ── Usuario personalizado ─────────────────────────────────────────────────────
AUTH_USER_MODEL = 'usuarios.Usuario'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'es-do'
TIME_ZONE = 'America/Santo_Domingo'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── Django REST Framework ─────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'MAX_PAGE_SIZE': 200,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '20/minute',
        'user': '200/minute',
    },
}

# ── JWT ───────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=config('ACCESS_TOKEN_LIFETIME_MINUTES', default=60, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=config('REFRESH_TOKEN_LIFETIME_DAYS', default=7, cast=int)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3003',
]
CORS_ALLOW_CREDENTIALS = True

# ── Redis / Channels / Celery ─────────────────────────────────────────────────
REDIS_URL = config('REDIS_URL', default='redis://localhost:6379/0')

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {'hosts': [REDIS_URL]},
    }
}

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# ── Django Unfold Admin ───────────────────────────────────────────────────────
UNFOLD = {
    "SITE_TITLE": "Colmado POS",
    "SITE_HEADER": "Panel de Administración",
    "SITE_SUBHEADER": "Sistema de Inventario y Punto de Venta",
    "SITE_URL": "/",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": True,
    "ENVIRONMENT": "config.settings.environment_callback",
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": False,
        "navigation": [
            {
                "title": "Usuarios",
                "separator": True,
                "items": [
                    {"title": "Usuarios", "icon": "person", "link": "/admin/usuarios/usuario/"},
                ],
            },
            {
                "title": "Inventario",
                "separator": True,
                "items": [
                    {"title": "Productos", "icon": "inventory_2", "link": "/admin/inventario/producto/"},
                    {"title": "Categorías", "icon": "category", "link": "/admin/inventario/categoria/"},
                    {"title": "Movimientos", "icon": "swap_horiz", "link": "/admin/inventario/movimientoinventario/"},
                ],
            },
            {
                "title": "Ventas",
                "separator": True,
                "items": [
                    {"title": "Ventas", "icon": "point_of_sale", "link": "/admin/ventas/venta/"},
                    {"title": "Clientes", "icon": "group", "link": "/admin/clientes/cliente/"},
                ],
            },
            {
                "title": "Compras",
                "separator": True,
                "items": [
                    {"title": "Compras", "icon": "shopping_cart", "link": "/admin/compras/ordencompra/"},
                    {"title": "Suplidores", "icon": "local_shipping", "link": "/admin/compras/suplidor/"},
                ],
            },
            {
                "title": "Finanzas",
                "separator": True,
                "items": [
                    {"title": "Gastos", "icon": "payments", "link": "/admin/gastos/gasto/"},
                    {"title": "Caja", "icon": "account_balance_wallet", "link": "/admin/ventas/sesioncaja/"},
                ],
            },
        ],
    },
}
