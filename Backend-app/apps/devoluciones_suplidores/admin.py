from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline
from .models import DevolucionSuplidor, DevolucionSuplidorItem


class DevolucionSuplidorItemInline(TabularInline):
    model = DevolucionSuplidorItem
    extra = 0
    fields = ('producto', 'cantidad', 'precio_unitario', 'motivo_item')
    readonly_fields = ('producto',)


@admin.register(DevolucionSuplidor)
class DevolucionSuplidorAdmin(ModelAdmin):
    list_display = ('pk', 'suplidor', 'orden_compra', 'monto_credito', 'estado', 'fecha')
    list_filter = ('estado', 'colmado')
    search_fields = ('suplidor__nombre', 'motivo')
    readonly_fields = ('fecha', 'colmado', 'usuario', 'monto_credito')
    date_hierarchy = 'fecha'
    inlines = [DevolucionSuplidorItemInline]

    def has_add_permission(self, request):
        return False
