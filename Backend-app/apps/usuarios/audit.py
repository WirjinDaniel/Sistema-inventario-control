import logging
from .models import AuditoriaLog

logger = logging.getLogger(__name__)


def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def get_user_agent(request):
    return request.META.get('HTTP_USER_AGENT', '')[:500]


def log(
    request,
    accion,
    modulo,
    descripcion,
    objeto_id=None,
    extra=None,
    valor_anterior=None,
    valor_nuevo=None,
):
    """Registra un evento de auditoría. Silencioso ante errores para no interrumpir el flujo."""
    try:
        AuditoriaLog.objects.create(
            colmado=getattr(request.user, 'colmado', None),
            usuario=request.user if request.user.is_authenticated else None,
            accion=accion,
            modulo=modulo,
            objeto_id=objeto_id,
            descripcion=descripcion,
            ip=get_client_ip(request),
            user_agent=get_user_agent(request),
            valor_anterior=valor_anterior,
            valor_nuevo=valor_nuevo,
            extra=extra or {},
        )
    except Exception as e:
        logger.error("audit.log falló: %s", e, exc_info=True)


def log_anonimo(request, accion, modulo, descripcion, extra=None):
    """Registra eventos de usuarios no autenticados (ej. login fallido)."""
    try:
        AuditoriaLog.objects.create(
            colmado=None,
            usuario=None,
            accion=accion,
            modulo=modulo,
            descripcion=descripcion,
            ip=get_client_ip(request),
            user_agent=get_user_agent(request),
            extra=extra or {},
        )
    except Exception as e:
        logger.error("audit.log_anonimo falló: %s", e, exc_info=True)
