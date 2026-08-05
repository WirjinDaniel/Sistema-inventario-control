from django.db import models
from django.utils import timezone
from apps.usuarios.models import Colmado
from apps.inventario.models import Producto, Categoria


class Promocion(models.Model):
    TIPO_PORCENTAJE = 'PORCENTAJE'
    TIPO_MONTO_FIJO = 'MONTO_FIJO'
    TIPO_2X1 = '2X1'
    TIPO_NXPRECIO = 'NXPRECIO'
    TIPO_CUPON = 'CUPON'
    TIPOS = [
        (TIPO_PORCENTAJE, '% Descuento'),
        (TIPO_MONTO_FIJO, '$ Descuento'),
        (TIPO_2X1, '2×1'),
        (TIPO_NXPRECIO, 'N unidades por precio especial'),
        (TIPO_CUPON, 'Cupón de descuento'),
    ]

    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='promociones')
    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True)
    tipo = models.CharField(max_length=15, choices=TIPOS)

    # Para PORCENTAJE / MONTO_FIJO / CUPON
    valor = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Para 2X1 / NXPRECIO
    cantidad_minima = models.PositiveIntegerField(default=1)
    cantidad_paga = models.PositiveIntegerField(default=1)
    precio_especial = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Para CUPON
    codigo_cupon = models.CharField(max_length=20, blank=True)

    # Alcance
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True, related_name='promociones')
    categoria = models.ForeignKey(Categoria, on_delete=models.SET_NULL, null=True, blank=True, related_name='promociones')

    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_fin = models.DateField(null=True, blank=True)

    activo = models.BooleanField(default=True)
    usos = models.PositiveIntegerField(default=0)
    limite_usos = models.PositiveIntegerField(null=True, blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'promocion'
        ordering = ['-creado_en']

    def __str__(self):
        return f'{self.nombre} ({self.get_tipo_display()})'

    @property
    def vigente(self):
        hoy = timezone.now().date()
        if self.fecha_inicio and hoy < self.fecha_inicio:
            return False
        if self.fecha_fin and hoy > self.fecha_fin:
            return False
        if self.limite_usos and self.usos >= self.limite_usos:
            return False
        return self.activo
