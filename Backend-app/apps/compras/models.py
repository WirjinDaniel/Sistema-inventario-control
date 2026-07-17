from django.db import models
from apps.usuarios.models import Colmado, Usuario
from apps.inventario.models import Producto


class Suplidor(models.Model):
    PAGO_CONTADO = 'CONTADO'
    PAGO_CREDITO = 'CREDITO'
    TIPOS_PAGO = [(PAGO_CONTADO, 'Contado'), (PAGO_CREDITO, 'Crédito')]

    FREQ_DIARIO = 'DIARIO'
    FREQ_SEMANAL = 'SEMANAL'
    FREQ_QUINCENAL = 'QUINCENAL'
    FREQ_MENSUAL = 'MENSUAL'
    FRECUENCIAS = [
        (FREQ_DIARIO, 'Diario'),
        (FREQ_SEMANAL, 'Semanal'),
        (FREQ_QUINCENAL, 'Quincenal'),
        (FREQ_MENSUAL, 'Mensual'),
    ]

    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='suplidores')
    nombre = models.CharField(max_length=200)
    contacto = models.CharField(max_length=200, blank=True)
    telefono = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    rnc = models.CharField(max_length=20, blank=True)
    direccion = models.TextField(blank=True)
    tipo_pago = models.CharField(max_length=10, choices=TIPOS_PAGO, default=PAGO_CONTADO)
    dias_credito = models.PositiveIntegerField(default=30)
    limite_credito = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    descuento_habitual = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    frecuencia_entrega = models.CharField(max_length=10, choices=FRECUENCIAS, blank=True)
    notas = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'suplidor'

    def __str__(self):
        return self.nombre


class OrdenCompra(models.Model):
    ESTADO_PENDIENTE = 'PENDIENTE'
    ESTADO_RECIBIDA = 'RECIBIDA'
    ESTADO_CANCELADA = 'CANCELADA'
    ESTADOS = [
        (ESTADO_PENDIENTE, 'Pendiente'),
        (ESTADO_RECIBIDA, 'Recibida'),
        (ESTADO_CANCELADA, 'Cancelada'),
    ]

    suplidor = models.ForeignKey(Suplidor, on_delete=models.CASCADE, related_name='ordenes')
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, related_name='ordenes_compra')
    numero_factura = models.CharField(max_length=50, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)
    fecha_recepcion = models.DateTimeField(null=True, blank=True)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    estado = models.CharField(max_length=10, choices=ESTADOS, default=ESTADO_PENDIENTE)
    notas = models.TextField(blank=True)

    class Meta:
        db_table = 'orden_compra'
        ordering = ['-fecha']

    def __str__(self):
        return f'Orden #{self.pk} - {self.suplidor.nombre}'

    @property
    def total_pagado(self):
        return sum(p.monto for p in self.pagos.all())

    @property
    def balance_pendiente(self):
        return self.total - self.total_pagado


class OrdenCompraItem(models.Model):
    orden = models.ForeignKey(OrdenCompra, on_delete=models.CASCADE, related_name='items')
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='items_compra')
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    precio_costo = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'orden_compra_item'

    def __str__(self):
        return f'{self.producto.nombre} x {self.cantidad}'


class PagoSuplidor(models.Model):
    METODO_EFECTIVO = 'EFECTIVO'
    METODO_TRANSFERENCIA = 'TRANSFERENCIA'
    METODO_CHEQUE = 'CHEQUE'
    METODOS = [
        (METODO_EFECTIVO, 'Efectivo'),
        (METODO_TRANSFERENCIA, 'Transferencia'),
        (METODO_CHEQUE, 'Cheque'),
    ]

    orden = models.ForeignKey(OrdenCompra, on_delete=models.CASCADE, related_name='pagos')
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, related_name='pagos_suplidor')
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    fecha = models.DateTimeField(auto_now_add=True)
    metodo = models.CharField(max_length=15, choices=METODOS, default=METODO_EFECTIVO)
    referencia = models.CharField(max_length=50, blank=True)
    nota = models.TextField(blank=True)

    class Meta:
        db_table = 'pago_suplidor'
        ordering = ['-fecha']

    def __str__(self):
        return f'Pago RD${self.monto} — {self.orden}'
