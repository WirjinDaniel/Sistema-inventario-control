from django.db import models
from django.db import transaction
from django.utils import timezone
from apps.usuarios.models import Colmado, Usuario
from apps.ventas.models import Venta
from apps.inventario.models import Producto
from apps.clientes.models import Cliente


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

TIPOS_REQUIEREN_RELACIONADO = frozenset({'03', '04'})


class SecuenciaNCF(models.Model):
    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='secuencias_ncf')
    tipo = models.CharField(max_length=2, choices=TIPOS_NCF)
    secuencia_desde = models.PositiveIntegerField()
    secuencia_hasta = models.PositiveIntegerField()
    secuencia_actual = models.PositiveIntegerField()
    fecha_inicio = models.DateField(default=timezone.localdate)
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

    @property
    def vencida(self):
        return self.fecha_vencimiento < timezone.now().date()

    @property
    def disponibles(self):
        if self.agotada:
            return 0
        return self.secuencia_hasta - self.secuencia_actual + 1

    @property
    def proxima_a_agotar(self):
        return not self.agotada and not self.vencida and self.disponibles <= 10

    @transaction.atomic
    def siguiente_ncf(self):
        seq = SecuenciaNCF.objects.select_for_update().get(pk=self.pk)
        if seq.agotada:
            raise ValueError(f'Secuencia NCF tipo B{self.tipo} agotada.')
        if seq.vencida:
            raise ValueError(f'Secuencia NCF tipo B{self.tipo} vencida.')
        ncf = f'B{seq.tipo}{str(seq.secuencia_actual).zfill(8)}'
        seq.secuencia_actual += 1
        seq.save(update_fields=['secuencia_actual'])
        return ncf


class Factura(models.Model):
    ESTADO_BORRADOR = 'BORRADOR'
    ESTADO_EMITIDA = 'EMITIDA'
    ESTADO_PAGADA = 'PAGADA'
    ESTADO_PENDIENTE = 'PENDIENTE'
    ESTADO_PARCIAL = 'PARCIAL'
    ESTADO_ANULADA = 'ANULADA'
    ESTADOS = [
        (ESTADO_BORRADOR, 'Borrador'),
        (ESTADO_EMITIDA, 'Emitida'),
        (ESTADO_PAGADA, 'Pagada'),
        (ESTADO_PENDIENTE, 'Pendiente de Pago'),
        (ESTADO_PARCIAL, 'Pago Parcial'),
        (ESTADO_ANULADA, 'Anulada'),
    ]

    FORMA_EFECTIVO = 'EFECTIVO'
    FORMA_TARJETA = 'TARJETA'
    FORMA_TRANSFERENCIA = 'TRANSFERENCIA'
    FORMA_CHEQUE = 'CHEQUE'
    FORMA_CREDITO = 'CREDITO'
    FORMA_MIXTO = 'MIXTO'
    FORMAS_PAGO = [
        (FORMA_EFECTIVO, 'Efectivo'),
        (FORMA_TARJETA, 'Tarjeta'),
        (FORMA_TRANSFERENCIA, 'Transferencia'),
        (FORMA_CHEQUE, 'Cheque'),
        (FORMA_CREDITO, 'Crédito'),
        (FORMA_MIXTO, 'Mixto'),
    ]

    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='facturas')
    venta = models.OneToOneField(
        Venta, on_delete=models.SET_NULL, null=True, blank=True, related_name='factura',
    )
    cliente = models.ForeignKey(
        Cliente, on_delete=models.SET_NULL, null=True, blank=True, related_name='facturas',
    )
    created_by = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='facturas_creadas',
    )
    ncf = models.CharField(max_length=13, unique=True)
    tipo = models.CharField(max_length=2, choices=TIPOS_NCF)
    fecha = models.DateTimeField(auto_now_add=True)
    fecha_vencimiento_pago = models.DateField(null=True, blank=True)
    cliente_nombre = models.CharField(max_length=200, blank=True, default='Consumidor Final')
    cliente_rnc = models.CharField(max_length=15, blank=True)
    cliente_direccion = models.CharField(max_length=300, blank=True)
    ncf_relacionado = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='notas',
    )
    motivo_nota = models.CharField(max_length=300, blank=True)
    forma_pago = models.CharField(max_length=20, choices=FORMAS_PAGO, default=FORMA_EFECTIVO)
    moneda = models.CharField(max_length=3, default='DOP')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    itbis = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    estado = models.CharField(max_length=10, choices=ESTADOS, default=ESTADO_EMITIDA)
    motivo_anulacion = models.CharField(max_length=300, blank=True, default='')
    datos_especificos = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'factura'
        ordering = ['-fecha']
        indexes = [
            models.Index(fields=['colmado', 'fecha']),
            models.Index(fields=['colmado', 'tipo']),
            models.Index(fields=['colmado', 'estado']),
        ]

    def __str__(self):
        return f'{self.ncf} — RD${self.total}'

    def recalcular_totales(self):
        from decimal import Decimal
        detalles = self.detalles.all()
        subtotal_bruto = sum(d.cantidad * d.precio_unitario for d in detalles) or Decimal('0')
        descuento_total = sum(d.descuento for d in detalles) or Decimal('0')
        itbis_total = sum(d.itbis_monto for d in detalles) or Decimal('0')
        self.subtotal = subtotal_bruto - descuento_total
        self.descuento = descuento_total
        self.itbis = itbis_total
        self.total = self.subtotal + self.itbis
        self.save(update_fields=['subtotal', 'descuento', 'itbis', 'total'])

    @property
    def monto_pagado(self):
        return self.pagos.aggregate(t=models.Sum('monto'))['t'] or 0

    @property
    def saldo_pendiente(self):
        return max(self.total - self.monto_pagado, 0)


