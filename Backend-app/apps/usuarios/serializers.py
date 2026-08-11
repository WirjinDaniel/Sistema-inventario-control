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
        from apps.usuarios.models import Usuario as U
        request = self.context.get('request')
        if request and not request.user.is_superuser:
            if value == U.ROL_ADMIN:
                raise serializers.ValidationError(
                    'Solo el Superadministrador puede crear usuarios Administrador.'
                )
            if value not in (U.ROL_CAJERO, U.ROL_INVENTARIO):
                raise serializers.ValidationError('Rol no válido.')
        return value

    def create(self, validated_data):
        from django.contrib.auth.hashers import make_password
        password = validated_data.pop('password')
        if validated_data.get('pin_caja'):
            validated_data['pin_caja'] = make_password(validated_data['pin_caja'])
        user = Usuario(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        from django.contrib.auth.hashers import make_password
        password = validated_data.pop('password', None)
        if 'pin_caja' in validated_data and validated_data['pin_caja']:
            validated_data['pin_caja'] = make_password(validated_data['pin_caja'])
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class AuditoriaLogSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True, default=None)

    class Meta:
        model = AuditoriaLog
        fields = ['id', 'usuario', 'usuario_nombre', 'accion', 'modulo',
                  'objeto_id', 'descripcion', 'ip', 'fecha', 'extra',
                  'valor_anterior', 'valor_nuevo', 'user_agent']


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
