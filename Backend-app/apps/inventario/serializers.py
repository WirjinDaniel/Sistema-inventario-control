from decimal import Decimal
from rest_framework import serializers
from .models import Categoria, Marca, Producto, PresentacionProducto, MovimientoInventario, ReglaDescuento


class CategoriaSerializer(serializers.ModelSerializer):
    total_productos = serializers.SerializerMethodField()

    class Meta:
        model = Categoria
        fields = ['id', 'colmado', 'nombre', 'color', 'icono', 'activo', 'total_productos']
        read_only_fields = ['colmado']

    def get_total_productos(self, obj):
        return obj.productos.filter(activo=True).count()


class MarcaSerializer(serializers.ModelSerializer):
    total_productos = serializers.SerializerMethodField()

    class Meta:
        model = Marca
        fields = ['id', 'colmado', 'nombre', 'pais_origen', 'activo', 'total_productos']
        read_only_fields = ['colmado']

    def get_total_productos(self, obj):
        return Producto.objects.filter(colmado=obj.colmado, proveedor__icontains=obj.nombre, activo=True).count()


class PresentacionProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PresentacionProducto
        fields = ['id', 'producto', 'nombre', 'factor_conversion', 'precio_venta', 'codigo_barras', 'activo']

    def validate_factor_conversion(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError('El factor de conversión debe ser mayor a 0.')
        return value


class ReglaDescuentoSerializer(serializers.ModelSerializer):
    producto_nombre  = serializers.CharField(source='producto.nombre', read_only=True)
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)

    class Meta:
        model = ReglaDescuento
        fields = [
            'id', 'colmado', 'producto', 'producto_nombre', 'categoria', 'categoria_nombre',
            'nombre', 'cantidad_minima', 'tipo', 'valor', 'activo', 'creado_en',
        ]
        read_only_fields = ['colmado', 'creado_en']


class ProductoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    categoria_color  = serializers.CharField(source='categoria.color', read_only=True)
    categoria_icono  = serializers.CharField(source='categoria.icono', read_only=True)
    margen_ganancia  = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    stock_bajo       = serializers.BooleanField(read_only=True)
    en_oferta        = serializers.BooleanField(read_only=True)
    precio_vigente   = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    presentaciones   = PresentacionProductoSerializer(many=True, read_only=True)
    reglas_descuento = ReglaDescuentoSerializer(many=True, read_only=True)

    class Meta:
        model = Producto
        fields = [
            'id', 'colmado', 'categoria', 'categoria_nombre', 'categoria_color', 'categoria_icono',
            'sku', 'codigo_barras', 'nombre', 'tipo', 'unidad_medida',
            'precio_costo', 'precio_venta', 'precio_oferta', 'oferta_inicio', 'oferta_fin',
            'precio_vigente', 'en_oferta', 'margen_ganancia',
            'stock_actual', 'stock_minimo', 'stock_bajo',
            'fecha_vencimiento', 'activo', 'proveedor', 'unidades_por_caja', 'itbis_exento', 'notas',
            'creado_en', 'presentaciones', 'reglas_descuento',
        ]
        read_only_fields = ['colmado', 'creado_en', 'actualizado_en']


    def validate(self, data):
        inicio = data.get('oferta_inicio')
        fin = data.get('oferta_fin')
        if inicio and fin and inicio >= fin:
            raise serializers.ValidationError(
                {'oferta_fin': 'La fecha de fin de oferta debe ser posterior a la de inicio.'}
            )
        return data


class MovimientoInventarioSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)

    class Meta:
        model = MovimientoInventario
        fields = [
            'id', 'colmado', 'producto', 'producto_nombre', 'tipo',
            'cantidad', 'costo_unitario', 'usuario', 'usuario_nombre',
            'nota', 'fecha',
        ]
        read_only_fields = ['colmado', 'usuario', 'fecha']

    def validate(self, data):
        cantidad = data.get('cantidad', 0)
        if cantidad <= 0:
            raise serializers.ValidationError({'cantidad': 'La cantidad debe ser mayor a 0.'})
        tipo = data.get('tipo')
        producto = data.get('producto')
        if tipo in ('SALIDA', 'MERMA') and producto:
            if producto.stock_actual < cantidad:
                raise serializers.ValidationError(
                    f'Stock insuficiente para "{producto.nombre}". '
                    f'Disponible: {producto.stock_actual}, solicitado: {cantidad}.'
                )
        return data
