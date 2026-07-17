from django.db import models
from apps.usuarios.models import Colmado, Usuario
from apps.inventario.models import Producto
from apps.clientes.models import Cliente


class BancoCuenta(models.Model):
    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='bancos')
    banco = models.CharField(max_length=100)              # "Banreservas", "Popular", "BHD León"
    numero_cuenta = models.CharField(max_length=20, blank=True)  # últimos 4 dígitos
    titular = models.CharField(max_length=150, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'banco_cuenta'

    def __str__(self):
        return f'{self.banco} — {self.numero_cuenta or self.titular}'


class SesionCaja(models.Model):
    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='sesiones_caja')
    cajero = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='sesiones_caja')
    apertura = models.DateTimeField(auto_now_add=True)
    cierre = models.DateTimeField(null=True, blank=True)
    efectivo_inicial = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    efectivo_final_declarado = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    efectivo_calculado = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    nota_cierre = models.TextField(blank=True)

    class Meta:
        db_table = 'sesion_caja'
        ordering = ['-apertura']

    def __str__(self):
        return f'Caja {self.cajero.nombre} - {self.apertura.strftime("%d/%m/%Y %H:%M")}'

    @property
    def esta_abierta(self):
        return self.cierre is None

    @property
    def diferencia_caja(self):
        if self.efectivo_final_declarado is not None and self.efectivo_calculado is not None:
            return self.efectivo_final_declarado - self.efectivo_calculado
        return None


class Venta(models.Model):
    PAGO_EFECTIVO = 'EFECTIVO'
    PAGO_TARJETA = 'TARJETA'
    PAGO_TRANSFERENCIA = 'TRANSFERENCIA'
    PAGO_FIADO = 'FIADO'
    METODOS_PAGO = [
        (PAGO_EFECTIVO, 'Efectivo'),
        (PAGO_TARJETA, 'Tarjeta'),
        (PAGO_TRANSFERENCIA, 'Transferencia'),
        (PAGO_FIADO, 'Fiado'),
    ]

    ESTADO_COMPLETADA = 'COMPLETADA'
    ESTADO_ANULADA = 'ANULADA'
    ESTADOS = [(ESTADO_COMPLETADA, 'Completada'), (ESTADO_ANULADA, 'Anulada')]

    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='ventas')
    cajero = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='ventas')
    sesion_caja = models.ForeignKey(SesionCaja, on_delete=models.CASCADE, related_name='ventas')
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True, related_name='ventas')
    banco_cuenta = models.ForeignKey(BancoCuenta, on_delete=models.SET_NULL, null=True, blank=True, related_name='ventas')
    fecha = models.DateTimeField(auto_now_add=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    metodo_pago = models.CharField(max_length=15, choices=METODOS_PAGO)
    monto_pagado = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cambio = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    estado = models.CharField(max_length=10, choices=ESTADOS, default=ESTADO_COMPLETADA)
    motivo_anulacion = models.TextField(blank=True)

    class Meta:
        db_table = 'venta'
        ordering = ['-fecha']
        indexes = [models.Index(fields=['colmado', 'fecha'])]

    def __str__(self):
        return f'Venta #{self.pk} - RD${self.total}'


class VentaDetalle(models.Model):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='detalles_venta')
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    descuento = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'venta_detalle'

    def __str__(self):
        return f'{self.producto.nombre} x {self.cantidad}'
