from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from unfold.decorators import display
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm
from .models import Colmado, Usuario, AuditoriaLog, LoginAttempt


@admin.register(Colmado)
class ColmadoAdmin(ModelAdmin):
    list_display = ("nombre", "ruc", "telefono", "display_activo", "creado_en")
    list_filter = ("activo",)
    search_fields = ("nombre", "ruc")

    fieldsets = (
        ("Datos del negocio", {
            "classes": ["tab"],
            "fields": ("nombre", "ruc", "telefono", "direccion"),
        }),
        ("Estado", {
            "classes": ["tab"],
            "fields": ("activo", "creado_en"),
        }),
        ("Configuración avanzada", {
            "classes": ["tab"],
            "fields": ("config_json",),
        }),
    )
    readonly_fields = ("creado_en",)

    @display(description="Activo", label={True: "success", False: "danger"}, boolean=True)
    def display_activo(self, obj):
        return obj.activo


@admin.register(Usuario)
class UsuarioAdmin(ModelAdmin, UserAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm

    list_display = (
        "username", "nombre", "display_rol",
        "colmado", "display_activo", "display_seguridad", "creado_en",
    )
    list_filter = ("rol", "is_active", "colmado")
    search_fields = ("username", "nombre")
    ordering = ("nombre",)
    readonly_fields = ("creado_en", "ultimo_acceso", "intentos_fallidos", "bloqueado_hasta")

    fieldsets = (
        ("Credenciales", {
            "classes": ["tab"],
            "fields": ("username", "password"),
        }),
        ("Información personal", {
            "classes": ["tab"],
            "fields": ("nombre", "rol", "colmado", "pin_caja"),
        }),
        ("Permisos del sistema", {
            "classes": ["tab"],
            "fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions"),
        }),
        ("Permisos extra", {
            "classes": ["tab"],
            "fields": ("permisos_extra",),
        }),
        ("Seguridad y acceso", {
            "classes": ["tab"],
            "fields": ("ultimo_acceso", "debe_cambiar_password", "intentos_fallidos", "bloqueado_hasta", "creado_en"),
        }),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("username", "nombre", "rol", "colmado", "password1", "password2"),
        }),
    )

    @display(description="Rol", label={
        "ADMIN": "success",
        "CAJERO": "info",
        "INVENTARIO": "warning",
    })
    def display_rol(self, obj):
        return obj.rol

    @display(description="Activo", label={True: "success", False: "danger"}, boolean=True)
    def display_activo(self, obj):
        return obj.is_active

    @display(description="Seguridad")
    def display_seguridad(self, obj):
        if obj.esta_bloqueado:
            return format_html('<span class="unfold-badge unfold-badge-danger">Bloqueado</span>')
        if obj.intentos_fallidos > 0:
            return format_html(
                '<span class="unfold-badge unfold-badge-warning">{} intento(s)</span>',
                obj.intentos_fallidos,
            )
        return format_html('<span class="unfold-badge unfold-badge-success">OK</span>')


@admin.register(AuditoriaLog)
class AuditoriaLogAdmin(ModelAdmin):
    list_display = ("display_accion", "modulo", "usuario", "colmado", "descripcion_corta", "fecha", "ip")
    list_filter = ("accion", "modulo", "colmado")
    search_fields = ("descripcion", "usuario__nombre")
    readonly_fields = (
        "colmado", "usuario", "accion", "modulo", "objeto_id",
        "descripcion", "ip", "user_agent", "fecha",
        "valor_anterior", "valor_nuevo", "extra",
    )
    date_hierarchy = "fecha"

    fieldsets = (
        ("Evento", {
            "classes": ["tab"],
            "fields": ("colmado", "usuario", "accion", "modulo", "objeto_id", "fecha", "ip", "user_agent"),
        }),
        ("Detalle", {
            "classes": ["tab"],
            "fields": ("descripcion", "valor_anterior", "valor_nuevo", "extra"),
        }),
    )

    @display(description="Acción", label={
        "CREAR": "success",
        "EDITAR": "info",
        "ELIMINAR": "danger",
        "VENTA": "primary",
        "ANULAR": "danger",
        "ABONO": "success",
        "COMPRA": "warning",
        "AJUSTE": "warning",
        "LOGIN": "info",
        "LOGOUT": "secondary",
        "CAJA": "primary",
        "CONFIG": "secondary",
        "PRECIO": "warning",
        "LOGIN_FAIL": "danger",
    })
    def display_accion(self, obj):
        return obj.accion

    @display(description="Descripción")
    def descripcion_corta(self, obj):
        texto = obj.descripcion[:70]
        if len(obj.descripcion) > 70:
            texto += "…"
        return texto

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(LoginAttempt)
class LoginAttemptAdmin(ModelAdmin):
    list_display = ("username", "ip", "display_resultado", "user_agent_corto", "fecha")
    list_filter = ("exitoso",)
    search_fields = ("username", "ip")
    readonly_fields = ("username", "ip", "exitoso", "fecha", "user_agent")
    date_hierarchy = "fecha"

    @display(description="Resultado", label={True: "success", False: "danger"})
    def display_resultado(self, obj):
        return obj.exitoso

    @display(description="User Agent")
    def user_agent_corto(self, obj):
        return (obj.user_agent[:50] + "…") if len(obj.user_agent) > 50 else obj.user_agent

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
