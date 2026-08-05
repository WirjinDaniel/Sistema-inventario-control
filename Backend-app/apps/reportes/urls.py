from django.urls import path
from .views import (
    ResumenVentasView,
    TendenciaDiariaView,
    AnalisisABCView,
    ExportarVentasCSVView,
    StockBajoReporteView,
    CuentasPorCobrarReporteView,
)

urlpatterns = [
    path('resumen/', ResumenVentasView.as_view(), name='reporte-resumen'),
    path('tendencia-diaria/', TendenciaDiariaView.as_view(), name='reporte-tendencia'),
    path('abc/', AnalisisABCView.as_view(), name='reporte-abc'),
    path('exportar-csv/', ExportarVentasCSVView.as_view(), name='reporte-csv'),
    path('stock-bajo/', StockBajoReporteView.as_view(), name='reporte-stock-bajo'),
    path('cuentas-por-cobrar/', CuentasPorCobrarReporteView.as_view(), name='reporte-cxc'),
]
