from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline
from .models import Suplidor, OrdenCompra, OrdenCompraItem, PagoSuplidor


class OrdenCompraItemInline(TabularInline):
    model = OrdenCompraItem
    extra = 0
    fields = ("producto", "cantidad", "precio_costo", "subtotal")
    readonly_fields = ("subtotal",)


class PagoSuplidorInline(TabularInline):
    model = PagoSuplidor
    extra = 0
    fields = ("usuario", "monto", "metodo", "referencia", "fecha")
    readonly_fields = ("fecha",)


@admin.register(Suplidor)
class SuplidorAdmin(ModelAdmin):
    list_display = ("nombre", "contacto", "telefono", "tipo_pago", "dias_credito", "activo")
    list_filter = ("tipo_pago", "activo", "colmado", "frecuencia_entrega")
    search_fields = ("nombre", "contacto", "rnc")
    list_editable = ("activo",)
    readonly_fields = ("creado_en",)

    fieldsets = (
        ("Datos", {"fields": ("colmado", "nombre", "contacto", "telefono", "email", "rnc", "direccion")}),
        ("Condiciones", {"fields": ("tipo_pago", "dias_credito", "limite_credito", "descuento_habitual", "frecuencia_entrega")}),
        ("Extra", {"fields": ("notas", "activo", "creado_en")}),
    )


@admin.register(OrdenCompra)
class OrdenCompraAdmin(ModelAdmin):
    list_display = ("pk", "suplidor", "numero_factura", "total", "estado", "fecha", "fecha_recepcion")
    list_filter = ("estado", "suplidor__colmado")
    search_fields = ("suplidor__nombre", "numero_factura")
    readonly_fields = ("fecha",)
    date_hierarchy = "fecha"
    inlines = [OrdenCompraItemInline, PagoSuplidorInline]

    fieldsets = (
        ("Orden", {"fields": ("suplidor", "usuario", "numero_factura", "fecha", "fecha_recepcion")}),
        ("Totales", {"fields": ("total", "estado", "notas")}),
    )
