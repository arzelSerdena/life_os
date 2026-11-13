"""Import every model here so Alembic autogenerate can see it through `Base.metadata`."""

from app.models.base import Base, BaseMixin
from app.models.event import Event, EventException
from app.models.life_area import LifeArea
from app.models.project import Project, ProjectSection
from app.models.status_change import StatusChange
from app.models.task import Subtask, Task
from app.models.task_template import TaskTemplate, TaskTemplateSubtask

__all__ = [
    "Base",
    "BaseMixin",
    "Event",
    "EventException",
    "LifeArea",
    "Project",
    "ProjectSection",
    "StatusChange",
    "Subtask",
    "Task",
    "TaskTemplate",
    "TaskTemplateSubtask",
]