class FacturaDetalle(models.Model):
    factura = models.ForeignKey(Factura, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    descripcion = models.CharField(max_length=300)
    codigo = models.CharField(max_length=50, blank=True)
    cantidad = models.DecimalField(max_digits=12, decimal_places=4)
    unidad = models.CharField(max_length=20, default='UND')
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    descuento = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tasa_itbis = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    itbis_monto = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = 'factura_detalle'
        ordering = ['id']

    def save(self, *args, **kwargs):
        from decimal import Decimal
        qty = Decimal(str(self.cantidad))
        precio = Decimal(str(self.precio_unitario))
        desc = Decimal(str(self.descuento))
        tasa = Decimal(str(self.tasa_itbis)) / 100
        self.subtotal = (qty * precio) - desc
        self.itbis_monto = self.subtotal * tasa
        self.total = self.subtotal + self.itbis_monto
        super().save(*args, **kwargs)


class PagoFactura(models.Model):
    METODO_EFECTIVO = 'EFECTIVO'
    METODO_TARJETA = 'TARJETA'
    METODO_TRANSFERENCIA = 'TRANSFERENCIA'
    METODO_CHEQUE = 'CHEQUE'
    METODO_CREDITO = 'CREDITO'
    METODOS = [
        (METODO_EFECTIVO, 'Efectivo'),
        (METODO_TARJETA, 'Tarjeta'),
        (METODO_TRANSFERENCIA, 'Transferencia'),
        (METODO_CHEQUE, 'Cheque'),
        (METODO_CREDITO, 'Crédito'),
    ]

    factura = models.ForeignKey(Factura, on_delete=models.CASCADE, related_name='pagos')
    metodo = models.CharField(max_length=20, choices=METODOS)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    referencia = models.CharField(max_length=100, blank=True)
    notas = models.CharField(max_length=200, blank=True)
    fecha = models.DateField(auto_now_add=True)

    class Meta:
        db_table = 'pago_factura'
        ordering = ['fecha']

    def __str__(self):
        return f'{self.get_metodo_display()}: RD${self.monto}'
