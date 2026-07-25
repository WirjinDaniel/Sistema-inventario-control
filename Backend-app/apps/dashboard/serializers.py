from rest_framework import serializers
from apps.ventas.models import Venta, SesionCaja
from apps.inventario.models import Producto
from apps.clientes.models import Cliente
from apps.gastos.models import Gasto
from apps.usuarios.models import Colmado
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta


class ColmadoStatsSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre = serializers.CharField()
    ventas_hoy = serializers.DecimalField(max_digits=12, decimal_places=2)
    tickets_hoy = serializers.IntegerField()
    usuarios = serializers.IntegerField()
    productos = serializers.IntegerField()


class DashboardGlobalSerializer(serializers.Serializer):
    periodo = serializers.DateField()
    colmados_activos = serializers.IntegerField()
    ventas_totales = serializers.DecimalField(max_digits=12, decimal_places=2)
    ventas_hoy = serializers.DecimalField(max_digits=12, decimal_places=2)
    tickets_totales = serializers.IntegerField()
    tickets_hoy = serializers.IntegerField()
    clientes_activos = serializers.IntegerField()
    productos_totales = serializers.IntegerField()
    productos_bajo_stock = serializers.IntegerField()
    gastos_totales = serializers.DecimalField(max_digits=12, decimal_places=2)
    gastos_hoy = serializers.DecimalField(max_digits=12, decimal_places=2)
    colmados_stats = ColmadoStatsSerializer(many=True)


class VentasPorColmadoSerializer(serializers.Serializer):
    colmado_nombre = serializers.CharField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    porcentaje = serializers.DecimalField(max_digits=5, decimal_places=2)
    tickets = serializers.IntegerField()


class GastosPorColmadoSerializer(serializers.Serializer):
    colmado_nombre = serializers.CharField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    porcentaje = serializers.DecimalField(max_digits=5, decimal_places=2)
