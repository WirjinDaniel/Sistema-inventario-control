from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.contrib.auth.hashers import make_password, check_password
from django.db import models
from django.utils import timezone


class UsuarioManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError('El username es obligatorio')
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault('rol', Usuario.ROL_ADMIN)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(username, password, **extra_fields)


class Colmado(models.Model):
    nombre = models.CharField(max_length=200)
    ruc = models.CharField(max_length=20, blank=True)
    direccion = models.TextField(blank=True)
    telefono = models.CharField(max_length=20, blank=True)
    config_json = models.JSONField(default=dict)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'colmado'

    def __str__(self):
        return self.nombre


class Usuario(AbstractBaseUser, PermissionsMixin):
    ROL_ADMIN = 'ADMIN'
    ROL_CAJERO = 'CAJERO'
    ROL_INVENTARIO = 'INVENTARIO'
    ROLES = [
        (ROL_ADMIN, 'Administrador'),
        (ROL_CAJERO, 'Cajero'),
        (ROL_INVENTARIO, 'Encargado de Inventario'),
    ]

    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='usuarios', null=True)
    username = models.CharField(max_length=150, unique=True)
    nombre = models.CharField(max_length=200)
    rol = models.CharField(max_length=20, choices=ROLES, default=ROL_CAJERO)
    pin_caja = models.CharField(max_length=128, blank=True)
    permisos_extra = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    creado_en = models.DateTimeField(auto_now_add=True)
    # Seguridad avanzada
    ultimo_acceso = models.DateTimeField(null=True, blank=True)
    debe_cambiar_password = models.BooleanField(default=False)
    intentos_fallidos = models.PositiveSmallIntegerField(default=0)
    bloqueado_hasta = models.DateTimeField(null=True, blank=True)

    objects = UsuarioManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['nombre']

    class Meta:
        db_table = 'usuario'

    def __str__(self):
        return f'{self.nombre} ({self.rol})'

    def set_pin_caja(self, pin_raw):
        """Guarda el PIN hasheado usando el mismo sistema de Django para passwords."""
        self.pin_caja = make_password(str(pin_raw))

    def verificar_pin_caja(self, pin_raw):
        """Verifica el PIN en texto plano contra el hash almacenado."""
        if not self.pin_caja:
            return False
        return check_password(str(pin_raw), self.pin_caja)

    @property
    def es_admin(self):
        return self.rol == self.ROL_ADMIN

    @property
    def es_cajero(self):
        return self.rol in (self.ROL_CAJERO, self.ROL_ADMIN)

    @property
    def esta_bloqueado(self):
        if self.bloqueado_hasta and timezone.now() < self.bloqueado_hasta:
            return True
        return False


class LoginAttempt(models.Model):
    """Registra intentos de login para detectar fuerza bruta."""
    username = models.CharField(max_length=150, db_index=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    exitoso = models.BooleanField(default=False)
    fecha = models.DateTimeField(auto_now_add=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        db_table = 'login_attempt'
        ordering = ['-fecha']
        indexes = [
            models.Index(fields=['username', 'fecha']),
            models.Index(fields=['ip', 'fecha']),
        ]

    def __str__(self):
        estado = 'OK' if self.exitoso else 'FAIL'
        return f'[{estado}] {self.username} desde {self.ip} — {self.fecha}'


class AuditoriaLog(models.Model):
    ACCION_CREAR    = 'CREAR'
    ACCION_EDITAR   = 'EDITAR'
    ACCION_ELIMINAR = 'ELIMINAR'
    ACCION_VENTA    = 'VENTA'
    ACCION_ANULAR   = 'ANULAR'
    ACCION_ABONO    = 'ABONO'
    ACCION_COMPRA   = 'COMPRA'
    ACCION_AJUSTE   = 'AJUSTE'
    ACCION_LOGIN    = 'LOGIN'
    ACCION_LOGOUT   = 'LOGOUT'
    ACCION_CAJA     = 'CAJA'
    ACCION_CONFIG   = 'CONFIG'
    ACCION_PRECIO   = 'PRECIO'
    ACCION_LOGIN_FAIL = 'LOGIN_FAIL'
    ACCIONES = [
        (ACCION_CREAR,      'Creación'),
        (ACCION_EDITAR,     'Edición'),
        (ACCION_ELIMINAR,   'Eliminación'),
        (ACCION_VENTA,      'Venta'),
        (ACCION_ANULAR,     'Anulación'),
        (ACCION_ABONO,      'Abono'),
        (ACCION_COMPRA,     'Compra'),
        (ACCION_AJUSTE,     'Ajuste inventario'),
        (ACCION_LOGIN,      'Inicio sesión'),
        (ACCION_LOGOUT,     'Cierre sesión'),
        (ACCION_CAJA,       'Caja'),
        (ACCION_CONFIG,     'Configuración'),
        (ACCION_PRECIO,     'Cambio de precio'),
        (ACCION_LOGIN_FAIL, 'Intento de login fallido'),
    ]

    colmado     = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='auditoria_logs', null=True)
    usuario     = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, related_name='auditoria_logs')
    accion      = models.CharField(max_length=15, choices=ACCIONES)
    modulo      = models.CharField(max_length=50)
    objeto_id   = models.PositiveIntegerField(null=True, blank=True)
    descripcion = models.TextField()
    ip          = models.GenericIPAddressField(null=True, blank=True)
    user_agent  = models.TextField(blank=True)
    fecha       = models.DateTimeField(auto_now_add=True)
    valor_anterior = models.JSONField(null=True, blank=True)
    valor_nuevo    = models.JSONField(null=True, blank=True)
    extra       = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'auditoria_log'
        ordering = ['-fecha']
        indexes = [
            models.Index(fields=['colmado', 'fecha']),
            models.Index(fields=['colmado', 'usuario', 'fecha']),
            models.Index(fields=['accion', 'fecha']),
        ]

    def __str__(self):
        return f'[{self.accion}] {self.modulo} — {self.descripcion[:60]}'
