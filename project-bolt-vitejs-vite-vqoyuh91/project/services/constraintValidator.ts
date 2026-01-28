import { ScheduleEntry, GeneratedSchedule, Client, Therapist, Callout, DayOfWeek } from '../types';
import { timeToMinutes, minutesToTime, sessionsOverlap, isDateAffectedByCalloutRange } from '../utils/validationService';
import { COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END } from '../constants';

export interface ConstraintViolation {
  type: 'hard' | 'soft';
  severity: number;
  message: string;
}

export function hasTherapistConflict(
  schedule: GeneratedSchedule,
  entry: ScheduleEntry,
  ignoreEntryId?: string
): boolean {
  return schedule.some(s =>
    s.id !== ignoreEntryId &&
    s.therapistId === entry.therapistId &&
    s.day === entry.day &&
    sessionsOverlap(s.startTime, s.endTime, entry.startTime, entry.endTime)
  );
}

export function hasClientConflict(
  schedule: GeneratedSchedule,
  entry: ScheduleEntry,
  ignoreEntryId?: string
): boolean {
  if (!entry.clientId) return false;
  return schedule.some(s =>
    s.id !== ignoreEntryId &&
    s.clientId === entry.clientId &&
    s.day === entry.day &&
    sessionsOverlap(s.startTime, s.endTime, entry.startTime, entry.endTime)
  );
}

export function hasCalloutConflict(
  entry: ScheduleEntry,
  callouts: Callout[],
  selectedDate: Date
): boolean {
  return callouts.some(co =>
    isDateAffectedByCalloutRange(selectedDate, co.startDate, co.endDate) &&
    ((co.entityType === 'therapist' && co.entityId === entry.therapistId) ||
     (co.entityType === 'client' && co.entityId === entry.clientId)) &&
    sessionsOverlap(entry.startTime, entry.endTime, co.startTime, co.endTime)
  );
}

export function hasCredentialMismatch(
  entry: ScheduleEntry,
  clients: Client[],
  therapists: Therapist[]
): boolean {
  if (!entry.clientId) return false;
  const client = clients.find(c => c.id === entry.clientId);
  const therapist = therapists.find(t => t.id === entry.therapistId);
  if (!client || !therapist) return false;
  return !client.insuranceRequirements.every(req => therapist.qualifications.includes(req));
}

export function hasAlliedHealthQualificationMismatch(
  entry: ScheduleEntry,
  therapists: Therapist[]
): boolean {
  if (!entry.sessionType.startsWith('AlliedHealth_')) return false;
  const therapist = therapists.find(t => t.id === entry.therapistId);
  if (!therapist) return false;
  const serviceType = entry.sessionType === 'AlliedHealth_OT' ? 'OT' : 'SLP';
  return !therapist.canProvideAlliedHealth.includes(serviceType);
}

export function isSessionDurationValid(entry: ScheduleEntry): boolean {
  const duration = timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime);
  if (entry.sessionType === 'ABA') {
    return duration >= 60 && duration <= 180;
  } else if (entry.sessionType === 'IndirectTime') {
    return duration === 30;
  } else if (entry.sessionType.startsWith('AlliedHealth_')) {
    return duration > 0;
  }
  return true;
}

export function isWithinOperatingHours(entry: ScheduleEntry): boolean {
  if (entry.sessionType === 'IndirectTime') return true;
  const opStart = timeToMinutes(COMPANY_OPERATING_HOURS_START);
  const opEnd = timeToMinutes(COMPANY_OPERATING_HOURS_END);
  const entryStart = timeToMinutes(entry.startTime);
  const entryEnd = timeToMinutes(entry.endTime);
  return entryStart >= opStart && entryEnd <= opEnd;
}

