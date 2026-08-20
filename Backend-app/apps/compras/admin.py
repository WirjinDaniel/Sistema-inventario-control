from decimal import Decimal
from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display
from .models import Suplidor, OrdenCompra, OrdenCompraItem, PagoSuplidor
from apps.inventario.models import Producto, MovimientoInventario
from apps.usuarios.audit import log as audit_log
from apps.usuarios.models import AuditoriaLog
from apps.dashboard.permissions import IsAdminOfColmado, IsSuperadmin


class OrdenCompraItemInline(TabularInline):
    model = OrdenCompraItem
    extra = 0
    tab = True
    fields = ("producto", "cantidad", "precio_costo", "subtotal")
    readonly_fields = ("subtotal",)


class PagoSuplidorInline(TabularInline):
    model = PagoSuplidor
    extra = 0
    tab = True
    fields = ("usuario", "monto", "metodo", "referencia", "fecha")
    readonly_fields = ("fecha",)


@admin.register(Suplidor)
class SuplidorAdmin(ModelAdmin):
    list_display = ("nombre", "contacto", "telefono", "display_tipo_pago", "dias_credito", "display_activo")
    list_filter = ("tipo_pago", "activo", "colmado", "frecuencia_entrega")
    search_fields = ("nombre", "contacto", "rnc")
    readonly_fields = ("creado_en",)

    fieldsets = (
        ("Datos del suplidor", {
            "classes": ["tab"],
            "fields": ("colmado", "nombre", "contacto", "telefono", "email", "rnc", "direccion"),
        }),
        ("Condiciones comerciales", {
            "classes": ["tab"],
            "fields": ("tipo_pago", "dias_credito", "limite_credito", "descuento_habitual", "frecuencia_entrega"),
        }),
        ("Extra", {
            "classes": ["tab"],
            "fields": ("notas", "activo", "creado_en"),
        }),
    )

    @display(description="Tipo pago", label={
        "CONTADO": "success",
        "CREDITO": "warning",
        "MIXTO": "info",
    })
    def display_tipo_pago(self, obj):
        return obj.tipo_pago

    @display(description="Activo", label={True: "success", False: "danger"}, boolean=True)
    def display_activo(self, obj):
        return obj.activo


@admin.register(OrdenCompra)
class OrdenCompraAdmin(ModelAdmin):
    list_display = (
        "pk", "suplidor", "numero_factura",
        "display_total", "display_estado", "fecha", "fecha_recepcion",
    )
    list_filter = ("estado", "suplidor__colmado")
    search_fields = ("suplidor__nombre", "numero_factura")
    readonly_fields = ("fecha",)
    date_hierarchy = "fecha"
    inlines = [OrdenCompraItemInline, PagoSuplidorInline]

    fieldsets = (
        ("Orden de compra", {
            "classes": ["tab"],
            "fields": ("suplidor", "usuario", "numero_factura", "fecha", "fecha_recepcion"),
        }),
        ("Totales y estado", {
            "classes": ["tab"],
            "fields": ("total", "estado", "notas"),
        }),
    )

    @display(description="Total")
    def display_total(self, obj):
        return format_html("<strong>RD${}</strong>", f"{obj.total:,.2f}")

    @display(description="Estado", label={
        "PENDIENTE": "warning",
        "RECIBIDA": "success",
        "CANCELADA": "danger",
        "PARCIAL": "info",
    })
    def display_estado(self, obj):
        return obj.estado
