from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import Usuario, Colmado, AuditoriaLog
from .serializers import UsuarioSerializer, UsuarioCreateSerializer, ColmadoSerializer, CustomTokenSerializer, AuditoriaLogSerializer


class CustomTokenView(TokenObtainPairView):
    serializer_class = CustomTokenSerializer


class ColmadoViewSet(viewsets.ModelViewSet):
    serializer_class = ColmadoSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = Colmado.objects.all()


class UsuarioViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return Usuario.objects.filter(colmado=self.request.user.colmado)

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return UsuarioCreateSerializer
        return UsuarioSerializer

    def get_permissions(self):
        if self.action in ('create', 'destroy', 'update', 'partial_update'):
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['get', 'patch'], url_path='colmado')
    def colmado(self, request):
        """Obtener o actualizar datos del colmado del usuario autenticado"""
        colmado = request.user.colmado
        if request.method == 'GET':
            serializer = ColmadoSerializer(colmado)
            return Response(serializer.data)
        elif request.method == 'PATCH':
            serializer = ColmadoSerializer(colmado, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AuditoriaLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditoriaLogSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['descripcion', 'usuario__nombre', 'modulo']
    ordering_fields = ['fecha']
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        qs = AuditoriaLog.objects.filter(colmado=self.request.user.colmado).select_related('usuario')
        accion = self.request.query_params.get('accion')
        modulo = self.request.query_params.get('modulo')
        usuario_id = self.request.query_params.get('usuario')
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if accion:
            qs = qs.filter(accion=accion)
        if modulo:
            qs = qs.filter(modulo=modulo)
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if fecha_desde:
            qs = qs.filter(fecha__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__date__lte=fecha_hasta)
        return qs
