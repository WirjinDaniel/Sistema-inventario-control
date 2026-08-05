from rest_framework import serializers
from .models import CategoriaGasto, Gasto


class CategoriaGastoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaGasto
        fields = ['id', 'colmado', 'nombre', 'tipo', 'icono', 'activo', 'predefinida']
        read_only_fields = ['predefinida', 'colmado']


class GastoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    categoria_tipo = serializers.CharField(source='categoria.tipo', read_only=True)
    categoria_icono = serializers.CharField(source='categoria.icono', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)

    class Meta:
        model = Gasto
        fields = [
            'id', 'colmado', 'categoria', 'categoria_nombre', 'categoria_tipo', 'categoria_icono',
            'usuario', 'usuario_nombre', 'descripcion', 'monto', 'metodo_pago', 'fecha', 'comprobante', 'nota',
        ]
        read_only_fields = ['colmado', 'usuario', 'fecha']
