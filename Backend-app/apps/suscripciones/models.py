from django.db import models
from apps.usuarios.models import Colmado, Usuario


class Plan(models.Model):
    nombre = models.CharField(max_length=100)
    precio_mensual = models.DecimalField(max_digits=10, decimal_places=2)
    max_usuarios = models.PositiveIntegerField(default=5)
    max_productos = models.PositiveIntegerField(default=500)
    descripcion = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'plan'
        ordering = ['precio_mensual']

    def __str__(self):
        return f'{self.nombre} — RD${self.precio_mensual}/mes'


class Suscripcion(models.Model):
    ESTADO_ACTIVA     = 'ACTIVA'
    ESTADO_PENDIENTE  = 'PENDIENTE'
    ESTADO_VENCIDA    = 'VENCIDA'
    ESTADO_SUSPENDIDA = 'SUSPENDIDA'
    ESTADO_CANCELADA  = 'CANCELADA'
    ESTADOS = [
        (ESTADO_ACTIVA,     'Activa'),
        (ESTADO_PENDIENTE,  'Pendiente'),
        (ESTADO_VENCIDA,    'Vencida'),
        (ESTADO_SUSPENDIDA, 'Suspendida'),
        (ESTADO_CANCELADA,  'Cancelada'),
    ]

    colmado           = models.OneToOneField(Colmado, on_delete=models.CASCADE, related_name='suscripcion')
    plan              = models.ForeignKey(Plan, on_delete=models.SET_NULL, null=True, blank=True, related_name='suscripciones')
    fecha_inicio      = models.DateField()
    fecha_vencimiento = models.DateField()
    estado            = models.CharField(max_length=15, choices=ESTADOS, default=ESTADO_ACTIVA)
    precio_mensual    = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    precio_pagado     = models.DecimalField(max_digits=10, decimal_places=2)
    max_productos     = models.PositiveIntegerField(default=300)
    max_usuarios      = models.PositiveIntegerField(default=2)
    nota              = models.TextField(blank=True)
    creado_en         = models.DateTimeField(auto_now_add=True)
    actualizado_en    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'suscripcion'
        ordering = ['-creado_en']

    def __str__(self):
        return f'{self.colmado.nombre} — {self.plan.nombre} [{self.estado}]'

    @property
    def esta_activa(self):
        from django.utils import timezone
        return self.estado == self.ESTADO_ACTIVA and self.fecha_vencimiento >= timezone.now().date()

    @property
    def dias_restantes(self):
        from django.utils import timezone
        delta = self.fecha_vencimiento - timezone.now().date()
        return max(delta.days, 0)


class PagoSuscripcion(models.Model):
    METODO_EFECTIVO       = 'EFECTIVO'
    METODO_TRANSFERENCIA  = 'TRANSFERENCIA'
    METODO_TARJETA        = 'TARJETA'
    METODO_OTRO           = 'OTRO'
    METODOS = [
        (METODO_EFECTIVO,      'Efectivo'),
        (METODO_TRANSFERENCIA, 'Transferencia bancaria'),
        (METODO_TARJETA,       'Tarjeta'),
        (METODO_OTRO,          'Otro'),
    ]

    suscripcion    = models.ForeignKey(Suscripcion, on_delete=models.CASCADE, related_name='pagos')
    monto          = models.DecimalField(max_digits=10, decimal_places=2)
    fecha          = models.DateField()
    metodo         = models.CharField(max_length=20, choices=METODOS)
    referencia     = models.CharField(max_length=100, blank=True)
    nota           = models.TextField(blank=True)
    registrado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, related_name='pagos_suscripcion')
    creado_en      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pago_suscripcion'
        ordering = ['-fecha']

    def __str__(self):
        return f'Pago RD${self.monto} — {self.suscripcion.colmado.nombre} — {self.fecha}'
