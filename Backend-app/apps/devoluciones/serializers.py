from rest_framework import serializers
from django.db import transaction
from django.db.models import Sum
from .models import Devolucion, DevolucionItem
from apps.inventario.models import MovimientoInventario


class DevolucionItemSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='venta_item.producto.nombre', read_only=True)

    class Meta:
        model = DevolucionItem
        fields = ['id', 'venta_item', 'producto_nombre', 'cantidad', 'precio_unitario']


class DevolucionCreateItemSerializer(serializers.Serializer):
    venta_item = serializers.IntegerField()
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=3)
    precio_unitario = serializers.DecimalField(max_digits=12, decimal_places=2)


class DevolucionSerializer(serializers.ModelSerializer):
    items = DevolucionItemSerializer(many=True, read_only=True)
    cajero_nombre = serializers.CharField(source='cajero.nombre', read_only=True)
    cliente_nombre = serializers.CharField(source='cliente.nombre', read_only=True)
    venta_ref = serializers.SerializerMethodField()

    class Meta:
        model = Devolucion
        fields = [
            'id', 'colmado', 'venta', 'venta_ref', 'cliente', 'cliente_nombre',
            'cajero', 'cajero_nombre', 'motivo', 'nota', 'metodo_devolucion',
            'monto_devuelto', 'estado', 'fecha', 'items',
        ]
        read_only_fields = ['colmado', 'cajero', 'fecha']

    def get_venta_ref(self, obj):
        return f'#{obj.venta_id}'


class DevolucionCreateSerializer(serializers.Serializer):
    venta = serializers.IntegerField()
    motivo = serializers.CharField(max_length=200)
    nota = serializers.CharField(required=False, allow_blank=True, default='')
    metodo_devolucion = serializers.ChoiceField(choices=Devolucion.METODOS, default='EFECTIVO')
    items = DevolucionCreateItemSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('Debe incluir al menos un ítem a devolver.')
        return items

    @transaction.atomic
    def create(self, validated_data):
        from apps.ventas.models import Venta, VentaDetalle
        request = self.context['request']

        venta = Venta.objects.get(pk=validated_data['venta'], colmado=request.user.colmado)
        if venta.estado == Venta.ESTADO_ANULADA:
            raise serializers.ValidationError('No se puede devolver una venta anulada.')

        items_data = validated_data.pop('items')
        # El monto se calcula después de validar contra precios originales (ver loop abajo)

        dev = Devolucion.objects.create(
            colmado=request.user.colmado,
            venta=venta,
            cliente=venta.cliente,
            cajero=request.user,
            monto_devuelto=0,  # se recalcula al final con precios originales
            **{k: v for k, v in validated_data.items() if k != 'venta'},
        )

        monto_total = 0
        for item_data in items_data:
            venta_item = VentaDetalle.objects.get(pk=item_data['venta_item'], venta=venta)

            # Validar que no se devuelva más de lo vendido (acumulando devoluciones previas)
            ya_devuelto = DevolucionItem.objects.filter(
                venta_item=venta_item,
                devolucion__estado__in=(Devolucion.ESTADO_PENDIENTE, Devolucion.ESTADO_PROCESADA),
            ).aggregate(total=Sum('cantidad'))['total'] or 0
            disponible = venta_item.cantidad - ya_devuelto
            if item_data['cantidad'] > disponible:
                raise serializers.ValidationError(
                    f'Solo puedes devolver {disponible} unidad(es) de "{venta_item.producto.nombre}" '
                    f'(ya devueltas: {ya_devuelto}).'
                )

            # Forzar precio original de la venta para evitar descuadres contables
            DevolucionItem.objects.create(
                devolucion=dev,
                venta_item=venta_item,
                cantidad=item_data['cantidad'],
                precio_unitario=venta_item.precio_unitario,
            )

            monto_total += item_data['cantidad'] * venta_item.precio_unitario

            # Reintegrar stock
            prod = venta_item.producto
            prod.stock_actual += item_data['cantidad']
            prod.save(update_fields=['stock_actual'])
            MovimientoInventario.objects.create(
                colmado=request.user.colmado,
                producto=prod,
                tipo=MovimientoInventario.TIPO_ENTRADA,
                cantidad=item_data['cantidad'],
                usuario=request.user,
                nota=f'Devolución #{dev.pk} — {validated_data["motivo"]}',
            )

        dev.monto_devuelto = monto_total
        dev.save(update_fields=['monto_devuelto'])

        # Si fue fiado y la devolución es en efectivo, reducir deuda
        if venta.metodo_pago == 'FIADO' and venta.cliente and dev.metodo_devolucion == Devolucion.METODO_EFECTIVO:
            venta.cliente.saldo_deuda = max(venta.cliente.saldo_deuda - monto_total, 0)
            venta.cliente.save(update_fields=['saldo_deuda'])

        return dev
