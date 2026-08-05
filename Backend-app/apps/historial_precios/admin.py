from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import HistorialPrecio


@admin.register(HistorialPrecio)
class HistorialPrecioAdmin(ModelAdmin):
    list_display = ('producto', 'campo', 'valor_anterior', 'valor_nuevo', 'usuario', 'fecha')
    list_filter = ('campo', 'colmado')
    search_fields = ('producto__nombre', 'usuario__nombre')
    readonly_fields = ('fecha', 'colmado', 'producto', 'campo', 'valor_anterior', 'valor_nuevo', 'usuario')
    date_hierarchy = 'fecha'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
