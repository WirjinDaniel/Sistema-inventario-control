from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Usuario, Colmado, AuditoriaLog


class ColmadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Colmado
        fields = '__all__'
        read_only_fields = ['id', 'creado_en']


class UsuarioSerializer(serializers.ModelSerializer):
    colmado_nombre = serializers.CharField(source='colmado.nombre', read_only=True, default=None)

    class Meta:
        model = Usuario
        fields = ['id', 'username', 'nombre', 'rol', 'colmado', 'colmado_nombre',
                  'is_active', 'is_superuser', 'creado_en']
        read_only_fields = ['creado_en', 'is_superuser']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        # Solo el propio SUPERADMIN puede ver qué usuarios son superusuarios
        if not request or not request.user.is_superuser:
            data.pop('is_superuser', None)
        return data


class UsuarioCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = Usuario
        fields = ['username', 'nombre', 'rol', 'colmado', 'pin_caja', 'password']

    def validate(self, attrs):
        # Bloquear cualquier intento de asignar is_superuser desde el exterior
        if 'is_superuser' in self.initial_data or 'is_staff' in self.initial_data:
            raise serializers.ValidationError('No puedes asignar privilegios de superusuario.')
        return attrs

    def validate_colmado(self, value):
        request = self.context.get('request')
        if request and not request.user.is_superuser:
            if value != request.user.colmado:
                raise serializers.ValidationError('No puedes crear usuarios en otro colmado.')
        return value

    def validate_rol(self, value):
        # Un ADMIN de colmado no puede crear otro ADMIN si no tiene permiso explícito.
        # El SUPERADMIN puede asignar cualquier rol.
        from apps.usuarios.models import Usuario as U
        request = self.context.get('request')
        if request and not request.user.is_superuser:
            # Roles no disponibles para ADMIN al crear usuarios
            if value not in (U.ROL_CAJERO, U.ROL_INVENTARIO, U.ROL_ADMIN):
                raise serializers.ValidationError('Rol no válido.')
        return value

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
        token['is_superuser'] = user.is_superuser
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        # Incluir is_superuser explícitamente en el login aunque el serializer lo oculte en otros contextos
        usuario_data = UsuarioSerializer(self.user).data
        usuario_data['is_superuser'] = self.user.is_superuser
        data['usuario'] = usuario_data
        return data
