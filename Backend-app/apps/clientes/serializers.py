import re
from decimal import Decimal
from rest_framework import serializers
from django.db import transaction
from .models import Cliente, AbonoFiado


class ClienteSerializer(serializers.ModelSerializer):
    credito_disponible = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Cliente
        fields = [
            'id', 'colmado', 'nombre', 'telefono', 'cedula',
            'limite_credito', 'saldo_deuda', 'credito_disponible',
            'activo', 'creado_en',
        ]
        read_only_fields = ['colmado', 'saldo_deuda', 'creado_en']

    def validate_cedula(self, value):
        if not value:
            return value
        digits = re.sub(r'[\-\s]', '', value)
        # Cédula dominicana: 11 dígitos; RNC: 9 dígitos
        if not re.match(r'^\d{9}$|^\d{11}$', digits):
            raise serializers.ValidationError('La cédula/RNC debe tener 9 dígitos (RNC) o 11 dígitos (cédula).')
        return value

    def validate_limite_credito(self, value):
        if value < Decimal('0'):
            raise serializers.ValidationError('El límite de crédito no puede ser negativo.')
        return value


class AbonoFiadoSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source='cliente.nombre', read_only=True)
    cajero_nombre = serializers.CharField(source='cajero.nombre', read_only=True)

    class Meta:
        model = AbonoFiado
        fields = ['id', 'cliente', 'cliente_nombre', 'cajero', 'cajero_nombre', 'monto', 'nota', 'fecha']
        read_only_fields = ['cajero', 'fecha']

    def validate_monto(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError('El monto del abono debe ser mayor a 0.')
        return value

    @transaction.atomic
    def create(self, validated_data):
        request = self.context['request']
        abono = AbonoFiado.objects.create(cajero=request.user, **validated_data)
        cliente = abono.cliente
        cliente.saldo_deuda = max(cliente.saldo_deuda - abono.monto, 0)
        cliente.save(update_fields=['saldo_deuda'])
        return abono
