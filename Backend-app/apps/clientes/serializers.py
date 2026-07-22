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


class AbonoFiadoSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source='cliente.nombre', read_only=True)
    cajero_nombre = serializers.CharField(source='cajero.nombre', read_only=True)

    class Meta:
        model = AbonoFiado
        fields = ['id', 'cliente', 'cliente_nombre', 'cajero', 'cajero_nombre', 'monto', 'nota', 'fecha']
        read_only_fields = ['cajero', 'fecha']

    @transaction.atomic
    def create(self, validated_data):
        request = self.context['request']
        abono = AbonoFiado.objects.create(cajero=request.user, **validated_data)
        cliente = abono.cliente
        cliente.saldo_deuda = max(cliente.saldo_deuda - abono.monto, 0)
        cliente.save(update_fields=['saldo_deuda'])
        return abono
