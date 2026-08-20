from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from unfold.decorators import display
from .models import CategoriaGasto, Gasto


@admin.register(CategoriaGasto)
class CategoriaGastoAdmin(ModelAdmin):
    list_display = ("nombre", "display_tipo", "icono", "colmado", "display_activo", "predefinida")
    list_filter = ("tipo", "activo", "predefinida", "colmado")
    search_fields = ("nombre",)

    @display(description="Tipo", label={
        "OPERATIVO": "info",
        "ADMINISTRATIVO": "primary",
        "FINANCIERO": "warning",
        "OTRO": "secondary",
    })
    def display_tipo(self, obj):
        return obj.tipo

    @display(description="Activo", label={True: "success", False: "danger"}, boolean=True)
    def display_activo(self, obj):
        return obj.activo

    def has_delete_permission(self, request, obj=None):
        if obj and obj.predefinida:
            return False
        return super().has_delete_permission(request, obj)


@admin.register(Gasto)
class GastoAdmin(ModelAdmin):
    list_display = ("descripcion", "categoria", "display_monto", "display_metodo", "usuario", "fecha")
    list_filter = ("metodo_pago", "categoria__tipo", "colmado")
    search_fields = ("descripcion", "comprobante")
    readonly_fields = ("fecha",)
    date_hierarchy = "fecha"

    fieldsets = (
        ("Gasto", {
            "classes": ["tab"],
            "fields": ("colmado", "categoria", "usuario", "descripcion", "monto"),
        }),
        ("Pago y comprobante", {
            "classes": ["tab"],
            "fields": ("metodo_pago", "comprobante", "nota", "fecha"),
        }),
    )

    @display(description="Monto")
    def display_monto(self, obj):
        return format_html('<strong style="color:#dc2626">RD${}</strong>', f"{obj.monto:,.2f}")

    @display(description="Método", label={
        "EFECTIVO": "success",
        "TARJETA": "info",
        "TRANSFERENCIA": "primary",
        "CHEQUE": "secondary",
    })
    def display_metodo(self, obj):
        return obj.metodo_pago

    def has_change_permission(self, request, obj=None):
        return False
