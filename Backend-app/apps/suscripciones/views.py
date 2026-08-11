from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Plan, Suscripcion, PagoSuscripcion
from .serializers import (
    PlanSerializer, SuscripcionSerializer, SuscripcionResumenSerializer,
    PagoSuscripcionSerializer, AjustarCapacidadSerializer,
)
from apps.dashboard.permissions import IsSuperadmin


class PlanViewSet(viewsets.ModelViewSet):
    """Planes de suscripción — solo SUPERADMIN."""
    serializer_class = PlanSerializer
    permission_classes = [IsSuperadmin]
    queryset = Plan.objects.all().order_by('precio_mensual')


class SuscripcionViewSet(viewsets.ModelViewSet):
    """
    Suscripciones:
    - SUPERADMIN: CRUD completo, ve todas.
    - ADMIN del colmado: solo lectura de su propia suscripción.
    """
    serializer_class = SuscripcionSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'mi_suscripcion'):
            return [IsAuthenticated()]
        return [IsSuperadmin()]

    def get_queryset(self):
        if self.request.user.is_superuser:
            qs = Suscripcion.objects.all().select_related('colmado', 'plan')
            estado = self.request.query_params.get('estado')
            if estado:
                qs = qs.filter(estado=estado)
            return qs
        # ADMIN solo puede ver la suscripción de su colmado
        return Suscripcion.objects.filter(colmado=self.request.user.colmado).select_related('plan')

    @action(detail=False, methods=['get'], url_path='mi-suscripcion',
            permission_classes=[IsAuthenticated])
    def mi_suscripcion(self, request):
        """Devuelve el estado de la suscripción del colmado del usuario autenticado."""
        try:
            suscripcion = Suscripcion.objects.select_related('plan').get(colmado=request.user.colmado)
            return Response(SuscripcionResumenSerializer(suscripcion).data)
        except Suscripcion.DoesNotExist:
            return Response({'detail': 'Este colmado no tiene suscripción registrada.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['patch'], url_path='cambiar-estado',
            permission_classes=[IsSuperadmin])
    def cambiar_estado(self, request, pk=None):
        suscripcion = self.get_object()
        nuevo_estado = request.data.get('estado')
        estados_validos = [e[0] for e in Suscripcion.ESTADOS]
        if nuevo_estado not in estados_validos:
            return Response(
                {'error': f'Estado inválido. Opciones: {", ".join(estados_validos)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        suscripcion.estado = nuevo_estado
        suscripcion.save(update_fields=['estado', 'actualizado_en'])
        return Response(SuscripcionSerializer(suscripcion).data)

    @action(detail=True, methods=['post'], url_path='ajustar-capacidad',
            permission_classes=[IsSuperadmin])
    def ajustar_capacidad(self, request, pk=None):
        """
        Ajusta los límites personalizados del colmado (max_productos, max_usuarios, precio_mensual).
        Valida que no se reduzca por debajo del uso actual.
        Registra el pago si se envía pago_monto.
        """
        from apps.inventario.models import Producto
        from apps.usuarios.models import Usuario
        from django.utils import timezone

        suscripcion = self.get_object()
        serializer = AjustarCapacidadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        colmado = suscripcion.colmado
        campos_actualizar = ['actualizado_en']

        nuevo_max_productos = data.get('max_productos')
        if nuevo_max_productos is not None:
            productos_activos = Producto.objects.filter(colmado=colmado, activo=True).count()
            if nuevo_max_productos < productos_activos:
                return Response(
                    {'error': f'No se puede reducir a {nuevo_max_productos} productos. '
                              f'El colmado tiene {productos_activos} productos activos. '
                              f'Debe eliminar al menos {productos_activos - nuevo_max_productos} primero.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            suscripcion.max_productos = nuevo_max_productos
            campos_actualizar.append('max_productos')

        nuevo_max_usuarios = data.get('max_usuarios')
        if nuevo_max_usuarios is not None:
            usuarios_activos = Usuario.objects.filter(colmado=colmado, is_active=True).count()
            if nuevo_max_usuarios < usuarios_activos:
                return Response(
                    {'error': f'No se puede reducir a {nuevo_max_usuarios} usuarios. '
                              f'El colmado tiene {usuarios_activos} usuarios activos. '
                              f'Debe desactivar al menos {usuarios_activos - nuevo_max_usuarios} primero.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            suscripcion.max_usuarios = nuevo_max_usuarios
            campos_actualizar.append('max_usuarios')

        nuevo_precio = data.get('precio_mensual')
        if nuevo_precio is not None:
            suscripcion.precio_mensual = nuevo_precio
            campos_actualizar.append('precio_mensual')

        suscripcion.save(update_fields=campos_actualizar)

        # Registrar pago si se envió
        if data.get('pago_monto'):
            PagoSuscripcion.objects.create(
                suscripcion=suscripcion,
                monto=data['pago_monto'],
                fecha=timezone.now().date(),
                metodo=data.get('pago_metodo', PagoSuscripcion.METODO_EFECTIVO),
                referencia=data.get('pago_referencia', ''),
                nota=data.get('nota', 'Pago por ajuste de capacidad'),
                registrado_por=request.user,
            )

        return Response(SuscripcionSerializer(suscripcion).data)

    @action(detail=True, methods=['post'], url_path='renovar',
            permission_classes=[IsSuperadmin])
    def renovar(self, request, pk=None):
        """Extiende la fecha de vencimiento en N días y registra el pago."""
        from datetime import timedelta
        suscripcion = self.get_object()
        dias = int(request.data.get('dias', 30))
        monto = request.data.get('monto', suscripcion.precio_pagado)
        metodo = request.data.get('metodo', PagoSuscripcion.METODO_EFECTIVO)
        referencia = request.data.get('referencia', '')
        nota = request.data.get('nota', f'Renovación {dias} días')

        from django.utils import timezone
        base = max(suscripcion.fecha_vencimiento, timezone.now().date())
        suscripcion.fecha_vencimiento = base + timedelta(days=dias)
        suscripcion.estado = Suscripcion.ESTADO_ACTIVA
        suscripcion.save(update_fields=['fecha_vencimiento', 'estado', 'actualizado_en'])

        PagoSuscripcion.objects.create(
            suscripcion=suscripcion,
            monto=monto,
            fecha=timezone.now().date(),
            metodo=metodo,
            referencia=referencia,
            nota=nota,
            registrado_por=request.user,
        )
        return Response(SuscripcionSerializer(suscripcion).data)


class PagoSuscripcionViewSet(viewsets.ModelViewSet):
    """Pagos de suscripción — solo SUPERADMIN."""
    serializer_class = PagoSuscripcionSerializer
    permission_classes = [IsSuperadmin]
    http_method_names = ['get', 'post']

    def get_queryset(self):
        qs = PagoSuscripcion.objects.all().select_related('suscripcion__colmado', 'registrado_por')
        suscripcion_id = self.request.query_params.get('suscripcion')
        if suscripcion_id:
            qs = qs.filter(suscripcion_id=suscripcion_id)
        colmado_id = self.request.query_params.get('colmado')
        if colmado_id:
            qs = qs.filter(suscripcion__colmado_id=colmado_id)
        return qs
