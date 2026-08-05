from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import Usuario, Colmado, AuditoriaLog
from .serializers import UsuarioSerializer, UsuarioCreateSerializer, ColmadoSerializer, CustomTokenSerializer, AuditoriaLogSerializer
from .audit import log as audit_log
from apps.dashboard.permissions import IsSuperadmin, IsAdminOrSuperuser, IsAdminOfColmado

# Conjunto cerrado de permisos granulares permitidos en permisos_extra.
# Cualquier clave fuera de este set será rechazada por el endpoint /permisos/.
PERMISOS_VALIDOS = frozenset({
    # Reportes
    'ver_reportes',
    'exportar_reportes',
    # Ventas
    'ver_ventas',
    'anular_ventas',
    'aplicar_descuentos',
    # Clientes
    'ver_clientes',
    'crear_clientes',
    # Inventario
    'ver_productos',
    'editar_productos',
    'ajustar_inventario',
    # Compras
    'ver_compras',
    'crear_compras',
    # Finanzas / Caja
    'ver_gastos',
    'crear_gastos',
    'ver_caja',
    'cerrar_caja',
    # Devoluciones
    'ver_devoluciones',
    'crear_devoluciones',
})


class CustomTokenView(TokenObtainPairView):
    serializer_class = CustomTokenSerializer


class ColmadoViewSet(viewsets.ModelViewSet):
    serializer_class = ColmadoSerializer
    permission_classes = [IsSuperadmin]
    queryset = Colmado.objects.all().order_by('-creado_en')

    @action(detail=True, methods=['post'], url_path='toggle-activo')
    def toggle_activo(self, request, pk=None):
        colmado = self.get_object()
        colmado.activo = not colmado.activo
        colmado.save(update_fields=['activo'])
        return Response({'activo': colmado.activo})


class UsuarioViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        if self.request.user.is_superuser:
            qs = Usuario.objects.all().select_related('colmado')
            colmado_id = self.request.query_params.get('colmado')
            if colmado_id:
                qs = qs.filter(colmado_id=colmado_id)
            return qs
        return Usuario.objects.filter(colmado=self.request.user.colmado)

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return UsuarioCreateSerializer
        return UsuarioSerializer

    def get_permissions(self):
        if self.action in ('create', 'destroy', 'update', 'partial_update'):
            return [permissions.IsAuthenticated(), IsAdminOfColmado()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=['post'], url_path='toggle-activo',
            permission_classes=[IsAdminOfColmado])
    def toggle_activo(self, request, pk=None):
        usuario = self.get_object()
        # Nunca desactivar un SUPERADMIN
        if usuario.is_superuser:
            return Response(
                {'error': 'No puedes desactivar un superusuario.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        usuario.is_active = not usuario.is_active
        usuario.save(update_fields=['is_active'])
        accion_desc = 'activado' if usuario.is_active else 'desactivado'
        audit_log(
            request, AuditoriaLog.ACCION_EDITAR, 'usuarios',
            f'Usuario {usuario.username} {accion_desc}',
            objeto_id=usuario.pk,
        )
        return Response({'is_active': usuario.is_active})

    @action(detail=True, methods=['get', 'patch'], url_path='permisos',
            permission_classes=[IsAdminOfColmado])
    def permisos(self, request, pk=None):
        usuario = self.get_object()
        if request.method == 'GET':
            return Response(usuario.permisos_extra)

        # Validar que el body sea un dict
        if not isinstance(request.data, dict):
            return Response(
                {'error': 'Formato de permisos inválido. Se esperaba un objeto JSON.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Rechazar claves no reconocidas
        claves_invalidas = set(request.data.keys()) - PERMISOS_VALIDOS
        if claves_invalidas:
            return Response(
                {'error': f'Permisos no reconocidos: {", ".join(sorted(claves_invalidas))}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Todos los valores deben ser booleanos
        valores_invalidos = {k for k, v in request.data.items() if not isinstance(v, bool)}
        if valores_invalidos:
            return Response(
                {'error': f'Los siguientes permisos deben ser true o false: {", ".join(sorted(valores_invalidos))}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        usuario.permisos_extra = dict(request.data)
        usuario.save(update_fields=['permisos_extra'])
        audit_log(
            request, AuditoriaLog.ACCION_EDITAR, 'usuarios',
            f'Permisos actualizados para {usuario.username}',
            objeto_id=usuario.pk,
            extra={'permisos': dict(request.data)},
        )
        return Response(usuario.permisos_extra)

    @action(detail=True, methods=['post'], url_path='reset-password',
            permission_classes=[IsAdminOfColmado])
    def reset_password(self, request, pk=None):
        usuario = self.get_object()

        # Un no-superusuario nunca puede resetear la contraseña de un superusuario
        if usuario.is_superuser and not request.user.is_superuser:
            return Response(
                {'error': 'No puedes modificar la contraseña de un superusuario.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Un ADMIN solo puede resetear usuarios de su mismo colmado
        if not request.user.is_superuser and usuario.colmado != request.user.colmado:
            return Response(
                {'error': 'Solo puedes gestionar usuarios de tu colmado.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        password = request.data.get('password', '')
        if len(password) < 6:
            return Response(
                {'error': 'La contraseña debe tener al menos 6 caracteres.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        usuario.set_password(password)
        usuario.save(update_fields=['password'])
        audit_log(
            request, AuditoriaLog.ACCION_EDITAR, 'usuarios',
            f'Restablecimiento de contraseña para {usuario.username}',
            objeto_id=usuario.pk,
        )
        return Response({'ok': True})

    @action(detail=False, methods=['get', 'patch'], url_path='colmado')
    def colmado(self, request):
        """Obtener o actualizar datos del colmado del usuario autenticado."""
        colmado = request.user.colmado
        if request.method == 'GET':
            serializer = ColmadoSerializer(colmado)
            return Response(serializer.data)

        # Solo el ADMIN del colmado (o SUPERADMIN) puede modificar la configuración
        if not request.user.is_superuser and request.user.rol != Usuario.ROL_ADMIN:
            return Response(
                {'error': 'Solo el administrador puede modificar la configuración del negocio.'},
                status=status.HTTP_403_FORBIDDEN,
            )
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
    permission_classes = [IsAdminOfColmado]

    def get_queryset(self):
        if self.request.user.is_superuser:
            qs = AuditoriaLog.objects.all().select_related('usuario', 'colmado')
            colmado_id = self.request.query_params.get('colmado')
            if colmado_id:
                qs = qs.filter(colmado_id=colmado_id)
        else:
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
