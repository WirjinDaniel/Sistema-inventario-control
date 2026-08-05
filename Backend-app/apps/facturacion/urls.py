from rest_framework.routers import DefaultRouter
from .views import SecuenciaNCFViewSet, FacturaViewSet

router = DefaultRouter()
router.register('secuencias', SecuenciaNCFViewSet, basename='secuencia-ncf')
router.register('facturas', FacturaViewSet, basename='factura')

urlpatterns = router.urls
