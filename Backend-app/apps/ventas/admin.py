from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display
from .models import BancoCuenta, SesionCaja, Venta, VentaDetalle


class VentaDetalleInline(TabularInline):
    model = VentaDetalle
    extra = 0
    tab = True
    fields = ("producto", "cantidad", "precio_unitario", "descuento", "subtotal")
    readonly_fields = ("subtotal",)


@admin.register(BancoCuenta)
class BancoCuentaAdmin(ModelAdmin):
    list_display = ("banco", "numero_cuenta", "titular", "colmado", "display_activo")
    list_filter = ("activo", "colmado")
    search_fields = ("banco", "titular")

    @display(description="Activo", label={True: "success", False: "danger"}, boolean=True)
    def display_activo(self, obj):
        return obj.activo


@admin.register(SesionCaja)
class SesionCajaAdmin(ModelAdmin):
    list_display = (
        "cajero", "colmado", "apertura", "cierre",
        "display_efectivo_inicial", "display_efectivo_declarado", "display_estado_sesion",
    )
    list_filter = ("colmado",)
    search_fields = ("cajero__nombre",)
    readonly_fields = ("apertura",)
    date_hierarchy = "apertura"

    @display(description="Efectivo inicial")
    def display_efectivo_inicial(self, obj):
        return format_html("RD${}", f"{obj.efectivo_inicial:,.2f}")

    @display(description="Efectivo declarado")
    def display_efectivo_declarado(self, obj):
        if obj.efectivo_final_declarado is None:
            return "—"
        return format_html("RD${}", f"{obj.efectivo_final_declarado:,.2f}")

    @display(description="Estado", label={"Abierta": "success", "Cerrada": "info"})
    def display_estado_sesion(self, obj):
        return "Abierta" if obj.cierre is None else "Cerrada"


@admin.register(Venta)
class VentaAdmin(ModelAdmin):
    list_display = (
        "pk", "cajero", "cliente",
        "display_total", "display_metodo", "display_estado", "fecha",
    )
    list_filter = ("estado", "metodo_pago", "colmado")
    search_fields = ("cajero__nombre", "cliente__nombre")
    readonly_fields = ("fecha", "subtotal", "total", "cambio", "colmado", "cajero")
    date_hierarchy = "fecha"
    inlines = [VentaDetalleInline]

    fieldsets = (
        ("Datos de la venta", {
            "classes": ["tab"],
            "fields": ("colmado", "cajero", "sesion_caja", "cliente", "banco_cuenta"),
        }),
        ("Montos", {
            "classes": ["tab"],
            "fields": ("subtotal", "descuento", "total", "monto_pagado", "cambio"),
        }),
        ("Estado", {
            "classes": ["tab"],
            "fields": ("metodo_pago", "estado", "motivo_anulacion", "fecha"),
        }),
    )

    @display(description="Total")
    def display_total(self, obj):
        return format_html("<strong>RD${}</strong>", f"{obj.total:,.2f}")

    @display(description="Método", label={
        "EFECTIVO": "success",
        "TARJETA": "info",
        "TRANSFERENCIA": "primary",
        "FIADO": "warning",
        "MIXTO": "secondary",
    })
    def display_metodo(self, obj):
        return obj.metodo_pago

    @display(description="Estado", label={
        "COMPLETADA": "success",
        "ANULADA": "danger",
        "PENDIENTE": "warning",
    })
    def display_estado(self, obj):
        return obj.estado

    def has_add_permission(self, request):
        return False
