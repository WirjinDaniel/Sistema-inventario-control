from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import CategoriaGasto, Gasto


@admin.register(CategoriaGasto)
class CategoriaGastoAdmin(ModelAdmin):
    list_display = ("nombre", "tipo", "icono", "colmado", "activo", "predefinida")
    list_filter = ("tipo", "activo", "predefinida", "colmado")
    search_fields = ("nombre",)
    list_editable = ("activo",)

    def has_delete_permission(self, request, obj=None):
        if obj and obj.predefinida:
            return False
        return super().has_delete_permission(request, obj)


@admin.register(Gasto)
class GastoAdmin(ModelAdmin):
    list_display = ("descripcion", "categoria", "monto", "metodo_pago", "usuario", "fecha")
    list_filter = ("metodo_pago", "categoria__tipo", "colmado")
    search_fields = ("descripcion", "comprobante")
    readonly_fields = ("fecha",)
    date_hierarchy = "fecha"

    fieldsets = (
        ("Gasto", {"fields": ("colmado", "categoria", "usuario", "descripcion", "monto")}),
        ("Pago", {"fields": ("metodo_pago", "comprobante", "nota", "fecha")}),
    )

    def has_change_permission(self, request, obj=None):
        return False
