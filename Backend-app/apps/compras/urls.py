from rest_framework.routers import DefaultRouter
from .views import SuplidorViewSet, OrdenCompraViewSet, OrdenCompraItemViewSet, PagoSuplidorViewSet

router = DefaultRouter()
router.register('suplidores', SuplidorViewSet, basename='suplidor')
router.register('ordenes', OrdenCompraViewSet, basename='orden-compra')
router.register('items', OrdenCompraItemViewSet, basename='orden-item')
router.register('pagos', PagoSuplidorViewSet, basename='pago-suplidor')

urlpatterns = router.urls
