from django.apps import AppConfig


class HistorialPreciosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.historial_precios'
    verbose_name = 'Historial de Precios'

    def ready(self):
        import apps.historial_precios.signals  # noqa
