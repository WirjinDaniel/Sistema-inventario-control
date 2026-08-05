from rest_framework.routers import DefaultRouter
from .views import HistorialPrecioViewSet

router = DefaultRouter()
router.register('', HistorialPrecioViewSet, basename='historial-precio')

urlpatterns = router.urls
