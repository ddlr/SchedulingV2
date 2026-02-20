"""Pydantic models mirroring the TypeScript types for the scheduling solver."""

from pydantic import BaseModel
from typing import Optional


class AlliedHealthNeed(BaseModel):
    type: str  # "OT" | "SLP"
    specificDays: list[str]
    startTime: str  # "HH:MM"
    endTime: str
    preferredProviderId: Optional[str] = None


class InsuranceQualification(BaseModel):
    id: str
    maxTherapistsPerDay: Optional[int] = None
    minSessionDurationMinutes: Optional[int] = None
    maxSessionDurationMinutes: Optional[int] = None
    maxHoursPerWeek: Optional[float] = None
    roleHierarchyOrder: Optional[int] = None


class Client(BaseModel):
    id: str
    name: str
    teamId: Optional[str] = None
    insuranceRequirements: list[str]
    alliedHealthNeeds: list[AlliedHealthNeed]


class Therapist(BaseModel):
    id: str
    name: str
    role: str
    teamId: Optional[str] = None
    qualifications: list[str]


class Callout(BaseModel):
    id: str
    entityType: str  # "client" | "therapist"
    entityId: str
    entityName: str
    startDate: str  # "YYYY-MM-DD"
    endDate: str
    startTime: str  # "HH:MM"
    endTime: str
    reason: Optional[str] = None


class ScheduleEntry(BaseModel):
    id: str
    clientName: Optional[str] = None
    clientId: Optional[str] = None
    therapistName: Optional[str] = None
    therapistId: Optional[str] = None
    day: str
    startTime: str
    endTime: str
    sessionType: str


class SolverConfig(BaseModel):
    operatingHoursStart: str  # "09:00"
    operatingHoursEnd: str  # "17:00"
    staffAvailabilityStart: str  # "08:45"
    staffAvailabilityEnd: str  # "17:15"
    lunchCoverageStart: str  # "11:00"
    lunchCoverageEnd: str  # "14:00"
    idealLunchWindowStart: str  # "11:00"
    idealLunchWindowEndForStart: str  # "13:30"
    defaultRoleRank: dict[str, int]
    slotSizeMinutes: int  # 15


class SolveRequest(BaseModel):
    clients: list[Client]
    therapists: list[Therapist]
    insuranceQualifications: list[InsuranceQualification]
    selectedDate: str  # "YYYY-MM-DD"
    day: str  # DayOfWeek enum value, e.g., "Monday"
    callouts: list[Callout]
    otherDayMinutesPerClient: dict[str, int]  # client_id -> minutes on other days
    initialSchedule: Optional[list[ScheduleEntry]] = None
    config: SolverConfig


class SolveResponse(BaseModel):
    schedule: list[ScheduleEntry]
    success: bool
    statusMessage: str
    solveTimeSeconds: float = 0.0
    objectiveValue: Optional[int] = None
    coverageMode: str = "hard"  # "hard" = full coverage enforced, "soft" = coverage gaps possible
