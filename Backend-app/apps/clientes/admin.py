from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline
from .models import Cliente, AbonoFiado


class AbonoFiadoInline(TabularInline):
    model = AbonoFiado
    extra = 0
    fields = ("cajero", "monto", "nota", "fecha")
    readonly_fields = ("fecha",)


@admin.register(Cliente)
class ClienteAdmin(ModelAdmin):
    list_display = ("nombre", "telefono", "cedula", "limite_credito", "saldo_deuda", "activo", "creado_en")
    list_filter = ("activo", "colmado")
    search_fields = ("nombre", "telefono", "cedula")
    readonly_fields = ("creado_en",)
    list_editable = ("activo",)
    inlines = [AbonoFiadoInline]

    fieldsets = (
        ("Datos personales", {"fields": ("colmado", "nombre", "telefono", "cedula")}),
        ("Fiado", {"fields": ("limite_credito", "saldo_deuda")}),
        ("Estado", {"fields": ("activo", "creado_en")}),
    )


@admin.register(AbonoFiado)
class AbonoFiadoAdmin(ModelAdmin):
    list_display = ("cliente", "monto", "cajero", "fecha")
    list_filter = ("cliente__colmado",)
    search_fields = ("cliente__nombre",)
    readonly_fields = ("fecha",)
    date_hierarchy = "fecha"

    def has_change_permission(self, request, obj=None):
        return False
