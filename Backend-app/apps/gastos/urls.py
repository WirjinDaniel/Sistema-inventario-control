from rest_framework.routers import DefaultRouter
from .views import CategoriaGastoViewSet, GastoViewSet

router = DefaultRouter()
router.register('categorias', CategoriaGastoViewSet, basename='categoria-gasto')
router.register('', GastoViewSet, basename='gasto')

urlpatterns = router.urls
