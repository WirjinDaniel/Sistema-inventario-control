from rest_framework import serializers
from django.utils import timezone
from .models import SecuenciaNCF, Factura


class SecuenciaNCFSerializer(serializers.ModelSerializer):
    agotada = serializers.BooleanField(read_only=True)
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


class FacturaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Factura
        fields = '__all__'
        read_only_fields = ['colmado', 'ncf', 'fecha']


class FacturaCreateSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=['01', '02', '03', '04', '11', '13', '14', '15'])
    venta = serializers.IntegerField(required=False)
    cliente_nombre = serializers.CharField(required=False, default='Consumidor Final')
    cliente_rnc = serializers.CharField(required=False, allow_blank=True, default='')
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    itbis = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = serializers.DecimalField(max_digits=12, decimal_places=2)

    def create(self, validated_data):
        from apps.ventas.models import Venta
        colmado = self.context['request'].user.colmado
        tipo = validated_data['tipo']

        seq = SecuenciaNCF.objects.filter(
            colmado=colmado, tipo=tipo, activo=True,
            fecha_vencimiento__gte=timezone.now().date(),
        ).exclude(
            secuencia_actual__gt=models.F('secuencia_hasta')
        ).first()

        if not seq:
            raise serializers.ValidationError(f'No hay secuencia NCF activa para tipo {tipo}.')

        ncf = seq.siguiente_ncf()
        venta_obj = None
        if validated_data.get('venta'):
            venta_obj = Venta.objects.filter(pk=validated_data['venta'], colmado=colmado).first()

        return Factura.objects.create(
            colmado=colmado,
            venta=venta_obj,
            ncf=ncf,
            tipo=tipo,
            cliente_nombre=validated_data.get('cliente_nombre', 'Consumidor Final'),
            cliente_rnc=validated_data.get('cliente_rnc', ''),
            subtotal=validated_data['subtotal'],
            itbis=validated_data['itbis'],
            total=validated_data['total'],
        )


# Fix import
from django.db import models
