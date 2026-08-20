from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display
from .models import Devolucion, DevolucionItem


class DevolucionItemInline(TabularInline):
    model = DevolucionItem
    extra = 0
    tab = True
    fields = ("venta_item", "cantidad", "precio_unitario")
    readonly_fields = ("venta_item",)


@admin.register(Devolucion)
class DevolucionAdmin(ModelAdmin):
    list_display = (
        "pk", "venta", "cliente", "cajero",
        "display_monto", "display_metodo", "display_estado", "fecha",
    )
    list_filter = ("estado", "metodo_devolucion", "colmado")
    search_fields = ("cliente__nombre", "motivo", "venta__id")
    readonly_fields = ("fecha", "monto_devuelto", "colmado", "cajero")
    date_hierarchy = "fecha"
    inlines = [DevolucionItemInline]

    fieldsets = (
        ("Devolución", {
            "classes": ["tab"],
            "fields": ("colmado", "venta", "cliente", "cajero", "fecha"),
        }),
        ("Detalle", {
            "classes": ["tab"],
            "fields": ("motivo", "nota", "metodo_devolucion", "monto_devuelto", "estado"),
        }),
    )

    @display(description="Monto devuelto")
    def display_monto(self, obj):
        return format_html('<strong style="color:#16a34a">RD${}</strong>', f"{obj.monto_devuelto:,.2f}")

    @display(description="Método", label={
        "EFECTIVO": "success",
        "CREDITO": "info",
        "TRANSFERENCIA": "primary",
    })
    def display_metodo(self, obj):
        return obj.metodo_devolucion

    @display(description="Estado", label={
        "PENDIENTE": "warning",
        "PROCESADA": "success",
        "RECHAZADA": "danger",
    })
    def display_estado(self, obj):
        return obj.estado

    def has_add_permission(self, request):
        return False
