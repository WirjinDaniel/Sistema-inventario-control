import re
from rest_framework import serializers
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from .models import SecuenciaNCF, Factura, FacturaDetalle, PagoFactura, TIPOS_REQUIEREN_RELACIONADO


def _validar_rnc_cedula(value):
    if not value:
        return value
    digits = re.sub(r'[\-\s]', '', value)
    if not re.match(r'^\d{9}$|^\d{11}$', digits):
        raise serializers.ValidationError('El RNC/Cédula debe tener 9 dígitos (RNC) o 11 dígitos (cédula).')
    return value


class SecuenciaNCFSerializer(serializers.ModelSerializer):
    agotada = serializers.BooleanField(read_only=True)
    vencida = serializers.BooleanField(read_only=True)
    disponibles = serializers.IntegerField(read_only=True)
    proxima_a_agotar = serializers.BooleanField(read_only=True)
    tipo_nombre = serializers.SerializerMethodField()

    class Meta:
        model = SecuenciaNCF
        fields = '__all__'
        read_only_fields = ['colmado', 'secuencia_actual']

    def get_tipo_nombre(self, obj):
        return dict(obj._meta.get_field('tipo').choices).get(obj.tipo, obj.tipo)

    def validate(self, data):
        if data.get('secuencia_desde', 0) >= data.get('secuencia_hasta', 0):
            raise serializers.ValidationError('La secuencia "hasta" debe ser mayor que "desde".')
        if data.get('fecha_vencimiento') and data['fecha_vencimiento'] < timezone.now().date():
            raise serializers.ValidationError('La fecha de vencimiento no puede ser en el pasado.')
        return data

    def create(self, validated_data):
        validated_data['secuencia_actual'] = validated_data['secuencia_desde']
        return super().create(validated_data)


class FacturaDetalleSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)

    class Meta:
        model = FacturaDetalle
        fields = [
            'id', 'producto', 'producto_nombre', 'descripcion', 'codigo',
            'cantidad', 'unidad', 'precio_unitario', 'descuento',
            'tasa_itbis', 'itbis_monto', 'subtotal', 'total',
        ]
        read_only_fields = ['itbis_monto', 'subtotal', 'total']


class PagoFacturaSerializer(serializers.ModelSerializer):
    metodo_nombre = serializers.CharField(source='get_metodo_display', read_only=True)

    class Meta:
        model = PagoFactura
        fields = ['id', 'metodo', 'metodo_nombre', 'monto', 'referencia', 'notas', 'fecha']
        read_only_fields = ['fecha']


class FacturaSerializer(serializers.ModelSerializer):
    detalles = FacturaDetalleSerializer(many=True, read_only=True)
    pagos = PagoFacturaSerializer(many=True, read_only=True)
    tipo_nombre = serializers.SerializerMethodField()
    estado_nombre = serializers.SerializerMethodField()
    forma_pago_nombre = serializers.SerializerMethodField()
    monto_pagado = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    saldo_pendiente = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    ncf_relacionado_ncf = serializers.CharField(source='ncf_relacionado.ncf', read_only=True)
    created_by_nombre = serializers.CharField(source='created_by.nombre', read_only=True)
    cliente_nombre_display = serializers.CharField(source='cliente.nombre', read_only=True)

    class Meta:
        model = Factura
        fields = [
            'id', 'colmado', 'venta', 'cliente', 'cliente_nombre_display', 'created_by', 'created_by_nombre',
            'ncf', 'tipo', 'tipo_nombre', 'fecha', 'fecha_vencimiento_pago',
            'cliente_nombre', 'cliente_rnc', 'cliente_direccion',
            'ncf_relacionado', 'ncf_relacionado_ncf', 'motivo_nota',
            'forma_pago', 'forma_pago_nombre', 'moneda',
            'subtotal', 'descuento', 'itbis', 'total',
            'monto_pagado', 'saldo_pendiente',
            'estado', 'estado_nombre', 'motivo_anulacion',
            'datos_especificos', 'detalles', 'pagos',
        ]
        read_only_fields = [
            'colmado', 'ncf', 'fecha', 'estado', 'motivo_anulacion',
            'subtotal', 'descuento', 'itbis', 'total',
        ]

    def get_tipo_nombre(self, obj):
        return dict(obj._meta.get_field('tipo').choices).get(obj.tipo, obj.tipo)

    def get_estado_nombre(self, obj):
        return dict(Factura.ESTADOS).get(obj.estado, obj.estado)

    def get_forma_pago_nombre(self, obj):
        return dict(Factura.FORMAS_PAGO).get(obj.forma_pago, obj.forma_pago)


