import { Client, Therapist, InsuranceQualification, Callout, GeneratedSchedule, ScheduleEntry, DayOfWeek, GAGenerationResult } from '../types';
import { timeToMinutes, isDateAffectedByCalloutRange } from '../utils/validationService';
import {
    COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END,
    STAFF_ASSUMED_AVAILABILITY_START, STAFF_ASSUMED_AVAILABILITY_END,
    LUNCH_COVERAGE_START_TIME, LUNCH_COVERAGE_END_TIME,
    IDEAL_LUNCH_WINDOW_START, IDEAL_LUNCH_WINDOW_END_FOR_START,
    DEFAULT_ROLE_RANK,
} from '../constants';

const SOLVER_URL = import.meta.env.VITE_SOLVER_URL;
const SOLVER_TIMEOUT_MS = 120_000; // 120s client timeout (solver may run two phases: 45s hard + 45s soft fallback)

interface SolveResponse {
    schedule: ScheduleEntry[];
    success: boolean;
    statusMessage: string;
    solveTimeSeconds: number;
    objectiveValue: number | null;
    coverageMode: string; // "hard" or "soft"
}

export async function solveWithCloudSolver(
    clients: Client[],
    therapists: Therapist[],
    insuranceQualifications: InsuranceQualification[],
    selectedDate: Date,
    day: DayOfWeek,
    callouts: Callout[],
    existingSchedule?: GeneratedSchedule
): Promise<GAGenerationResult | null> {
    if (!SOLVER_URL) return null;

    // Pre-compute other-day minutes per client for weekly-hours constraint
    const otherDayMinutesPerClient: Record<string, number> = {};
    if (existingSchedule) {
        clients.forEach(c => {
            otherDayMinutesPerClient[c.id] = existingSchedule
                .filter(e => e.clientId === c.id && e.day !== day &&
                    (e.sessionType === 'ABA' || e.sessionType.startsWith('AlliedHealth_')))
                .reduce((sum, e) => sum + (timeToMinutes(e.endTime) - timeToMinutes(e.startTime)), 0);
        });
    }

    // Filter callouts to those affecting the selected date
    const relevantCallouts = callouts.filter(co =>
        isDateAffectedByCalloutRange(selectedDate, co.startDate, co.endDate)
    );

    // Build initial schedule (same-day entries only) for optimize/warm-start mode
    const initialSchedule = existingSchedule
        ? existingSchedule.filter(e => e.day === day)
        : undefined;

    const requestBody = {
        clients,
        therapists,
        insuranceQualifications,
        selectedDate: selectedDate.toISOString().split('T')[0],
        day,
        callouts: relevantCallouts,
        otherDayMinutesPerClient,
        initialSchedule: initialSchedule || null,
        config: {
            operatingHoursStart: COMPANY_OPERATING_HOURS_START,
            operatingHoursEnd: COMPANY_OPERATING_HOURS_END,
            staffAvailabilityStart: STAFF_ASSUMED_AVAILABILITY_START,
            staffAvailabilityEnd: STAFF_ASSUMED_AVAILABILITY_END,
            lunchCoverageStart: LUNCH_COVERAGE_START_TIME,
            lunchCoverageEnd: LUNCH_COVERAGE_END_TIME,
            idealLunchWindowStart: IDEAL_LUNCH_WINDOW_START,
            idealLunchWindowEndForStart: IDEAL_LUNCH_WINDOW_END_FOR_START,
            defaultRoleRank: DEFAULT_ROLE_RANK,
            slotSizeMinutes: 15,
        },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOLVER_TIMEOUT_MS);

    try {
        const response = await fetch(`${SOLVER_URL}/solve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`Cloud solver returned ${response.status}`);
            return null;
        }

        const data: SolveResponse = await response.json();

        const coverageNote = data.coverageMode === 'soft' ? ' [soft coverage fallback]' : '';
        return {
            schedule: data.schedule,
            finalValidationErrors: [], // Will be re-validated client-side
            generations: 0,
            bestFitness: data.objectiveValue ?? 0,
            success: data.success,
            statusMessage: data.statusMessage + ` (Solved in ${data.solveTimeSeconds}s)${coverageNote}`,
        };
    } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof DOMException && err.name === 'AbortError') {
            console.warn('Cloud solver request timed out');
        } else {
            console.warn('Cloud solver request failed:', err);
        }
        return null;
    }
}
