from django.db import models
from apps.usuarios.models import Colmado, Usuario
from apps.inventario.models import Producto


class HistorialPrecio(models.Model):
    CAMPO_PRECIO_VENTA = 'precio_venta'
    CAMPO_PRECIO_COSTO = 'precio_costo'
    CAMPO_PRECIO_OFERTA = 'precio_oferta'
    CAMPOS = [
        (CAMPO_PRECIO_VENTA, 'Precio de venta'),
        (CAMPO_PRECIO_COSTO, 'Precio de costo'),
        (CAMPO_PRECIO_OFERTA, 'Precio de oferta'),
    ]

    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='historial_precios')
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='historial_precios')
    campo = models.CharField(max_length=20, choices=CAMPOS)
    valor_anterior = models.DecimalField(max_digits=12, decimal_places=2)
    valor_nuevo = models.DecimalField(max_digits=12, decimal_places=2)
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='cambios_precio')
    fecha = models.DateTimeField(auto_now_add=True)
    motivo = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = 'historial_precio'
        ordering = ['-fecha']
        indexes = [models.Index(fields=['colmado', 'producto', 'campo'])]

    def __str__(self):
        return f'{self.producto.nombre} — {self.campo}: {self.valor_anterior} → {self.valor_nuevo}'
