from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Categoria, Marca, Producto, PresentacionProducto, MovimientoInventario, ReglaDescuento
from .serializers import (
    CategoriaSerializer, MarcaSerializer, ProductoSerializer,
    PresentacionProductoSerializer, MovimientoInventarioSerializer, ReglaDescuentoSerializer,
)
from apps.dashboard.permissions import IsAdminOfColmado, IsInventarioOrAdmin, IsSuperadmin


class CategoriaViewSet(viewsets.ModelViewSet):
    """Categorías de producto — INVENTARIO y ADMIN gestionan; solo SUPERADMIN elimina."""
    serializer_class = CategoriaSerializer

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsSuperadmin()]
        return [IsInventarioOrAdmin()]

    def get_queryset(self):
        return Categoria.objects.filter(colmado=self.request.user.colmado, activo=True)

    def perform_create(self, serializer):
        serializer.save(colmado=self.request.user.colmado)


class MarcaViewSet(viewsets.ModelViewSet):
    """Marcas — INVENTARIO y ADMIN pueden gestionarlas."""
    serializer_class = MarcaSerializer
    permission_classes = [IsInventarioOrAdmin]
    filter_backends = [filters.SearchFilter]
    search_fields = ['nombre', 'pais_origen']

    def get_queryset(self):
        return Marca.objects.filter(colmado=self.request.user.colmado)

    def perform_create(self, serializer):
        serializer.save(colmado=self.request.user.colmado)


class PresentacionProductoViewSet(viewsets.ModelViewSet):
    """Presentaciones de producto — INVENTARIO y ADMIN."""
    serializer_class = PresentacionProductoSerializer
    permission_classes = [IsInventarioOrAdmin]

    def get_queryset(self):
        qs = PresentacionProducto.objects.filter(producto__colmado=self.request.user.colmado)
        producto_id = self.request.query_params.get('producto')
        if producto_id:
            qs = qs.filter(producto_id=producto_id)
        return qs


class ProductoViewSet(viewsets.ModelViewSet):
    """
    Productos:
    - Consultar / buscar: INVENTARIO y ADMIN (también CAJERO necesita leer para el POS).
    - Crear / editar / eliminar: solo INVENTARIO y ADMIN.
    """
    serializer_class = ProductoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'codigo_barras', 'sku']
    ordering_fields = ['nombre', 'stock_actual', 'precio_venta']

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'buscar_por_barras'):
            from rest_framework.permissions import IsAuthenticated
            return [IsAuthenticated()]
        if self.action == 'destroy':
            return [IsSuperadmin()]
        return [IsInventarioOrAdmin()]

    def get_queryset(self):
        if self.action in ('retrieve', 'update', 'partial_update', 'destroy'):
            qs = Producto.objects.filter(colmado=self.request.user.colmado)
        else:
            qs = Producto.objects.filter(colmado=self.request.user.colmado, activo=True)
        categoria_id = self.request.query_params.get('categoria')
        if categoria_id:
            qs = qs.filter(categoria_id=categoria_id)
        stock_bajo = self.request.query_params.get('stock_bajo')
        if stock_bajo == 'true':
            from django.db.models import F
            qs = qs.filter(stock_actual__lte=F('stock_minimo'))
        return qs

    def perform_create(self, serializer):
        from apps.suscripciones.utils import verificar_limite_plan
        if not self.request.user.is_superuser:
            colmado = self.request.user.colmado
            if colmado:
                verificar_limite_plan(colmado, 'max_productos', Producto)
        serializer.save(colmado=self.request.user.colmado)

    @action(detail=False, methods=['get'], url_path='buscar-barras')
    def buscar_por_barras(self, request):
        codigo = request.query_params.get('codigo', '')
        try:
            producto = Producto.objects.get(
                colmado=request.user.colmado, codigo_barras=codigo, activo=True,
            )
            return Response(ProductoSerializer(producto).data)
        except Producto.DoesNotExist:
            from .models import PresentacionProducto as PP
            try:
                pres = PP.objects.select_related('producto').get(
                    producto__colmado=request.user.colmado,
                    codigo_barras=codigo,
                    activo=True,
                )
                data = ProductoSerializer(pres.producto).data
                data['presentacion_id'] = pres.id
                data['presentacion_nombre'] = pres.nombre
                data['precio_venta'] = str(pres.precio_venta)
                data['factor_conversion'] = str(pres.factor_conversion)
                return Response(data)
            except PP.DoesNotExist:
                return Response({'detail': 'Producto no encontrado.'}, status=status.HTTP_404_NOT_FOUND)


class ReglaDescuentoViewSet(viewsets.ModelViewSet):
    """Reglas de descuento — solo ADMIN."""
    serializer_class = ReglaDescuentoSerializer
    permission_classes = [IsAdminOfColmado]
    filter_backends = [filters.SearchFilter]
    search_fields = ['nombre', 'producto__nombre', 'categoria__nombre']

    def get_queryset(self):
        qs = ReglaDescuento.objects.filter(colmado=self.request.user.colmado).select_related('producto', 'categoria')
        producto_id = self.request.query_params.get('producto')
        if producto_id:
            qs = qs.filter(producto_id=producto_id)
        categoria_id = self.request.query_params.get('categoria')
        if categoria_id:
            qs = qs.filter(categoria_id=categoria_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(colmado=self.request.user.colmado)


class MovimientoInventarioViewSet(viewsets.ModelViewSet):
    """
    Movimientos de inventario — INVENTARIO y ADMIN pueden consultar y registrar.
    Solo GET y POST (los movimientos no se editan ni eliminan).
    """
    serializer_class = MovimientoInventarioSerializer
    permission_classes = [IsInventarioOrAdmin]
    http_method_names = ['get', 'post']

    def get_queryset(self):
        qs = MovimientoInventario.objects.filter(colmado=self.request.user.colmado).select_related('producto', 'usuario')
        producto_id = self.request.query_params.get('producto')
        if producto_id:
            qs = qs.filter(producto_id=producto_id)
        return qs

    def perform_create(self, serializer):
        from django.db import transaction
        with transaction.atomic():
            mov = serializer.save(colmado=self.request.user.colmado, usuario=self.request.user)
            producto = Producto.objects.select_for_update().get(pk=mov.producto_id)
            if mov.tipo == MovimientoInventario.TIPO_ENTRADA:
                producto.stock_actual += mov.cantidad
            elif mov.tipo in (MovimientoInventario.TIPO_SALIDA, MovimientoInventario.TIPO_MERMA):
                producto.stock_actual -= mov.cantidad
            else:
                producto.stock_actual = mov.cantidad
            producto.save(update_fields=['stock_actual'])
