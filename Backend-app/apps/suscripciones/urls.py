from rest_framework.routers import DefaultRouter
from .views import PlanViewSet, SuscripcionViewSet, PagoSuscripcionViewSet

router = DefaultRouter()
router.register('planes', PlanViewSet, basename='plan')
router.register('pagos', PagoSuscripcionViewSet, basename='pago-suscripcion')
router.register('', SuscripcionViewSet, basename='suscripcion')

urlpatterns = router.urls
