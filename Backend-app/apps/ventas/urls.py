from rest_framework.routers import DefaultRouter
from .views import BancoCuentaViewSet, SesionCajaViewSet, VentaViewSet

router = DefaultRouter()
router.register('bancos', BancoCuentaViewSet, basename='banco')
router.register('sesiones', SesionCajaViewSet, basename='sesion')
router.register('', VentaViewSet, basename='venta')

urlpatterns = router.urls
