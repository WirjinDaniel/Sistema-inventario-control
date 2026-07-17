from rest_framework.routers import DefaultRouter
from .views import (
    CategoriaViewSet, MarcaViewSet, ProductoViewSet,
    PresentacionProductoViewSet, MovimientoInventarioViewSet, ReglaDescuentoViewSet,
)

router = DefaultRouter()
router.register('categorias', CategoriaViewSet, basename='categoria')
router.register('marcas', MarcaViewSet, basename='marca')
router.register('productos', ProductoViewSet, basename='producto')
router.register('presentaciones', PresentacionProductoViewSet, basename='presentacion')
router.register('movimientos', MovimientoInventarioViewSet, basename='movimiento')
router.register('reglas-descuento', ReglaDescuentoViewSet, basename='regla-descuento')

urlpatterns = router.urls
