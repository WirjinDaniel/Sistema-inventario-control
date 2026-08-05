from rest_framework import serializers
from .models import HistorialPrecio


class HistorialPrecioSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)

    class Meta:
        model = HistorialPrecio
        fields = [
            'id', 'producto', 'producto_nombre', 'campo',
            'valor_anterior', 'valor_nuevo', 'usuario', 'usuario_nombre',
            'fecha', 'motivo',
        ]
