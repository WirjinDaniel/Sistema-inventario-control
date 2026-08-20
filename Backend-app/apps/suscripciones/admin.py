from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display
from .models import Plan, Suscripcion, PagoSuscripcion


class PagoSuscripcionInline(TabularInline):
    model = PagoSuscripcion
    extra = 0
    tab = True
    fields = ("fecha", "monto", "metodo", "referencia", "registrado_por")
    readonly_fields = ("registrado_por",)


@admin.register(Plan)
class PlanAdmin(ModelAdmin):
    list_display = (
        "nombre", "display_precio", "max_usuarios",
        "max_productos", "display_activo", "creado_en",
    )
    list_filter = ("activo",)
    search_fields = ("nombre",)
    readonly_fields = ("creado_en",)

    fieldsets = (
        ("Plan", {
            "classes": ["tab"],
            "fields": ("nombre", "precio_mensual", "descripcion", "activo"),
        }),
        ("Límites de uso", {
            "classes": ["tab"],
            "fields": ("max_usuarios", "max_productos"),
        }),
        ("Registro", {
            "classes": ["tab"],
            "fields": ("creado_en",),
        }),
    )

    @display(description="Precio/mes")
    def display_precio(self, obj):
        return format_html("<strong>RD${}</strong>", f"{obj.precio_mensual:,.2f}")

    @display(description="Activo", label={True: "success", False: "danger"}, boolean=True)
    def display_activo(self, obj):
        return obj.activo


@admin.register(Suscripcion)
class SuscripcionAdmin(ModelAdmin):
    list_display = (
        "colmado", "plan", "display_estado",
        "fecha_inicio", "fecha_vencimiento",
        "display_precio_pagado", "display_dias_restantes",
    )
    list_filter = ("estado", "plan")
    search_fields = ("colmado__nombre",)
    readonly_fields = ("creado_en", "actualizado_en", "esta_activa")
    date_hierarchy = "fecha_vencimiento"
    inlines = [PagoSuscripcionInline]

    fieldsets = (
        ("Suscripción", {
            "classes": ["tab"],
            "fields": ("colmado", "plan", "estado"),
        }),
        ("Vigencia", {
            "classes": ["tab"],
            "fields": ("fecha_inicio", "fecha_vencimiento", "esta_activa"),
        }),
        ("Precios", {
            "classes": ["tab"],
            "fields": ("precio_mensual", "precio_pagado"),
        }),
        ("Límites personalizados", {
            "classes": ["tab"],
            "fields": ("max_usuarios", "max_productos"),
        }),
        ("Notas", {
            "classes": ["tab"],
            "fields": ("nota", "creado_en", "actualizado_en"),
        }),
    )

    @display(description="Estado", label={
        "ACTIVA": "success",
        "VENCIDA": "danger",
        "SUSPENDIDA": "warning",
        "TRIAL": "info",
        "CANCELADA": "secondary",
    })
    def display_estado(self, obj):
        return obj.estado

    @display(description="Precio pagado")
    def display_precio_pagado(self, obj):
        return format_html("RD${}", f"{obj.precio_pagado:,.2f}")

    @display(description="Días restantes")
    def display_dias_restantes(self, obj):
        dias = obj.dias_restantes
        if dias is None:
            return "—"
        if dias < 0:
            return format_html('<span class="unfold-badge unfold-badge-danger">Vencida</span>')
        if dias <= 7:
            return format_html('<span class="unfold-badge unfold-badge-warning">{} días</span>', dias)
        return format_html('<span class="unfold-badge unfold-badge-success">{} días</span>', dias)


@admin.register(PagoSuscripcion)
class PagoSuscripcionAdmin(ModelAdmin):
    list_display = ("suscripcion", "fecha", "display_monto", "display_metodo", "referencia", "registrado_por")
    list_filter = ("metodo", "suscripcion__plan")
    search_fields = ("suscripcion__colmado__nombre", "referencia")
    readonly_fields = ("creado_en",)
    date_hierarchy = "fecha"

    fieldsets = (
        ("Pago", {
            "classes": ["tab"],
            "fields": ("suscripcion", "fecha", "monto", "metodo"),
        }),
        ("Detalle", {
            "classes": ["tab"],
            "fields": ("referencia", "nota", "registrado_por", "creado_en"),
        }),
    )

    @display(description="Monto")
    def display_monto(self, obj):
        return format_html('<strong style="color:#16a34a">RD${}</strong>', f"{obj.monto:,.2f}")

    @display(description="Método", label={
        "EFECTIVO": "success",
        "TRANSFERENCIA": "primary",
        "TARJETA": "info",
        "CHEQUE": "secondary",
    })
    def display_metodo(self, obj):
        return obj.metodo
