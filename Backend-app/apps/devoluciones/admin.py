from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline
from .models import Devolucion, DevolucionItem


class DevolucionItemInline(TabularInline):
    model = DevolucionItem
    extra = 0
    fields = ('venta_item', 'cantidad', 'precio_unitario')
    readonly_fields = ('venta_item',)


@admin.register(Devolucion)
class DevolucionAdmin(ModelAdmin):
    list_display = ('pk', 'venta', 'cliente', 'cajero', 'monto_devuelto', 'metodo_devolucion', 'estado', 'fecha')
    list_filter = ('estado', 'metodo_devolucion', 'colmado')
    search_fields = ('cliente__nombre', 'motivo', 'venta__id')
    readonly_fields = ('fecha', 'monto_devuelto', 'colmado', 'cajero')
    date_hierarchy = 'fecha'
    inlines = [DevolucionItemInline]

    def has_add_permission(self, request):
        return False