export function canAddEntryToSchedule(
  entry: ScheduleEntry,
  schedule: GeneratedSchedule,
  clients: Client[],
  therapists: Therapist[],
  selectedDate: Date,
  callouts: Callout[],
  ignoreEntryId?: string
): { valid: boolean; violations: ConstraintViolation[] } {
  const violations: ConstraintViolation[] = [];

  if (hasTherapistConflict(schedule, entry, ignoreEntryId)) {
    violations.push({
      type: 'hard',
      severity: 100,
      message: `Therapist ${entry.therapistName} has time conflict`
    });
  }

  if (hasClientConflict(schedule, entry, ignoreEntryId)) {
    violations.push({
      type: 'hard',
      severity: 100,
      message: `Client has time conflict`
    });
  }

  if (hasCalloutConflict(entry, callouts, selectedDate)) {
    violations.push({
      type: 'hard',
      severity: 110,
      message: `Entry conflicts with callout`
    });
  }

  if (!isSessionDurationValid(entry)) {
    violations.push({
      type: 'hard',
      severity: 100,
      message: `Session duration is invalid`
    });
  }

  if (!isWithinOperatingHours(entry)) {
    violations.push({
      type: 'hard',
      severity: 90,
      message: `Session outside operating hours`
    });
  }

  if (hasCredentialMismatch(entry, clients, therapists)) {
    violations.push({
      type: 'hard',
      severity: 100,
      message: `Therapist credential mismatch`
    });
  }

  if (hasAlliedHealthQualificationMismatch(entry, therapists)) {
    violations.push({
      type: 'hard',
      severity: 100,
      message: `Allied health qualification missing`
    });
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

export function getMdMedicaidTherapistCount(
  schedule: GeneratedSchedule,
  clientId: string
): number {
  const clientSessions = schedule.filter(s => s.clientId === clientId);
  return new Set(clientSessions.map(s => s.therapistId)).size;
}

export function therapistHasLunch(schedule: GeneratedSchedule, therapistId: string): boolean {
  return schedule.some(s => s.therapistId === therapistId && s.sessionType === 'IndirectTime');
}

export function therapistHasDirectClientTime(
  schedule: GeneratedSchedule,
  therapistId: string
): boolean {
  return schedule.some(
    s => s.therapistId === therapistId &&
    s.sessionType !== 'IndirectTime' &&
    s.clientId !== null
  );
}

export function getClientCoverageGaps(
  schedule: GeneratedSchedule,
  clientId: string,
  callouts: Callout[],
  selectedDate: Date,
  startTime: string = COMPANY_OPERATING_HOURS_START,
  endTime: string = COMPANY_OPERATING_HOURS_END
): { start: number; end: number }[] {
  const gaps: { start: number; end: number }[] = [];
  const opStart = timeToMinutes(startTime);
  const opEnd = timeToMinutes(endTime);

  const clientCallouts = callouts
    .filter(co =>
      co.entityType === 'client' &&
      co.entityId === clientId &&
      isDateAffectedByCalloutRange(selectedDate, co.startDate, co.endDate)
    )
    .map(co => ({
      start: timeToMinutes(co.startTime),
      end: timeToMinutes(co.endTime)
    }))
    .sort((a, b) => a.start - b.start);

  const clientSessions = schedule
    .filter(s => s.clientId === clientId && s.sessionType === 'ABA')
    .map(s => ({
      start: timeToMinutes(s.startTime),
      end: timeToMinutes(s.endTime)
    }))
    .sort((a, b) => a.start - b.start);

  let currentTime = opStart;
  let calloutIdx = 0;
  let sessionIdx = 0;

  while (currentTime < opEnd) {
    const nextCallout = calloutIdx < clientCallouts.length ? clientCallouts[calloutIdx] : null;
    const nextSession = sessionIdx < clientSessions.length ? clientSessions[sessionIdx] : null;

    if (nextCallout && nextCallout.start <= currentTime) {
      currentTime = nextCallout.end;
      calloutIdx++;
    } else if (nextSession && nextSession.start <= currentTime) {
      currentTime = nextSession.end;
      sessionIdx++;
    } else {
      const nextEvent = Math.min(
        nextCallout?.start ?? opEnd,
        nextSession?.start ?? opEnd,
        opEnd
      );
      if (nextEvent > currentTime) {
        gaps.push({ start: currentTime, end: nextEvent });
      }
      currentTime = nextEvent;
    }
  }

  return gaps;
}
