from rest_framework.routers import DefaultRouter
from rest_framework.urlpatterns import format_suffix_patterns
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import UsuarioViewSet, ColmadoViewSet, CustomTokenView, AuditoriaLogViewSet

router = DefaultRouter()
router.register('colmados', ColmadoViewSet, basename='colmado')
router.register('auditoria', AuditoriaLogViewSet, basename='auditoria')
router.register('', UsuarioViewSet, basename='usuario')

urlpatterns = router.urls
