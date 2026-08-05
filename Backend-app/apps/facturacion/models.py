from django.db import models
from django.db import transaction
from apps.usuarios.models import Colmado
from apps.ventas.models import Venta


TIPOS_NCF = [
    ('01', 'Crédito Fiscal'),
    ('02', 'Consumo'),
    ('03', 'Nota de Débito'),
    ('04', 'Nota de Crédito'),
    ('11', 'Proveedores Informales'),
    ('13', 'Gastos Menores'),
    ('14', 'Régimen Especial'),
    ('15', 'Gubernamental'),
]


class SecuenciaNCF(models.Model):
    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='secuencias_ncf')
    tipo = models.CharField(max_length=2, choices=TIPOS_NCF)
    secuencia_desde = models.PositiveIntegerField()
    secuencia_hasta = models.PositiveIntegerField()
    secuencia_actual = models.PositiveIntegerField()
    fecha_vencimiento = models.DateField()
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'secuencia_ncf'
        ordering = ['tipo', '-id']

    def __str__(self):
        return f'B{self.tipo} ({self.secuencia_actual}/{self.secuencia_hasta})'

    @property
    def agotada(self):
        return self.secuencia_actual > self.secuencia_hasta

    @transaction.atomic
    def siguiente_ncf(self):
        seq = SecuenciaNCF.objects.select_for_update().get(pk=self.pk)
        if seq.agotada:
            raise ValueError(f'Secuencia NCF tipo {self.tipo} agotada.')
        ncf = f'B{seq.tipo}{str(seq.secuencia_actual).zfill(8)}'
        seq.secuencia_actual += 1
        seq.save(update_fields=['secuencia_actual'])
        return ncf


class Factura(models.Model):
    ESTADO_VALIDA = 'VALIDA'
    ESTADO_ANULADA = 'ANULADA'
    ESTADOS = [(ESTADO_VALIDA, 'Válida'), (ESTADO_ANULADA, 'Anulada')]

    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='facturas')
    venta = models.OneToOneField(Venta, on_delete=models.SET_NULL, null=True, blank=True, related_name='factura')
    ncf = models.CharField(max_length=13, unique=True)
    tipo = models.CharField(max_length=2, choices=TIPOS_NCF)
    fecha = models.DateTimeField(auto_now_add=True)
    cliente_nombre = models.CharField(max_length=200, blank=True, default='Consumidor Final')
    cliente_rnc = models.CharField(max_length=15, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    itbis = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    estado = models.CharField(max_length=7, choices=ESTADOS, default=ESTADO_VALIDA)

    class Meta:
        db_table = 'factura'
        ordering = ['-fecha']
        indexes = [models.Index(fields=['colmado', 'fecha'])]

    def __str__(self):
        return f'{self.ncf} — RD${self.total}'
