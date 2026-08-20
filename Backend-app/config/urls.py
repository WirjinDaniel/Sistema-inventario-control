from django.contrib import admin
from django.urls import path, include
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.views import TokenRefreshView
from apps.usuarios.views import CustomTokenView, LogoutView


class RefreshRateThrottle(AnonRateThrottle):
    """Throttle para el endpoint de refresh: 20 intentos/minuto por IP."""
    scope = 'refresh'


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_classes = [RefreshRateThrottle]


urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth
    path('api/auth/login/', CustomTokenView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', ThrottledTokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/logout/', LogoutView.as_view({'post': 'logout'}), name='token_logout'),

    # Apps
    path('api/usuarios/', include('apps.usuarios.urls')),
    path('api/inventario/', include('apps.inventario.urls')),
    path('api/ventas/', include('apps.ventas.urls')),
    path('api/clientes/', include('apps.clientes.urls')),
    path('api/compras/', include('apps.compras.urls')),
    path('api/gastos/', include('apps.gastos.urls')),
    path('api/reportes/', include('apps.reportes.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/devoluciones/', include('apps.devoluciones.urls')),
    path('api/promociones/', include('apps.promociones.urls')),
    path('api/historial-precios/', include('apps.historial_precios.urls')),
    path('api/facturacion/', include('apps.facturacion.urls')),
    path('api/devoluciones-suplidores/', include('apps.devoluciones_suplidores.urls')),
    path('api/suscripciones/', include('apps.suscripciones.urls')),
]
