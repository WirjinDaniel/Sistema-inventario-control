from rest_framework.routers import DefaultRouter
from .views import ClienteViewSet, AbonoFiadoViewSet

router = DefaultRouter()
router.register('abonos', AbonoFiadoViewSet, basename='abono')
router.register('', ClienteViewSet, basename='cliente')

urlpatterns = router.urls
