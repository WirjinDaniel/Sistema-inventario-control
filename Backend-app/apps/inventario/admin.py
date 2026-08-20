from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display
from .models import Categoria, Marca, Producto, MovimientoInventario, PresentacionProducto, ReglaDescuento


class PresentacionInline(TabularInline):
    model = PresentacionProducto
    extra = 0
    tab = True
    fields = ("nombre", "factor_conversion", "precio_venta", "codigo_barras", "activo")


class ReglaDescuentoInline(TabularInline):
    model = ReglaDescuento
    extra = 0
    tab = True
    fields = ("nombre", "cantidad_minima", "tipo", "valor", "activo")


@admin.register(Categoria)
class CategoriaAdmin(ModelAdmin):
    list_display = ("nombre_con_color", "icono", "colmado", "display_activo")
    list_filter = ("activo", "colmado")
    search_fields = ("nombre",)

    @display(description="Categoría")
    def nombre_con_color(self, obj):
        color = obj.color or "#6366f1"
        return format_html(
            '<span style="display:inline-flex;align-items:center;gap:6px;">'
            '<span style="width:12px;height:12px;border-radius:50%;background:{}"></span>{}'
            "</span>",
            color, obj.nombre,
        )

    @display(description="Activo", label={True: "success", False: "danger"}, boolean=True)
    def display_activo(self, obj):
        return obj.activo


@admin.register(Marca)
class MarcaAdmin(ModelAdmin):
    list_display = ("nombre", "pais_origen", "colmado", "display_activo")
    list_filter = ("activo", "colmado")
    search_fields = ("nombre",)

    @display(description="Activo", label={True: "success", False: "danger"}, boolean=True)
    def display_activo(self, obj):
        return obj.activo


@admin.register(Producto)
class ProductoAdmin(ModelAdmin):
    list_display = (
        "nombre", "sku", "categoria",
        "display_precio_venta", "display_stock", "display_tipo", "display_activo",
    )
    list_filter = ("tipo", "activo", "colmado", "categoria", "itbis_exento")
    search_fields = ("nombre", "sku", "codigo_barras")
    readonly_fields = ("creado_en", "actualizado_en")
    date_hierarchy = "creado_en"
    inlines = [PresentacionInline, ReglaDescuentoInline]
    warn_unsaved_changes = True

    fieldsets = (
        ("Identificación", {
            "classes": ["tab"],
            "fields": ("colmado", "categoria", "sku", "codigo_barras", "nombre"),
        }),
        ("Tipo y medida", {
            "classes": ["tab"],
            "fields": ("tipo", "unidad_medida", "unidades_por_caja"),
        }),
        ("Precios", {
            "classes": ["tab"],
            "fields": ("precio_costo", "precio_venta", "itbis_exento"),
        }),
        ("Oferta", {
            "classes": ["tab"],
            "fields": ("precio_oferta", "oferta_inicio", "oferta_fin"),
        }),
        ("Stock", {
            "classes": ["tab"],
            "fields": ("stock_actual", "stock_minimo", "fecha_vencimiento"),
        }),
        ("Extra", {
            "classes": ["tab"],
            "fields": ("proveedor", "notas", "activo", "creado_en", "actualizado_en"),
        }),
    )

    @display(description="Precio Venta")
    def display_precio_venta(self, obj):
        return format_html("<strong>RD${}</strong>", f"{obj.precio_venta:,.2f}")

    @display(description="Stock")
    def display_stock(self, obj):
        if obj.stock_actual <= 0:
            color, texto = "danger", f"{obj.stock_actual} — Sin stock"
        elif obj.stock_actual <= obj.stock_minimo:
            color, texto = "warning", f"{obj.stock_actual} — Bajo"
        else:
            color, texto = "success", str(obj.stock_actual)
        return format_html(
            '<span class="unfold-badge unfold-badge-{}">{}</span>', color, texto
        )

    @display(description="Tipo", label={
        "UNIDAD": "info",
        "SERVICIO": "warning",
        "COMPUESTO": "primary",
    })
    def display_tipo(self, obj):
        return obj.tipo

    @display(description="Activo", label={True: "success", False: "danger"}, boolean=True)
    def display_activo(self, obj):
        return obj.activo


@admin.register(MovimientoInventario)
class MovimientoInventarioAdmin(ModelAdmin):
    list_display = ("display_tipo", "producto", "display_cantidad", "costo_unitario", "usuario", "fecha")
    list_filter = ("tipo", "colmado")
    search_fields = ("producto__nombre", "nota")
    readonly_fields = ("colmado", "producto", "tipo", "cantidad", "costo_unitario", "usuario", "fecha", "nota")
    date_hierarchy = "fecha"

    @display(description="Tipo", label={
        "ENTRADA": "success",
        "SALIDA": "danger",
        "AJUSTE": "warning",
        "MERMA": "info",
    })
    def display_tipo(self, obj):
        return obj.tipo

    @display(description="Cantidad")
    def display_cantidad(self, obj):
        if obj.tipo == "ENTRADA":
            color, signo = "#16a34a", "+"
        elif obj.tipo in ("SALIDA", "MERMA"):
            color, signo = "#dc2626", "-"
        else:
            color, signo = "#6366f1", "="
        return format_html(
            '<strong style="color:{}">{}{}</strong>', color, signo, obj.cantidad
        )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
