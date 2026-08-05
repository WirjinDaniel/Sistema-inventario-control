from django.db import models
from apps.usuarios.models import Colmado, Usuario
from apps.ventas.models import Venta, VentaDetalle
from apps.clientes.models import Cliente


class Devolucion(models.Model):
    METODO_EFECTIVO = 'EFECTIVO'
    METODO_CREDITO = 'CREDITO_CUENTA'
    METODO_CAMBIO = 'CAMBIO_PRODUCTO'
    METODOS = [
        (METODO_EFECTIVO, 'Efectivo'),
        (METODO_CREDITO, 'Crédito en cuenta'),
        (METODO_CAMBIO, 'Cambio de producto'),
    ]

    ESTADO_PENDIENTE = 'PENDIENTE'
    ESTADO_PROCESADA = 'PROCESADA'
    ESTADO_ANULADA = 'ANULADA'
    ESTADOS = [
        (ESTADO_PENDIENTE, 'Pendiente'),
        (ESTADO_PROCESADA, 'Procesada'),
        (ESTADO_ANULADA, 'Anulada'),
    ]

    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='devoluciones')
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='devoluciones')
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True, related_name='devoluciones')
    cajero = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='devoluciones')
    fecha = models.DateTimeField(auto_now_add=True)
    motivo = models.CharField(max_length=200)
    nota = models.TextField(blank=True)
    metodo_devolucion = models.CharField(max_length=20, choices=METODOS, default=METODO_EFECTIVO)
    monto_devuelto = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    estado = models.CharField(max_length=10, choices=ESTADOS, default=ESTADO_PROCESADA)

    class Meta:
        db_table = 'devolucion'
        ordering = ['-fecha']

    def __str__(self):
        return f'Dev #{self.pk} — Venta #{self.venta_id} — RD${self.monto_devuelto}'


class DevolucionItem(models.Model):
    devolucion = models.ForeignKey(Devolucion, on_delete=models.CASCADE, related_name='items')
    venta_item = models.ForeignKey(VentaDetalle, on_delete=models.CASCADE, related_name='devoluciones')
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'devolucion_item'

    def __str__(self):
        return f'{self.venta_item.producto.nombre} x {self.cantidad}'
