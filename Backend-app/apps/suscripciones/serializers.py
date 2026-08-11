from decimal import Decimal
from rest_framework import serializers
from .models import Plan, Suscripcion, PagoSuscripcion


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ['id', 'nombre', 'precio_mensual', 'max_usuarios', 'max_productos',
                  'descripcion', 'activo', 'creado_en']
        read_only_fields = ['creado_en']


class PagoSuscripcionSerializer(serializers.ModelSerializer):
    registrado_por_nombre = serializers.CharField(source='registrado_por.nombre', read_only=True, default=None)

    class Meta:
        model = PagoSuscripcion
        fields = ['id', 'suscripcion', 'monto', 'fecha', 'metodo', 'referencia',
                  'nota', 'registrado_por', 'registrado_por_nombre', 'creado_en']
        read_only_fields = ['registrado_por', 'creado_en']

    def validate_monto(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError('El monto del pago debe ser mayor a 0.')
        return value

    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['registrado_por'] = request.user
        return super().create(validated_data)


class SuscripcionSerializer(serializers.ModelSerializer):
    colmado_nombre = serializers.CharField(source='colmado.nombre', read_only=True)
    plan_nombre    = serializers.CharField(source='plan.nombre', read_only=True, default=None)
    esta_activa    = serializers.BooleanField(read_only=True)
    dias_restantes = serializers.IntegerField(read_only=True)
    pagos          = PagoSuscripcionSerializer(many=True, read_only=True)

    class Meta:
        model = Suscripcion
        fields = ['id', 'colmado', 'colmado_nombre', 'plan', 'plan_nombre',
                  'fecha_inicio', 'fecha_vencimiento', 'estado',
                  'precio_mensual', 'precio_pagado',
                  'max_productos', 'max_usuarios',
                  'nota', 'esta_activa', 'dias_restantes', 'pagos', 'creado_en', 'actualizado_en']
        read_only_fields = ['creado_en', 'actualizado_en']


class SuscripcionResumenSerializer(serializers.ModelSerializer):
    """Versión ligera para el ADMIN del colmado (solo lectura, sin pagos)."""
    plan_nombre    = serializers.CharField(source='plan.nombre', read_only=True, default=None)
    esta_activa    = serializers.BooleanField(read_only=True)
    dias_restantes = serializers.IntegerField(read_only=True)

    class Meta:
        model = Suscripcion
        fields = ['plan_nombre', 'fecha_inicio', 'fecha_vencimiento', 'estado',
                  'esta_activa', 'dias_restantes', 'precio_mensual', 'max_productos', 'max_usuarios']


class AjustarCapacidadSerializer(serializers.Serializer):
    max_productos  = serializers.IntegerField(min_value=1, required=False)
    max_usuarios   = serializers.IntegerField(min_value=1, required=False)
    precio_mensual = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False)
    pago_monto     = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False)
    pago_metodo    = serializers.ChoiceField(choices=PagoSuscripcion.METODOS, required=False)
    pago_referencia = serializers.CharField(max_length=100, required=False, allow_blank=True)
    nota           = serializers.CharField(required=False, allow_blank=True)
