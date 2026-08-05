from rest_framework import serializers
from django.db import transaction
from .models import DevolucionSuplidor, DevolucionSuplidorItem
from apps.inventario.models import MovimientoInventario


class DevolucionSuplidorItemSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)

    class Meta:
        model = DevolucionSuplidorItem
        fields = ['id', 'producto', 'producto_nombre', 'cantidad', 'precio_unitario', 'motivo_item']


class DevolucionSuplidorSerializer(serializers.ModelSerializer):
    items = DevolucionSuplidorItemSerializer(many=True, read_only=True)
    suplidor_nombre = serializers.CharField(source='suplidor.nombre', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)

    class Meta:
        model = DevolucionSuplidor
        fields = '__all__'


class ItemCreateSerializer(serializers.Serializer):
    producto = serializers.IntegerField()
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=3)
    precio_unitario = serializers.DecimalField(max_digits=12, decimal_places=2)
    motivo_item = serializers.CharField(required=False, allow_blank=True, default='')


class DevolucionSuplidorCreateSerializer(serializers.Serializer):
    suplidor = serializers.IntegerField()
    orden_compra = serializers.IntegerField(required=False, allow_null=True)
    motivo = serializers.CharField(max_length=200)
    nota = serializers.CharField(required=False, allow_blank=True, default='')
    items = ItemCreateSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('Debe incluir al menos un ítem.')
        return items

    @transaction.atomic
    def create(self, validated_data):
        from apps.compras.models import Suplidor, OrdenCompra
        from apps.inventario.models import Producto
        request = self.context['request']

        suplidor = Suplidor.objects.get(pk=validated_data['suplidor'], colmado=request.user.colmado)
        orden = None
        if validated_data.get('orden_compra'):
            orden = OrdenCompra.objects.get(pk=validated_data['orden_compra'], suplidor__colmado=request.user.colmado)

        items_data = validated_data.pop('items')
        monto_total = sum(i['cantidad'] * i['precio_unitario'] for i in items_data)

        dev = DevolucionSuplidor.objects.create(
            colmado=request.user.colmado,
            suplidor=suplidor,
            orden_compra=orden,
            usuario=request.user,
            monto_credito=monto_total,
            **{k: v for k, v in validated_data.items() if k not in ('suplidor', 'orden_compra')},
        )

        for item_data in items_data:
            producto = Producto.objects.get(pk=item_data['producto'], colmado=request.user.colmado)
            DevolucionSuplidorItem.objects.create(devolucion=dev, producto=producto, **{k: v for k, v in item_data.items() if k != 'producto'})

            # Reducir stock al devolver al suplidor
            producto.stock_actual -= item_data['cantidad']
            producto.stock_actual = max(producto.stock_actual, 0)
            producto.save(update_fields=['stock_actual'])

            MovimientoInventario.objects.create(
                colmado=request.user.colmado,
                producto=producto,
                tipo=MovimientoInventario.TIPO_SALIDA,
                cantidad=item_data['cantidad'],
                usuario=request.user,
                nota=f'Devolución a suplidor #{dev.pk} — {validated_data["motivo"]}',
            )

        return dev
