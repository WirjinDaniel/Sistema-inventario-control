from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from .models import Suplidor, OrdenCompra, OrdenCompraItem, PagoSuplidor
from .serializers import SuplidorSerializer, OrdenCompraSerializer, OrdenCompraItemSerializer, PagoSuplidorSerializer
from apps.inventario.models import Producto, MovimientoInventario


class SuplidorViewSet(viewsets.ModelViewSet):
    serializer_class = SuplidorSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['nombre', 'rnc', 'telefono', 'contacto']

    def get_queryset(self):
        return Suplidor.objects.filter(colmado=self.request.user.colmado)

    def perform_create(self, serializer):
        serializer.save(colmado=self.request.user.colmado)


class OrdenCompraViewSet(viewsets.ModelViewSet):
    serializer_class = OrdenCompraSerializer

    def get_queryset(self):
        qs = OrdenCompra.objects.filter(suplidor__colmado=self.request.user.colmado).select_related('suplidor', 'usuario')
        suplidor_id = self.request.query_params.get('suplidor')
        if suplidor_id:
            qs = qs.filter(suplidor_id=suplidor_id)
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        items_data = request.data.get('items', [])
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        orden = serializer.save(usuario=request.user)

        total = 0
        for item in items_data:
            prod = Producto.objects.get(pk=item['producto'])
            cantidad = item['cantidad']
            precio = item['precio_costo']
            subtotal = float(cantidad) * float(precio)
            total += subtotal
            OrdenCompraItem.objects.create(
                orden=orden,
                producto=prod,
                cantidad=cantidad,
                precio_costo=precio,
                subtotal=subtotal,
            )

        orden.total = total
        orden.save(update_fields=['total'])

        return Response(OrdenCompraSerializer(orden).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='recibir')
    @transaction.atomic
    def recibir(self, request, pk=None):
        orden = self.get_object()
        if orden.estado != OrdenCompra.ESTADO_PENDIENTE:
            return Response({'detail': 'Solo se pueden recibir órdenes pendientes.'}, status=status.HTTP_400_BAD_REQUEST)

        orden.estado = OrdenCompra.ESTADO_RECIBIDA
        orden.fecha_recepcion = timezone.now()
        orden.save()

        # Actualizar stock por cada item
        for item in orden.items.all():
            prod = Producto.objects.select_for_update().get(pk=item.producto_id)
            prod.stock_actual += item.cantidad
            prod.precio_costo = item.precio_costo
            prod.save(update_fields=['stock_actual', 'precio_costo'])
            MovimientoInventario.objects.create(
                colmado=request.user.colmado,
                producto=prod,
                tipo=MovimientoInventario.TIPO_ENTRADA,
                cantidad=item.cantidad,
                costo_unitario=item.precio_costo,
                usuario=request.user,
                nota=f'Compra #{orden.pk} — {orden.suplidor.nombre}',
            )

        return Response(OrdenCompraSerializer(orden).data)


class OrdenCompraItemViewSet(viewsets.ModelViewSet):
    serializer_class = OrdenCompraItemSerializer

    def get_queryset(self):
        qs = OrdenCompraItem.objects.filter(orden__suplidor__colmado=self.request.user.colmado)
        orden_id = self.request.query_params.get('orden')
        if orden_id:
            qs = qs.filter(orden_id=orden_id)
        return qs


class PagoSuplidorViewSet(viewsets.ModelViewSet):
    serializer_class = PagoSuplidorSerializer
    http_method_names = ['get', 'post']

    def get_queryset(self):
        qs = PagoSuplidor.objects.filter(orden__suplidor__colmado=self.request.user.colmado)
        orden_id = self.request.query_params.get('orden')
        if orden_id:
            qs = qs.filter(orden_id=orden_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)
