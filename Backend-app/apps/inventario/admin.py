from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline
from .models import Categoria, Marca, Producto, MovimientoInventario, PresentacionProducto, ReglaDescuento


class PresentacionInline(TabularInline):
    model = PresentacionProducto
    extra = 0
    fields = ("nombre", "factor_conversion", "precio_venta", "codigo_barras", "activo")


class ReglaDescuentoInline(TabularInline):
    model = ReglaDescuento
    extra = 0
    fields = ("nombre", "cantidad_minima", "tipo", "valor", "activo")


@admin.register(Categoria)
class CategoriaAdmin(ModelAdmin):
    list_display = ("nombre", "color", "icono", "colmado", "activo")
    list_filter = ("activo", "colmado")
    search_fields = ("nombre",)
    list_editable = ("activo",)


@admin.register(Marca)
class MarcaAdmin(ModelAdmin):
    list_display = ("nombre", "pais_origen", "colmado", "activo")
    list_filter = ("activo", "colmado")
    search_fields = ("nombre",)
    list_editable = ("activo",)


@admin.register(Producto)
class ProductoAdmin(ModelAdmin):
    list_display = (
        "nombre", "sku", "codigo_barras", "tipo", "categoria",
        "precio_costo", "precio_venta", "stock_actual", "stock_minimo", "activo",
    )
    list_filter = ("tipo", "activo", "colmado", "categoria", "itbis_exento")
    search_fields = ("nombre", "sku", "codigo_barras")
    list_editable = ("activo",)
    readonly_fields = ("creado_en", "actualizado_en")
    date_hierarchy = "creado_en"
    inlines = [PresentacionInline, ReglaDescuentoInline]

    fieldsets = (
        ("Identificación", {"fields": ("colmado", "categoria", "sku", "codigo_barras", "nombre")}),
        ("Tipo y medida", {"fields": ("tipo", "unidad_medida", "unidades_por_caja")}),
        ("Precios", {"fields": ("precio_costo", "precio_venta", "itbis_exento")}),
        ("Oferta", {"fields": ("precio_oferta", "oferta_inicio", "oferta_fin")}),
        ("Stock", {"fields": ("stock_actual", "stock_minimo", "fecha_vencimiento")}),
        ("Extra", {"fields": ("proveedor", "notas", "activo", "creado_en", "actualizado_en")}),
    )


@admin.register(MovimientoInventario)
class MovimientoInventarioAdmin(ModelAdmin):
    list_display = ("tipo", "producto", "cantidad", "costo_unitario", "usuario", "fecha")
    list_filter = ("tipo", "colmado")
    search_fields = ("producto__nombre", "nota")
    readonly_fields = ("colmado", "producto", "tipo", "cantidad", "costo_unitario", "usuario", "fecha")
    date_hierarchy = "fecha"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
