from rest_framework import serializers
from django.db import transaction
from .models import BancoCuenta, SesionCaja, Venta, VentaDetalle
from apps.inventario.models import Producto, MovimientoInventario
from apps.clientes.models import Cliente


class BancoCuentaSerializer(serializers.ModelSerializer):
    class Meta:
        model = BancoCuenta
        fields = ['id', 'colmado', 'banco', 'numero_cuenta', 'titular', 'activo']
        read_only_fields = ['colmado']


class SesionCajaSerializer(serializers.ModelSerializer):
    cajero_nombre = serializers.CharField(source='cajero.nombre', read_only=True)
    esta_abierta = serializers.BooleanField(read_only=True)
    diferencia_caja = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = SesionCaja
        fields = '__all__'
        read_only_fields = ['apertura', 'colmado', 'cajero']


class VentaDetalleSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)

    class Meta:
        model = VentaDetalle
        fields = ['id', 'producto', 'producto_nombre', 'cantidad', 'precio_unitario', 'descuento', 'subtotal']
        read_only_fields = ['subtotal']


class VentaCreateSerializer(serializers.ModelSerializer):
    detalles = VentaDetalleSerializer(many=True)

    class Meta:
        model = Venta
        fields = [
            'sesion_caja', 'cliente', 'banco_cuenta', 'detalles',
            'descuento', 'metodo_pago', 'monto_pagado',
        ]

    def validate(self, data):
        if data['metodo_pago'] == Venta.PAGO_FIADO:
            cliente = data.get('cliente')
            if not cliente:
                raise serializers.ValidationError('Se requiere un cliente para venta a fiado.')
            subtotal = sum(
                d['precio_unitario'] * d['cantidad'] - d.get('descuento', 0)
                for d in data['detalles']
            )
            total = subtotal - data.get('descuento', 0)
            if not cliente.puede_fiar(total):
                raise serializers.ValidationError(
                    f'El cliente {cliente.nombre} no tiene crédito suficiente. '
                    f'Disponible: RD${cliente.credito_disponible:.2f}'
                )
        return data

    @transaction.atomic
    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles')
        request = self.context['request']

        subtotal = sum(
            d['precio_unitario'] * d['cantidad'] - d.get('descuento', 0)
            for d in detalles_data
        )
        total = subtotal - validated_data.get('descuento', 0)
        cambio = max(validated_data.get('monto_pagado', 0) - total, 0)

        venta = Venta.objects.create(
            colmado=request.user.colmado,
            cajero=request.user,
            subtotal=subtotal,
            total=total,
            cambio=cambio,
            **validated_data,
        )

        for detalle_data in detalles_data:
            producto = detalle_data['producto']
            cantidad = detalle_data['cantidad']

            prod = Producto.objects.select_for_update().get(pk=producto.pk, colmado=request.user.colmado)
            if prod.stock_actual < cantidad:
                raise serializers.ValidationError(
                    f'Stock insuficiente para {prod.nombre}. Disponible: {prod.stock_actual}'
                )
            prod.stock_actual -= cantidad
            prod.save(update_fields=['stock_actual'])

            subtotal_item = detalle_data['precio_unitario'] * cantidad - detalle_data.get('descuento', 0)
            VentaDetalle.objects.create(venta=venta, subtotal=subtotal_item, **detalle_data)

            MovimientoInventario.objects.create(
                colmado=request.user.colmado,
                producto=prod,
                tipo=MovimientoInventario.TIPO_SALIDA,
                cantidad=cantidad,
                costo_unitario=prod.precio_costo,
                usuario=request.user,
                nota=f'Venta #{venta.pk}',
            )

        if venta.metodo_pago == Venta.PAGO_FIADO and venta.cliente:
            cliente = Cliente.objects.select_for_update().get(pk=venta.cliente_id)
            if not cliente.puede_fiar(total):
                raise serializers.ValidationError(
                    f'El cliente {cliente.nombre} no tiene crédito suficiente. '
                    f'Disponible: RD${cliente.credito_disponible:.2f}'
                )
            cliente.saldo_deuda += total
            cliente.save(update_fields=['saldo_deuda'])
            venta.cliente = cliente

        return venta


class VentaSerializer(serializers.ModelSerializer):
    detalles = VentaDetalleSerializer(many=True, read_only=True)
    cajero_nombre = serializers.CharField(source='cajero.nombre', read_only=True)
    cliente_nombre = serializers.CharField(source='cliente.nombre', read_only=True)
    banco_nombre = serializers.CharField(source='banco_cuenta.banco', read_only=True)
    factura_ncf = serializers.SerializerMethodField()

    class Meta:
        model = Venta
        fields = [
            'id', 'colmado', 'cajero', 'cajero_nombre', 'sesion_caja', 'cliente', 'cliente_nombre',
            'banco_cuenta', 'banco_nombre', 'fecha', 'subtotal', 'descuento', 'total',
            'metodo_pago', 'monto_pagado', 'cambio', 'estado', 'motivo_anulacion', 'detalles',
            'factura_ncf',
        ]
        read_only_fields = ['colmado', 'cajero', 'fecha']

    def get_factura_ncf(self, obj):
        try:
            return obj.factura.ncf if obj.factura else None
        except Exception:
            return None
