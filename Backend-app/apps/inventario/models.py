from django.db import models
from apps.usuarios.models import Colmado, Usuario


class Categoria(models.Model):
    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='categorias')
    nombre = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default='#6366f1')   # hex color
    icono = models.CharField(max_length=30, default='package')  # nombre ícono lucide
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'categoria'
        unique_together = ('colmado', 'nombre')


class Marca(models.Model):
    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='marcas')
    nombre = models.CharField(max_length=100)
    pais_origen = models.CharField(max_length=80, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'marca'
        unique_together = ('colmado', 'nombre')
        ordering = ['nombre']

    def __str__(self):
        return self.nombre

    def __str__(self):
        return self.nombre


class Producto(models.Model):
    TIPO_UNIDAD = 'UNIDAD'
    TIPO_GRANEL = 'GRANEL'
    TIPOS = [(TIPO_UNIDAD, 'Por unidad'), (TIPO_GRANEL, 'A granel')]

    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='productos')
    categoria = models.ForeignKey(Categoria, on_delete=models.SET_NULL, null=True, blank=True, related_name='productos')
    sku = models.CharField(max_length=50, blank=True)
    codigo_barras = models.CharField(max_length=100, blank=True, db_index=True)
    nombre = models.CharField(max_length=200, db_index=True)
    tipo = models.CharField(max_length=10, choices=TIPOS, default=TIPO_UNIDAD)
    unidad_medida = models.CharField(max_length=20, default='unidad')
    precio_costo = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    precio_venta = models.DecimalField(max_digits=12, decimal_places=2)
    stock_actual = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    stock_minimo = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    activo = models.BooleanField(default=True)
    proveedor = models.CharField(max_length=200, blank=True)
    unidades_por_caja = models.PositiveIntegerField(null=True, blank=True)
    itbis_exento = models.BooleanField(default=False)
    notas = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'producto'
        indexes = [
            models.Index(fields=['colmado', 'codigo_barras']),
            models.Index(fields=['colmado', 'nombre']),
        ]

    def __str__(self):
        return self.nombre

    # ── Oferta temporal ──────────────────────────────────────────────────
    precio_oferta  = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    oferta_inicio  = models.DateField(null=True, blank=True)
    oferta_fin     = models.DateField(null=True, blank=True)

    @property
    def en_oferta(self):
        from django.utils.timezone import now
        hoy = now().date()
        return bool(
            self.precio_oferta and
            self.oferta_inicio and self.oferta_fin and
            self.oferta_inicio <= hoy <= self.oferta_fin
        )

    @property
    def precio_vigente(self):
        return self.precio_oferta if self.en_oferta else self.precio_venta

    @property
    def margen_ganancia(self):
        if self.precio_costo > 0:
            return ((self.precio_venta - self.precio_costo) / self.precio_costo) * 100
        return 0

    @property
    def stock_bajo(self):
        return self.stock_actual <= self.stock_minimo


class ReglaDescuento(models.Model):
    TIPO_PORCENTAJE = 'PORCENTAJE'
    TIPO_MONTO = 'MONTO_FIJO'
    TIPOS = [(TIPO_PORCENTAJE, 'Porcentaje (%)'), (TIPO_MONTO, 'Monto fijo (RD$)')]

    colmado          = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='reglas_descuento')
    producto         = models.ForeignKey(Producto, on_delete=models.CASCADE, null=True, blank=True, related_name='reglas_descuento')
    categoria        = models.ForeignKey(Categoria, on_delete=models.CASCADE, null=True, blank=True, related_name='reglas_descuento')
    nombre           = models.CharField(max_length=100)
    cantidad_minima  = models.DecimalField(max_digits=10, decimal_places=3)
    tipo             = models.CharField(max_length=12, choices=TIPOS, default=TIPO_PORCENTAJE)
    valor            = models.DecimalField(max_digits=8, decimal_places=2)  # % o RD$ fijo por unidad
    activo           = models.BooleanField(default=True)
    creado_en        = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'regla_descuento'
        ordering = ['cantidad_minima']

    def __str__(self):
        return f'{self.nombre} — {self.cantidad_minima}+ → {self.valor}{" %" if self.tipo == self.TIPO_PORCENTAJE else " RD$"}'


class PresentacionProducto(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='presentaciones')
    nombre = models.CharField(max_length=100)             # "Caja de 12", "Libra", "Paquete 5 lb"
    factor_conversion = models.DecimalField(max_digits=10, decimal_places=4)  # unidades base equivalentes
    precio_venta = models.DecimalField(max_digits=12, decimal_places=2)
    codigo_barras = models.CharField(max_length=100, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'presentacion_producto'

    def __str__(self):
        return f'{self.producto.nombre} — {self.nombre}'


class MovimientoInventario(models.Model):
    TIPO_ENTRADA = 'ENTRADA'
    TIPO_SALIDA = 'SALIDA'
    TIPO_AJUSTE = 'AJUSTE'
    TIPO_MERMA = 'MERMA'
    TIPOS = [
        (TIPO_ENTRADA, 'Entrada de mercancía'),
        (TIPO_SALIDA, 'Salida por venta'),
        (TIPO_AJUSTE, 'Ajuste de inventario'),
        (TIPO_MERMA, 'Merma / pérdida'),
    ]

    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='movimientos')
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='movimientos')
    tipo = models.CharField(max_length=10, choices=TIPOS)
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    costo_unitario = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, related_name='movimientos')
    nota = models.TextField(blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'movimiento_inventario'
        ordering = ['-fecha']

    def __str__(self):
        return f'{self.tipo} - {self.producto.nombre} ({self.cantidad})'
