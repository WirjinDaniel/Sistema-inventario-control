from django.db import models
from apps.usuarios.models import Colmado, Usuario
from apps.compras.models import Suplidor, OrdenCompra
from apps.inventario.models import Producto


class DevolucionSuplidor(models.Model):
    ESTADO_PENDIENTE = 'PENDIENTE'
    ESTADO_APROBADA = 'APROBADA'
    ESTADO_RECHAZADA = 'RECHAZADA'
    ESTADOS = [
        (ESTADO_PENDIENTE, 'Pendiente'),
        (ESTADO_APROBADA, 'Aprobada'),
        (ESTADO_RECHAZADA, 'Rechazada'),
    ]

    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='devoluciones_suplidores')
    suplidor = models.ForeignKey(Suplidor, on_delete=models.CASCADE, related_name='devoluciones')
    orden_compra = models.ForeignKey(OrdenCompra, on_delete=models.SET_NULL, null=True, blank=True, related_name='devoluciones')
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='devoluciones_suplidores')
    fecha = models.DateTimeField(auto_now_add=True)
    motivo = models.CharField(max_length=200)
    nota = models.TextField(blank=True)
    estado = models.CharField(max_length=10, choices=ESTADOS, default=ESTADO_PENDIENTE)
    monto_credito = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = 'devolucion_suplidor'
        ordering = ['-fecha']

    def __str__(self):
        return f'DevSup #{self.pk} — {self.suplidor.nombre} — RD${self.monto_credito}'


class DevolucionSuplidorItem(models.Model):
    devolucion = models.ForeignKey(DevolucionSuplidor, on_delete=models.CASCADE, related_name='items')
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='devoluciones_suplidores')
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    motivo_item = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = 'devolucion_suplidor_item'

    def __str__(self):
        return f'{self.producto.nombre} x {self.cantidad}'
