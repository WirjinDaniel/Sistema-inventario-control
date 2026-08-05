from rest_framework.routers import DefaultRouter
from .views import DevolucionSuplidorViewSet

router = DefaultRouter()
router.register('', DevolucionSuplidorViewSet, basename='devolucion-suplidor')

urlpatterns = router.urls
