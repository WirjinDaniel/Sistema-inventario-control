from rest_framework import serializers
from .models import Devolucion, DevolucionItem


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

    def create(self, validated_data):
        from apps.ventas.models import Venta
        from .services import crear_devolucion
        request = self.context['request']

        try:
            venta = Venta.objects.get(pk=validated_data['venta'], colmado=request.user.colmado)
        except Venta.DoesNotExist:
            raise serializers.ValidationError('Venta no encontrada.')

        items_data = validated_data.pop('items')
        validated_data.pop('venta')

        try:
            return crear_devolucion(
                colmado=request.user.colmado,
                cajero=request.user,
                venta=venta,
                items_data=items_data,
                **validated_data,
            )
        except ValueError as e:
            raise serializers.ValidationError(str(e))
