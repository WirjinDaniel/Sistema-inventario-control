from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display
from .models import DevolucionSuplidor, DevolucionSuplidorItem


class DevolucionSuplidorItemInline(TabularInline):
    model = DevolucionSuplidorItem
    extra = 0
    tab = True
    fields = ("producto", "cantidad", "precio_unitario", "motivo_item")
    readonly_fields = ("producto",)


@admin.register(DevolucionSuplidor)
class DevolucionSuplidorAdmin(ModelAdmin):
    list_display = (
        "pk", "suplidor", "orden_compra",
        "display_monto", "display_estado", "fecha",
    )
    list_filter = ("estado", "colmado")
    search_fields = ("suplidor__nombre", "motivo")
    readonly_fields = ("fecha", "colmado", "usuario", "monto_credito")
    date_hierarchy = "fecha"
    inlines = [DevolucionSuplidorItemInline]

    fieldsets = (
        ("Devolución a suplidor", {
            "classes": ["tab"],
            "fields": ("colmado", "suplidor", "orden_compra", "usuario", "fecha"),
        }),
        ("Detalle", {
            "classes": ["tab"],
            "fields": ("motivo", "monto_credito", "estado"),
        }),
    )

    @display(description="Monto crédito")
    def display_monto(self, obj):
        return format_html("<strong>RD${}</strong>", f"{obj.monto_credito:,.2f}")

    @display(description="Estado", label={
        "PENDIENTE": "warning",
        "APROBADA": "success",
        "RECHAZADA": "danger",
        "PROCESADA": "info",
    })
    def display_estado(self, obj):
        return obj.estado

    def has_add_permission(self, request):
        return False
