from rest_framework.routers import DefaultRouter
from .views import DevolucionViewSet

router = DefaultRouter()
router.register('', DevolucionViewSet, basename='devolucion')

urlpatterns = router.urls