class FacturaDetalleInputSerializer(serializers.Serializer):
    producto = serializers.IntegerField(required=False, allow_null=True)
    descripcion = serializers.CharField()
    codigo = serializers.CharField(required=False, allow_blank=True, default='')
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=4)
    unidad = serializers.CharField(required=False, default='UND')
    precio_unitario = serializers.DecimalField(max_digits=12, decimal_places=2)
    descuento = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    tasa_itbis = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=0)


class PagoInputSerializer(serializers.Serializer):
    metodo = serializers.ChoiceField(choices=[m[0] for m in PagoFactura.METODOS])
    monto = serializers.DecimalField(max_digits=12, decimal_places=2)
    referencia = serializers.CharField(required=False, allow_blank=True, default='')
    notas = serializers.CharField(required=False, allow_blank=True, default='')


class FacturaCreateSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=['01', '02', '03', '04', '11', '13', '14', '15'])
    venta = serializers.IntegerField(required=False, allow_null=True)
    cliente = serializers.IntegerField(required=False, allow_null=True)
    cliente_nombre = serializers.CharField(required=False, default='Consumidor Final')
    cliente_rnc = serializers.CharField(required=False, allow_blank=True, default='')
    cliente_direccion = serializers.CharField(required=False, allow_blank=True, default='')
    ncf_relacionado = serializers.IntegerField(required=False, allow_null=True)
    motivo_nota = serializers.CharField(required=False, allow_blank=True, default='')
    forma_pago = serializers.ChoiceField(choices=[f[0] for f in Factura.FORMAS_PAGO], default=Factura.FORMA_EFECTIVO)
    fecha_vencimiento_pago = serializers.DateField(required=False, allow_null=True)
    datos_especificos = serializers.DictField(required=False, default=dict)
    detalles = FacturaDetalleInputSerializer(many=True, required=False, default=list)
    pagos = PagoInputSerializer(many=True, required=False, default=list)
    # Legacy flat fields from POS integration
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    itbis = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)

    def validate(self, data):
        tipo = data['tipo']

        if tipo == '01':
            rnc = data.get('cliente_rnc', '').strip()
            if not rnc:
                raise serializers.ValidationError({'cliente_rnc': 'El RNC/Cédula es obligatorio para Crédito Fiscal (B01).'})
            _validar_rnc_cedula(rnc)
            nombre = data.get('cliente_nombre', '').strip()
            if not nombre or nombre == 'Consumidor Final':
                raise serializers.ValidationError({'cliente_nombre': 'Se requiere nombre del contribuyente para Crédito Fiscal (B01).'})

        if tipo in TIPOS_REQUIEREN_RELACIONADO:
            if not data.get('ncf_relacionado'):
                raise serializers.ValidationError({'ncf_relacionado': f'El NCF relacionado es obligatorio para tipo B{tipo}.'})
            if not data.get('motivo_nota', '').strip():
                raise serializers.ValidationError({'motivo_nota': f'El motivo es obligatorio para tipo B{tipo}.'})

        if tipo == '11':
            if not data.get('datos_especificos', {}).get('proveedor_nombre', '').strip():
                raise serializers.ValidationError({'datos_especificos': 'Se requiere "proveedor_nombre" en datos_especificos para B11.'})

        if tipo == '13':
            if not data.get('datos_especificos', {}).get('concepto', '').strip():
                raise serializers.ValidationError({'datos_especificos': 'Se requiere "concepto" en datos_especificos para B13.'})

        if tipo == '15':
            if not data.get('datos_especificos', {}).get('institucion_nombre', '').strip():
                raise serializers.ValidationError({'datos_especificos': 'Se requiere "institucion_nombre" en datos_especificos para B15.'})

        return data

    @transaction.atomic
    def create(self, validated_data):
        from apps.ventas.models import Venta
        from apps.inventario.models import Producto
        from apps.clientes.models import Cliente

        request = self.context['request']
        colmado = request.user.colmado
        tipo = validated_data['tipo']

        seq = SecuenciaNCF.objects.filter(
            colmado=colmado, tipo=tipo, activo=True,
            fecha_vencimiento__gte=timezone.now().date(),
        ).exclude(
            secuencia_actual__gt=F('secuencia_hasta')
        ).first()

        if not seq:
            raise serializers.ValidationError(
                f'No hay secuencia NCF activa y disponible para tipo B{tipo}. '
                f'Crea o activa una secuencia desde Facturación > Secuencias NCF.'
            )

        ncf = seq.siguiente_ncf()

        venta_obj = None
        if validated_data.get('venta'):
            venta_obj = Venta.objects.filter(pk=validated_data['venta'], colmado=colmado).first()

        ncf_relacionado_obj = None
        if validated_data.get('ncf_relacionado'):
            ncf_relacionado_obj = Factura.objects.filter(
                pk=validated_data['ncf_relacionado'], colmado=colmado
            ).first()

        cliente_obj = None
        if validated_data.get('cliente'):
            cliente_obj = Cliente.objects.filter(pk=validated_data['cliente'], colmado=colmado).first()

        factura = Factura.objects.create(
            colmado=colmado,
            created_by=request.user,
            venta=venta_obj,
            cliente=cliente_obj,
            ncf=ncf,
            tipo=tipo,
            cliente_nombre=validated_data.get('cliente_nombre', 'Consumidor Final'),
            cliente_rnc=validated_data.get('cliente_rnc', ''),
            cliente_direccion=validated_data.get('cliente_direccion', ''),
            ncf_relacionado=ncf_relacionado_obj,
            motivo_nota=validated_data.get('motivo_nota', ''),
            forma_pago=validated_data.get('forma_pago', Factura.FORMA_EFECTIVO),
            fecha_vencimiento_pago=validated_data.get('fecha_vencimiento_pago'),
            datos_especificos=validated_data.get('datos_especificos', {}),
            estado=Factura.ESTADO_EMITIDA,
        )

        detalles_data = validated_data.get('detalles', [])
        if detalles_data:
            for d in detalles_data:
                producto_obj = None
                if d.get('producto'):
                    producto_obj = Producto.objects.filter(pk=d['producto'], colmado=colmado).first()
                FacturaDetalle.objects.create(
                    factura=factura,
                    producto=producto_obj,
                    descripcion=d['descripcion'],
                    codigo=d.get('codigo', ''),
                    cantidad=d['cantidad'],
                    unidad=d.get('unidad', 'UND'),
                    precio_unitario=d['precio_unitario'],
                    descuento=d.get('descuento', 0),
                    tasa_itbis=d.get('tasa_itbis', 0),
                )
            factura.recalcular_totales()
        else:
            # Legacy POS path: totals provided directly
            factura.subtotal = validated_data.get('subtotal') or 0
            factura.itbis = validated_data.get('itbis') or 0
            factura.total = validated_data.get('total') or 0
            factura.save(update_fields=['subtotal', 'itbis', 'total'])

        pagos_data = validated_data.get('pagos', [])
        for p in pagos_data:
            PagoFactura.objects.create(
                factura=factura,
                metodo=p['metodo'],
                monto=p['monto'],
                referencia=p.get('referencia', ''),
                notas=p.get('notas', ''),
            )

        # Determine payment state
        if factura.total > 0:
            monto_pagado = factura.monto_pagado
            if validated_data.get('forma_pago') == Factura.FORMA_CREDITO:
                factura.estado = Factura.ESTADO_PENDIENTE
            elif monto_pagado >= factura.total:
                factura.estado = Factura.ESTADO_PAGADA
            elif monto_pagado > 0:
                factura.estado = Factura.ESTADO_PARCIAL
            factura.save(update_fields=['estado'])

        return factura
