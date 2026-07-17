from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Usuario, Colmado, AuditoriaLog


class ColmadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Colmado
        fields = '__all__'


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['id', 'username', 'nombre', 'rol', 'colmado', 'is_active', 'creado_en']
        read_only_fields = ['creado_en']


class UsuarioCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = Usuario
        fields = ['username', 'nombre', 'rol', 'colmado', 'pin_caja', 'password']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = Usuario(**validated_data)
        user.set_password(password)
        user.save()
        return user


class AuditoriaLogSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)

    class Meta:
        model = AuditoriaLog
        fields = ['id', 'usuario', 'usuario_nombre', 'accion', 'modulo',
                  'objeto_id', 'descripcion', 'ip', 'fecha', 'extra']


class CustomTokenSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['nombre'] = user.nombre
        token['rol'] = user.rol
        token['colmado_id'] = user.colmado_id
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['usuario'] = UsuarioSerializer(self.user).data
        return data
