from rest_framework import serializers
from .models import Promocion


class PromocionSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    vigente = serializers.BooleanField(read_only=True)

    class Meta:
        model = Promocion
        fields = '__all__'
        read_only_fields = ['colmado', 'usos', 'creado_en']
