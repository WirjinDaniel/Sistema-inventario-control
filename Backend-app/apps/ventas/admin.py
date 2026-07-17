from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline
from .models import BancoCuenta, SesionCaja, Venta, VentaDetalle


class VentaDetalleInline(TabularInline):
    model = VentaDetalle
    extra = 0
    fields = ("producto", "cantidad", "precio_unitario", "descuento", "subtotal")
    readonly_fields = ("subtotal",)


@admin.register(BancoCuenta)
class BancoCuentaAdmin(ModelAdmin):
    list_display = ("banco", "numero_cuenta", "titular", "colmado", "activo")
    list_filter = ("activo", "colmado")
    search_fields = ("banco", "titular")
    list_editable = ("activo",)


@admin.register(SesionCaja)
class SesionCajaAdmin(ModelAdmin):
    list_display = ("cajero", "colmado", "apertura", "cierre", "efectivo_inicial", "efectivo_final_declarado")
    list_filter = ("colmado",)
    search_fields = ("cajero__nombre",)
    readonly_fields = ("apertura",)
    date_hierarchy = "apertura"


@admin.register(Venta)
class VentaAdmin(ModelAdmin):
    list_display = ("pk", "cajero", "cliente", "total", "metodo_pago", "estado", "fecha")
    list_filter = ("estado", "metodo_pago", "colmado")
    search_fields = ("cajero__nombre", "cliente__nombre")
    readonly_fields = ("fecha", "subtotal", "total", "cambio")
    date_hierarchy = "fecha"
    inlines = [VentaDetalleInline]

    fieldsets = (
        ("Venta", {"fields": ("colmado", "cajero", "sesion_caja", "cliente", "banco_cuenta")}),
        ("Montos", {"fields": ("subtotal", "descuento", "total", "monto_pagado", "cambio")}),
        ("Estado", {"fields": ("metodo_pago", "estado", "motivo_anulacion", "fecha")}),
    )

    def has_add_permission(self, request):
        return False
