import re
from django.core.exceptions import ValidationError


class PasswordComplejidadValidator:
    """
    Exige al menos 8 caracteres, 1 mayúscula, 1 número y 1 símbolo especial.
    Equilibra seguridad con usabilidad en un entorno de colmado.
    """

    def validate(self, password, user=None):
        errores = []

        if len(password) < 8:
            errores.append('Debe tener al menos 8 caracteres.')

        if not re.search(r'[A-Z]', password):
            errores.append('Debe contener al menos una letra mayúscula.')

        if not re.search(r'\d', password):
            errores.append('Debe contener al menos un número.')

        if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;\'\/]', password):
            errores.append('Debe contener al menos un símbolo especial (!@#$%^&* etc.).')

        if errores:
            raise ValidationError(errores)

    def get_help_text(self):
        return (
            'La contraseña debe tener mínimo 8 caracteres, '
            'una mayúscula, un número y un símbolo especial.'
        )
