from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from unfold.admin import ModelAdmin
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm
from .models import Colmado, Usuario, AuditoriaLog


@admin.register(Colmado)
class ColmadoAdmin(ModelAdmin):
    list_display = ("nombre", "ruc", "telefono", "activo", "creado_en")
    list_filter = ("activo",)
    search_fields = ("nombre", "ruc")
    list_editable = ("activo",)


@admin.register(Usuario)
class UsuarioAdmin(ModelAdmin, UserAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm

    list_display = ("username", "nombre", "rol", "colmado", "is_active", "creado_en")
    list_filter = ("rol", "is_active", "colmado")
    search_fields = ("username", "nombre")
    ordering = ("nombre",)
    readonly_fields = ("creado_en",)

    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Información personal", {"fields": ("nombre", "rol", "colmado", "pin_caja")}),
        ("Permisos", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Fechas", {"fields": ("last_login", "creado_en")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("username", "nombre", "rol", "colmado", "password1", "password2"),
        }),
    )


@admin.register(AuditoriaLog)
class AuditoriaLogAdmin(ModelAdmin):
    list_display = ("accion", "modulo", "usuario", "colmado", "fecha", "ip")
    list_filter = ("accion", "modulo", "colmado")
    search_fields = ("descripcion", "usuario__nombre")
    readonly_fields = ("colmado", "usuario", "accion", "modulo", "objeto_id", "descripcion", "ip", "fecha", "extra")
    date_hierarchy = "fecha"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
