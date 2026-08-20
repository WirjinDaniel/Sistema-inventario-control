from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display
from .models import SecuenciaNCF, Factura, FacturaDetalle, PagoFactura


class FacturaDetalleInline(TabularInline):
    model = FacturaDetalle
    extra = 0
    tab = True
    fields = ("descripcion", "cantidad", "precio_unitario", "tasa_itbis", "itbis_monto", "subtotal", "total")
    readonly_fields = ("itbis_monto", "subtotal", "total")


class PagoFacturaInline(TabularInline):
    model = PagoFactura
    extra = 0
    tab = True
    fields = ("metodo", "monto", "referencia", "notas", "fecha")
    readonly_fields = ("fecha",)


@admin.register(SecuenciaNCF)
class SecuenciaNCFAdmin(ModelAdmin):
    list_display = (
        "display_tipo", "colmado",
        "secuencia_desde", "secuencia_hasta", "secuencia_actual",
        "display_disponibles", "fecha_vencimiento", "display_activo",
    )
    list_filter = ("tipo", "activo", "colmado")
    readonly_fields = ("secuencia_actual",)

    @display(description="Tipo NCF", label={
        "01": "primary",
        "02": "info",
        "03": "warning",
        "04": "warning",
        "11": "secondary",
        "13": "secondary",
        "14": "secondary",
        "15": "secondary",
    })
    def display_tipo(self, obj):
        nombres = {
            "01": "B01 Crédito Fiscal",
            "02": "B02 Consumo",
            "03": "B03 Nota Débito",
            "04": "B04 Nota Crédito",
            "11": "B11 Proveedores",
            "13": "B13 Gastos Menores",
            "14": "B14 Régimen Especial",
            "15": "B15 Gubernamental",
        }
        return nombres.get(obj.tipo, f"B{obj.tipo}")

    @display(description="Disponibles")
    def display_disponibles(self, obj):
        d = obj.disponibles
        if obj.agotada:
            return format_html('<span class="unfold-badge unfold-badge-danger">Agotada</span>')
        if obj.vencida:
            return format_html('<span class="unfold-badge unfold-badge-danger">Vencida</span>')
        color = "success" if d > 10 else "warning"
        return format_html('<span class="unfold-badge unfold-badge-{}">{} disp.</span>', color, d)

    @display(description="Activo", label={True: "success", False: "danger"}, boolean=True)
    def display_activo(self, obj):
        return obj.activo


@admin.register(Factura)
class FacturaAdmin(ModelAdmin):
    list_display = (
        "ncf", "display_tipo", "cliente_nombre",
        "display_itbis", "display_total", "display_estado", "fecha",
    )
    list_filter = ("tipo", "estado", "colmado")
    search_fields = ("ncf", "cliente_nombre", "cliente_rnc")
    readonly_fields = ("ncf", "fecha", "colmado", "subtotal", "descuento", "itbis", "total")
    date_hierarchy = "fecha"
    inlines = [FacturaDetalleInline, PagoFacturaInline]

    fieldsets = (
        ("Datos fiscales", {
            "classes": ["tab"],
            "fields": ("colmado", "ncf", "tipo", "fecha", "created_by", "venta", "cliente"),
        }),
        ("Cliente", {
            "classes": ["tab"],
            "fields": ("cliente_nombre", "cliente_rnc", "cliente_direccion"),
        }),
        ("Nota de crédito/débito", {
            "classes": ["tab"],
            "fields": ("ncf_relacionado", "motivo_nota"),
        }),
        ("Montos", {
            "classes": ["tab"],
            "fields": ("subtotal", "descuento", "itbis", "total", "forma_pago", "fecha_vencimiento_pago"),
        }),
        ("Estado", {
            "classes": ["tab"],
            "fields": ("estado", "motivo_anulacion"),
        }),
    )

    @display(description="Tipo", label={
        "01": "primary",
        "02": "info",
        "03": "warning",
        "04": "warning",
        "11": "secondary",
        "13": "secondary",
        "14": "secondary",
        "15": "secondary",
    })
    def display_tipo(self, obj):
        return f"B{obj.tipo}"

    @display(description="ITBIS")
    def display_itbis(self, obj):
        if obj.itbis:
            return format_html("RD${}", f"{obj.itbis:,.2f}")
        return "—"

    @display(description="Total")
    def display_total(self, obj):
        return format_html("<strong>RD${}</strong>", f"{obj.total:,.2f}")

    @display(description="Estado", label={
        "EMITIDA": "info",
        "PAGADA": "success",
        "PENDIENTE": "warning",
        "PARCIAL": "warning",
        "ANULADA": "danger",
        "BORRADOR": "secondary",
    })
    def display_estado(self, obj):
        return obj.estado

    def has_add_permission(self, request):
        return False
