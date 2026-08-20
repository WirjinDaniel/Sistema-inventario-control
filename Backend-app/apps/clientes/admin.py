from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display
from .models import Cliente, AbonoFiado


class AbonoFiadoInline(TabularInline):
    model = AbonoFiado
    extra = 0
    tab = True
    fields = ("cajero", "monto", "nota", "fecha")
    readonly_fields = ("fecha",)


@admin.register(Cliente)
class ClienteAdmin(ModelAdmin):
    list_display = (
        "nombre", "telefono", "cedula",
        "display_credito", "display_deuda", "display_salud_credito", "display_activo",
    )
    list_filter = ("activo", "colmado")
    search_fields = ("nombre", "telefono", "cedula")
    readonly_fields = ("creado_en",)
    inlines = [AbonoFiadoInline]

    fieldsets = (
        ("Datos personales", {
            "classes": ["tab"],
            "fields": ("colmado", "nombre", "telefono", "cedula", "email", "direccion"),
        }),
        ("Crédito (Fiado)", {
            "classes": ["tab"],
            "fields": ("limite_credito", "saldo_deuda"),
        }),
        ("Estado", {
            "classes": ["tab"],
            "fields": ("activo", "creado_en"),
        }),
    )

    @display(description="Límite crédito")
    def display_credito(self, obj):
        return format_html("RD${}", f"{obj.limite_credito:,.2f}")

    @display(description="Deuda actual")
    def display_deuda(self, obj):
        if obj.saldo_deuda <= 0:
            return format_html('<span style="color:#6b7280">RD$0.00</span>')
        color = "#dc2626" if obj.saldo_deuda >= obj.limite_credito else "#d97706"
        return format_html('<strong style="color:{}">RD${}</strong>', color, f"{obj.saldo_deuda:,.2f}")

    @display(description="Crédito disponible")
    def display_salud_credito(self, obj):
        disponible = obj.limite_credito - obj.saldo_deuda
        if disponible <= 0:
            return format_html('<span class="unfold-badge unfold-badge-danger">Agotado</span>')
        pct = (disponible / obj.limite_credito * 100) if obj.limite_credito else 0
        color = "success" if pct > 50 else "warning"
        return format_html(
            '<span class="unfold-badge unfold-badge-{}">RD${} ({:.0f}%)</span>',
            color, f"{disponible:,.2f}", pct,
        )

    @display(description="Activo", label={True: "success", False: "danger"}, boolean=True)
    def display_activo(self, obj):
        return obj.activo


@admin.register(AbonoFiado)
class AbonoFiadoAdmin(ModelAdmin):
    list_display = ("cliente", "display_monto", "cajero", "fecha")
    list_filter = ("cliente__colmado",)
    search_fields = ("cliente__nombre",)
    readonly_fields = ("fecha",)
    date_hierarchy = "fecha"

    @display(description="Monto")
    def display_monto(self, obj):
        return format_html('<strong style="color:#16a34a">+RD${}</strong>', f"{obj.monto:,.2f}")

    def has_change_permission(self, request, obj=None):
        return False
