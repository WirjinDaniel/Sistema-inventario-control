from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from unfold.admin import ModelAdmin
from unfold.decorators import display
from .models import Promocion


@admin.register(Promocion)
class PromocionAdmin(ModelAdmin):
    list_display = (
        "nombre", "display_tipo", "display_valor",
        "display_vigencia", "usos", "display_activo",
    )
    list_filter = ("tipo", "activo", "colmado")
    search_fields = ("nombre", "codigo_cupon")
    readonly_fields = ("usos", "creado_en")

    fieldsets = (
        ("General", {
            "classes": ["tab"],
            "fields": ("colmado", "nombre", "descripcion", "tipo", "activo"),
        }),
        ("Valor del descuento", {
            "classes": ["tab"],
            "fields": ("valor", "cantidad_minima", "cantidad_paga", "precio_especial", "codigo_cupon"),
        }),
        ("Alcance y vigencia", {
            "classes": ["tab"],
            "fields": ("producto", "categoria", "fecha_inicio", "fecha_fin", "limite_usos"),
        }),
        ("Estadísticas", {
            "classes": ["tab"],
            "fields": ("usos", "creado_en"),
        }),
    )

    @display(description="Tipo", label={
        "PORCENTAJE": "info",
        "MONTO_FIJO": "primary",
        "2X1": "success",
        "PRECIO_ESPECIAL": "warning",
        "CUPON": "secondary",
    })
    def display_tipo(self, obj):
        return obj.tipo

    @display(description="Valor")
    def display_valor(self, obj):
        if obj.tipo == "PORCENTAJE":
            return format_html("<strong>{}%</strong>", obj.valor)
        if obj.tipo == "MONTO_FIJO":
            return format_html("<strong>-RD${}</strong>", f"{obj.valor:,.2f}")
        if obj.tipo == "2X1":
            return format_html(
                "Compra {} paga {}",
                obj.cantidad_minima or "?", obj.cantidad_paga or "?"
            )
        if obj.tipo == "PRECIO_ESPECIAL" and obj.precio_especial:
            return format_html("<strong>RD${}</strong>", f"{obj.precio_especial:,.2f}")
        return "—"

    @display(description="Vigencia")
    def display_vigencia(self, obj):
        hoy = timezone.now().date()
        inicio = obj.fecha_inicio
        fin = obj.fecha_fin
        if fin and fin < hoy:
            return format_html('<span class="unfold-badge unfold-badge-danger">Vencida</span>')
        if inicio and inicio > hoy:
            return format_html('<span class="unfold-badge unfold-badge-warning">Próximamente</span>')
        if fin:
            dias = (fin - hoy).days
            color = "success" if dias > 7 else "warning"
            return format_html(
                '<span class="unfold-badge unfold-badge-{}">Activa — {} días</span>', color, dias
            )
        return format_html('<span class="unfold-badge unfold-badge-success">Sin vencimiento</span>')

    @display(description="Activo", label={True: "success", False: "danger"}, boolean=True)
    def display_activo(self, obj):
        return obj.activo
