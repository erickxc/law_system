from pydantic import BaseModel
from typing import List
from uuid import UUID


class TaskCreate(BaseModel):
    description: str
    is_done: bool = False


class StudySessionCreate(BaseModel):
    subject_id: UUID
    duration_seconds: int = 0
    total_questions: int = 0
    correct_answers: int = 0
    tasks: List[TaskCreate] = []


class TaskResponse(BaseModel):
    id: UUID
    description: str
    is_done: bool

    class Config:
        from_attributes = True


class StudySessionResponse(BaseModel):
    id: UUID
    subject_id: UUID
    duration_seconds: int
    total_questions: int
    correct_answers: int
    tasks: List[TaskResponse] = []

    class Config:
        from_attributes = True
