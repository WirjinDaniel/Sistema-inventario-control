from django.db import models
from apps.usuarios.models import Colmado, Usuario


class CategoriaGasto(models.Model):
    TIPO_FIJO = 'FIJO'
    TIPO_VARIABLE = 'VARIABLE'
    TIPO_FINANCIERO = 'FINANCIERO'
    TIPO_PERDIDA = 'PERDIDA'
    TIPO_ADMINISTRATIVO = 'ADMINISTRATIVO'
    TIPO_RETIRO = 'RETIRO'
    TIPOS = [
        (TIPO_FIJO,           'Gasto fijo'),
        (TIPO_VARIABLE,       'Gasto variable'),
        (TIPO_FINANCIERO,     'Gasto financiero'),
        (TIPO_PERDIDA,        'Pérdida'),
        (TIPO_ADMINISTRATIVO, 'Gasto administrativo'),
        (TIPO_RETIRO,         'Retiro del propietario'),
    ]

    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='categorias_gasto')
    nombre = models.CharField(max_length=150)
    tipo = models.CharField(max_length=15, choices=TIPOS)
    icono = models.CharField(max_length=30, blank=True)
    activo = models.BooleanField(default=True)
    predefinida = models.BooleanField(default=False)  # no se puede eliminar si es predefinida

    class Meta:
        db_table = 'categoria_gasto'
        ordering = ['tipo', 'nombre']

    def __str__(self):
        return f'{self.nombre} ({self.tipo})'


class Gasto(models.Model):
    METODO_EFECTIVO = 'EFECTIVO'
    METODO_TARJETA = 'TARJETA'
    METODO_TRANSFERENCIA = 'TRANSFERENCIA'
    METODO_CHEQUE = 'CHEQUE'
    METODOS_PAGO = [
        (METODO_EFECTIVO,      'Efectivo'),
        (METODO_TARJETA,       'Tarjeta'),
        (METODO_TRANSFERENCIA, 'Transferencia'),
        (METODO_CHEQUE,        'Cheque'),
    ]

    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='gastos')
    categoria = models.ForeignKey(CategoriaGasto, on_delete=models.PROTECT, related_name='gastos')
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, related_name='gastos')
    descripcion = models.CharField(max_length=300)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    metodo_pago = models.CharField(max_length=15, choices=METODOS_PAGO, default=METODO_EFECTIVO)
    fecha = models.DateTimeField(auto_now_add=True)
    comprobante = models.CharField(max_length=50, blank=True)
    nota = models.TextField(blank=True)

    class Meta:
        db_table = 'gasto'
        ordering = ['-fecha']
        indexes = [models.Index(fields=['colmado', 'fecha'])]

    def __str__(self):
        return f'{self.descripcion} — RD${self.monto}'
