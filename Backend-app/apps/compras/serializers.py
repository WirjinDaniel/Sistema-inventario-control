import re
from decimal import Decimal
from rest_framework import serializers
from django.db.models import Sum
from .models import Suplidor, OrdenCompra, OrdenCompraItem, PagoSuplidor


class SuplidorSerializer(serializers.ModelSerializer):
    total_comprado = serializers.SerializerMethodField()
    total_pagado = serializers.SerializerMethodField()
    balance_pendiente = serializers.SerializerMethodField()
    ultima_compra = serializers.SerializerMethodField()
    email = serializers.EmailField(allow_blank=True, required=False)

    class Meta:
        model = Suplidor
        fields = [
            'id', 'colmado', 'nombre', 'contacto', 'telefono', 'email',
            'rnc', 'direccion', 'tipo_pago', 'dias_credito', 'limite_credito',
            'descuento_habitual', 'frecuencia_entrega', 'notas', 'activo', 'creado_en',
            'total_comprado', 'total_pagado', 'balance_pendiente', 'ultima_compra',
        ]
        read_only_fields = ['colmado', 'creado_en']

    def validate_rnc(self, value):
        if not value:
            return value
        digits = re.sub(r'[\-\s]', '', value)
        if not re.match(r'^\d{9}$', digits):
            raise serializers.ValidationError('El RNC del proveedor debe tener 9 dígitos.')
        return value

    def get_total_comprado(self, obj):
        return float(obj.ordenes.filter(estado=OrdenCompra.ESTADO_RECIBIDA).aggregate(t=Sum('total'))['t'] or 0)

    def get_total_pagado(self, obj):
        total = 0
        for orden in obj.ordenes.filter(estado=OrdenCompra.ESTADO_RECIBIDA):
            total += float(orden.pagos.aggregate(t=Sum('monto'))['t'] or 0)
        return total

    def get_balance_pendiente(self, obj):
        return self.get_total_comprado(obj) - self.get_total_pagado(obj)

    def get_ultima_compra(self, obj):
        ultima = obj.ordenes.order_by('-fecha').first()
        return ultima.fecha.isoformat() if ultima else None


class OrdenCompraItemSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)

    class Meta:
        model = OrdenCompraItem
        fields = ['id', 'orden', 'producto', 'producto_nombre', 'cantidad', 'precio_costo', 'subtotal']


class PagoSuplidorSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)

    class Meta:
        model = PagoSuplidor
        fields = ['id', 'orden', 'usuario', 'usuario_nombre', 'monto', 'fecha', 'metodo', 'referencia', 'nota']
        read_only_fields = ['usuario', 'fecha']

    def validate_monto(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError('El monto del pago debe ser mayor a 0.')
        return value


class OrdenCompraSerializer(serializers.ModelSerializer):
    suplidor_nombre = serializers.CharField(source='suplidor.nombre', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)
    items = OrdenCompraItemSerializer(many=True, read_only=True)
    pagos = PagoSuplidorSerializer(many=True, read_only=True)
    total_pagado = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    balance_pendiente = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = OrdenCompra
        fields = [
            'id', 'suplidor', 'suplidor_nombre', 'usuario', 'usuario_nombre',
            'numero_factura', 'fecha', 'fecha_recepcion', 'total', 'estado', 'notas',
            'items', 'pagos', 'total_pagado', 'balance_pendiente',
        ]
        read_only_fields = ['usuario', 'fecha', 'total', 'estado']
