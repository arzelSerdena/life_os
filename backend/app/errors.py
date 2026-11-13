class NotFoundError(Exception):
    """The requested item doesn't exist. Returned to the client as a 404."""


class ConflictError(Exception):
    """The request can't be applied in the item's current state. Returned as a 409."""


class UnprocessableError(Exception):
    """The request refers to something invalid, such as a missing project. Returned as a 422."""
