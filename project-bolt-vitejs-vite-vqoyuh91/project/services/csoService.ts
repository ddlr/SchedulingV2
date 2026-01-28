import { Client, Therapist, GeneratedSchedule, DayOfWeek, Callout, GAGenerationResult, ScheduleEntry, SessionType, BaseScheduleConfig, AlliedHealthNeed } from '../types';
import { COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, IDEAL_LUNCH_WINDOW_START, IDEAL_LUNCH_WINDOW_END_FOR_START, LUNCH_COVERAGE_START_TIME, LUNCH_COVERAGE_END_TIME } from '../constants';
import { validateFullSchedule, timeToMinutes, minutesToTime, sessionsOverlap, isDateAffectedByCalloutRange } from '../utils/validationService';
import * as baseScheduleService from './baseScheduleService';
import { ScheduleLearningService } from './scheduleLearningService';
import {
  canAddEntryToSchedule,
  getClientCoverageGaps,
  isWithinOperatingHours,
  isSessionDurationValid
} from './constraintValidator';

// --- GA Configuration ---
const POPULATION_SIZE = 60;       // Increased population for better diversity
const MAX_GENERATIONS = 500;      // Significantly increased to allow for multiple "restarts"
const ELITISM_RATE = 0.05;        // Keep only top 5% to allow fresh blood
const CROSSOVER_RATE = 0.8;
const MUTATION_RATE = 0.6;        // High mutation rate because we use "smart" mutations
const RESTART_THRESHOLD = 40;     // If no improvement for 40 gens, trigger a restart (Micro-GA)

// --- Helper Functions ---
const generateId = () => `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const getDayOfWeekFromDate = (date: Date): DayOfWeek => {
    const days: DayOfWeek[] = [DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY];
    return days[date.getDay()];
};
const getTherapistById = (therapists: Therapist[], id: string) => therapists.find(t => t.id === id);
const getClientById = (clients: Client[], id: string) => clients.find(c => c.id === id);
const cloneSchedule = (schedule: GeneratedSchedule): GeneratedSchedule => structuredClone(schedule);

// --- Learning Context ---
export interface LearningContext {
    topRatedSchedules: GeneratedSchedule[];
    learnedLunchTimes: Array<{ therapistId: string; startTime: string; endTime: string }>;
    violationPenalties: Record<string, number>;
}

// Kept for type compatibility but unused inside runCsoAlgorithm now
async function loadLearningContext(): Promise<LearningContext> {
    try {
        const topRatedSchedules = await ScheduleLearningService.getHighRatedSchedules();
        const learnedLunchTimes = topRatedSchedules
            .flatMap(s => s.filter(e => e.sessionType === 'IndirectTime'))
            .map(e => ({ therapistId: e.therapistId, startTime: e.startTime, endTime: e.endTime }));
        
        return { topRatedSchedules, learnedLunchTimes, violationPenalties: {} };
    } catch (error) {
        console.warn("Failed to load learning context, using defaults.", error);
        return { topRatedSchedules: [], learnedLunchTimes: [], violationPenalties: {} };
    }
}

// --- Adaptive Penalty Calculation ---
function calculateAdaptivePenalties(clients: Client[], therapists: Therapist[], schedule: GeneratedSchedule) {
    const numClients = clients.length;
    const numTherapists = therapists.length;
    const scaleFactor = Math.max(1, Math.log2(numClients * numTherapists));
    
    return {
        CONFLICT_PENALTY: 5000 * scaleFactor,
        CREDENTIAL_MISMATCH_PENALTY: 4000 * scaleFactor,
        CALLOUT_OVERLAP_PENALTY: 4500 * scaleFactor,
        CLIENT_COVERAGE_GAP_PENALTY: 2000 * scaleFactor * (numClients / 10),
        MISSING_LUNCH_PENALTY: 2500 * scaleFactor,
        LUNCH_STAGGER_PENALTY: 1500 * scaleFactor, // Increased penalty for non-staggered lunches
        SESSION_DURATION_PENALTY: 1000 * scaleFactor,
        MD_MEDICAID_LIMIT_PENALTY: 2000 * scaleFactor,
        BCBA_DIRECT_TIME_PENALTY: 500,
        UNMET_AH_NEED_PENALTY: 300,
        BASE_SCHEDULE_DEVIATION_PENALTY: 50,
        TEAM_ALIGNMENT_PENALTY: 100,
        MAX_NOTES_PENALTY: 50,
        LUNCH_OUTSIDE_WINDOW_PENALTY: 200,
        SCHEDULE_FRAGMENTATION_PENALTY: 10,
        SAME_CLIENT_BACK_TO_BACK_PENALTY: 6000 * scaleFactor
    };
}

// --- Availability Tracker ---
class AvailabilityTracker {
    private therapistMasks: Map<string, bigint>;
    private clientMasks: Map<string, bigint>;
    private scheduleByEntry: Map<string, { therapistId: string; clientId: string | null; start: number; end: number }>;

    constructor(schedule: GeneratedSchedule, callouts: Callout[], selectedDate: Date) {
        this.therapistMasks = new Map();
        this.clientMasks = new Map();
        this.scheduleByEntry = new Map();
        this.rebuild(schedule, callouts, selectedDate);
    }

    private timeToBit(timeStr: string | number): number {
        const mins = typeof timeStr === 'string' ? timeToMinutes(timeStr) : timeStr;
        return Math.floor(mins / 15);
    }

    private getRangeMask(start: number, end: number): bigint {
        const startBit = this.timeToBit(start);
        const endBit = this.timeToBit(end);
        const length = endBit - startBit;
        if (length <= 0) return 0n;
        return ((1n << BigInt(length)) - 1n) << BigInt(startBit);
    }

    public rebuild(schedule: GeneratedSchedule, callouts: Callout[], selectedDate: Date) {
        this.therapistMasks.clear();
        this.clientMasks.clear();
        this.scheduleByEntry.clear();

        schedule.forEach(s => {
            this.scheduleByEntry.set(s.id, {
                therapistId: s.therapistId,
                clientId: s.clientId,
                start: timeToMinutes(s.startTime),
                end: timeToMinutes(s.endTime)
            });
        });

        callouts.forEach(co => {
            if (isDateAffectedByCalloutRange(selectedDate, co.startDate, co.endDate)) {
                const mask = this.getRangeMask(timeToMinutes(co.startTime), timeToMinutes(co.endTime));
                if (co.entityType === 'therapist') {
                    const current = this.therapistMasks.get(co.entityId) || 0n;
                    this.therapistMasks.set(co.entityId, current | mask);
                } else {
                    const current = this.clientMasks.get(co.entityId) || 0n;
                    this.clientMasks.set(co.entityId, current | mask);
                }
            }
        });

        schedule.forEach(s => {
            const mask = this.getRangeMask(timeToMinutes(s.startTime), timeToMinutes(s.endTime));
            const tMask = this.therapistMasks.get(s.therapistId) || 0n;
            this.therapistMasks.set(s.therapistId, tMask | mask);
            if (s.clientId) {
                const cMask = this.clientMasks.get(s.clientId) || 0n;
                this.clientMasks.set(s.clientId, cMask | mask);
            }
        });
    }

    public isAvailable(entityType: 'therapist' | 'client', entityId: string, start: number, end: number, ignoreEntryId?: string): boolean {
        const queryMask = this.getRangeMask(start, end);
        let entityMask = (entityType === 'therapist' ? this.therapistMasks.get(entityId) : this.clientMasks.get(entityId)) || 0n;

        if (ignoreEntryId) {
            const ignoredEntry = this.scheduleByEntry.get(ignoreEntryId);
            if (ignoredEntry && 
                ((entityType === 'therapist' && ignoredEntry.therapistId === entityId) ||
                 (entityType === 'client' && ignoredEntry.clientId === entityId))) {
                const ignoreMask = this.getRangeMask(ignoredEntry.start, ignoredEntry.end);
                entityMask = entityMask & ~ignoreMask;
            }
        }
        return (entityMask & queryMask) === 0n;
    }

    public book(therapistId: string, clientId: string | null, start: number, end: number) {
        const mask = this.getRangeMask(start, end);
        const tMask = this.therapistMasks.get(therapistId) || 0n;
        this.therapistMasks.set(therapistId, tMask | mask);
        if (clientId) {
            const cMask = this.clientMasks.get(clientId) || 0n;
            this.clientMasks.set(clientId, cMask | mask);
        }
    }
}

// --- Constructive Heuristic Initialization ---
function constructiveHeuristicInitialization(
    clients: Client[],
    therapists: Therapist[],
    day: DayOfWeek,
    selectedDate: Date,
    callouts: Callout[],
    baseScheduleForDay?: BaseScheduleConfig | null,
    learningContext?: LearningContext
): GeneratedSchedule {
    let schedule: GeneratedSchedule = [];
    
    // Load Base Schedule
    if (baseScheduleForDay?.schedule) {
        schedule = baseScheduleForDay.schedule.filter(entry => {
            const hasConflict = callouts.some(co =>
                (co.entityId === entry.clientId || co.entityId === entry.therapistId) &&
                isDateAffectedByCalloutRange(selectedDate, co.startDate, co.endDate) &&
                sessionsOverlap(entry.startTime, entry.endTime, co.startTime, co.endTime)
            );
            return !hasConflict && entry.day === day;
        }).map(e => ({...e, id: generateId()}));
    }

    const tracker = new AvailabilityTracker(schedule, callouts, selectedDate);
    const opStartMins = timeToMinutes(COMPANY_OPERATING_HOURS_START);
    const opEndMins = timeToMinutes(COMPANY_OPERATING_HOURS_END);

    interface PlanningTask {
        clientId: string;
        clientName: string;
        type: SessionType;
        minDuration: number;
        maxDuration: number;
        priority: number;
        possibleTherapists: Therapist[];
    }

    let tasks: PlanningTask[] = [];

    clients.forEach(client => {
        client.alliedHealthNeeds.forEach(need => {
            const existing = schedule.filter(s => s.clientId === client.id && s.sessionType.includes(need.type)).length;
            if (existing < need.frequencyPerWeek) {
                const qualified = therapists.filter(t => 
                    t.canProvideAlliedHealth.includes(need.type) &&
                    client.insuranceRequirements.every(req => t.qualifications.includes(req))
                );
                
                tasks.push({
                    clientId: client.id, clientName: client.name, type: `AlliedHealth_${need.type}` as SessionType,
                    minDuration: need.durationMinutes, maxDuration: need.durationMinutes,
                    priority: 1000 - (qualified.length * 10) + need.durationMinutes, possibleTherapists: qualified
                });
            }
        });

        const qualified = therapists.filter(t => client.insuranceRequirements.every(req => t.qualifications.includes(req)));
        if (qualified.length > 0) {
            tasks.push({
                clientId: client.id, clientName: client.name, type: 'ABA',
                minDuration: 60, maxDuration: 180,
                priority: 500 - (qualified.length * 10) + 180, possibleTherapists: qualified
            });
        }
    });

    // Randomize priority slightly to increase variation
    tasks.forEach(t => t.priority += Math.floor(Math.random() * 50));
    tasks.sort((a, b) => b.priority - a.priority);

    for (const task of tasks) {
        const candidateTherapists = [...task.possibleTherapists].sort(() => 0.5 - Math.random());
        let placed = false;

        // Randomize start time search order sometimes
        const searchDirection = Math.random() > 0.5 ? 1 : -1;
        const startSearch = searchDirection === 1 ? opStartMins : opEndMins - task.minDuration;
        
        for (const therapist of candidateTherapists) {
            if (placed) break;

            let time = startSearch;
            while ((searchDirection === 1 && time <= opEndMins - task.minDuration) || 
                   (searchDirection === -1 && time >= opStartMins)) {
                
                const minEnd = time + task.minDuration;
                if (tracker.isAvailable('therapist', therapist.id, time, minEnd) && 
                    tracker.isAvailable('client', task.clientId, time, minEnd)) {
                    
                    let bestDuration = task.minDuration;
                    if (task.type === 'ABA') {
                        // Greedily expand or randomly expand
                        const maxExpansion = Math.random() > 0.3 ? task.maxDuration : task.minDuration + 30;
                        for (let d = task.minDuration + 15; d <= maxExpansion; d += 15) {
                            if (time + d > opEndMins) break;
                            if (tracker.isAvailable('therapist', therapist.id, time, time + d) &&
                                tracker.isAvailable('client', task.clientId, time, time + d)) {
                                bestDuration = d;
                            } else { break; }
                        }
                    }

                    const newEntry: ScheduleEntry = {
                        id: generateId(), clientName: task.clientName, clientId: task.clientId,
                        therapistName: therapist.name, therapistId: therapist.id, day,
                        startTime: minutesToTime(time), endTime: minutesToTime(time + bestDuration),
                        sessionType: task.type
                    };

                    if (canAddEntryToSchedule(newEntry, schedule, clients, therapists, selectedDate, callouts).valid) {
                        schedule.push(newEntry);
                        tracker.book(therapist.id, task.clientId, time, time + bestDuration);
                        placed = true;
                        break;
                    }
                }
                time += (15 * searchDirection);
            }
        }
    }

    // Place Lunches (Simplified, repair does the heavy lifting for staggering)
    schedule = fixLunchIssues(schedule, therapists, day, selectedDate, callouts);

    return schedule;
}

// --- Mutations ---

function mutateIncremental(schedule: GeneratedSchedule, clients: Client[], therapists: Therapist[], selectedDate: Date, callouts: Callout[]): GeneratedSchedule {
    if (schedule.length === 0) return schedule;
    const newSchedule = cloneSchedule(schedule);
    const numMutations = Math.max(1, Math.floor(newSchedule.length * 0.15));

    for (let m = 0; m < numMutations; m++) {
        const idx = Math.floor(Math.random() * newSchedule.length);
        const entry = newSchedule[idx];
        if (entry.sessionType === 'IndirectTime') continue;

        const action = Math.random();
        
        if (action < 0.6) { // Slide
            const shift = (Math.floor(Math.random() * 5) - 2) * 15; 
            if (shift === 0) continue;
            const newStart = timeToMinutes(entry.startTime) + shift;
            const newEnd = timeToMinutes(entry.endTime) + shift;
            const shifted = { ...entry, startTime: minutesToTime(newStart), endTime: minutesToTime(newEnd) };
            if (canAddEntryToSchedule(shifted, newSchedule, clients, therapists, selectedDate, callouts, entry.id).valid) {
                newSchedule[idx] = shifted;
            }
        } else { // Swap Therapist
            const potentialTherapists = therapists.filter(t => t.id !== entry.therapistId);
            if(potentialTherapists.length > 0) {
                const newT = potentialTherapists[Math.floor(Math.random() * potentialTherapists.length)];
                const swapped = { ...entry, therapistId: newT.id, therapistName: newT.name };
                if (canAddEntryToSchedule(swapped, newSchedule, clients, therapists, selectedDate, callouts, entry.id).valid) {
                    newSchedule[idx] = swapped;
                }
            }
        }
    }
    return newSchedule;
}

// New "Heavy" Mutation to jump out of local optima
function mutateRebuildTherapist(schedule: GeneratedSchedule, clients: Client[], therapists: Therapist[], selectedDate: Date, callouts: Callout[]): GeneratedSchedule {
    const newSchedule = cloneSchedule(schedule);
    if(newSchedule.length === 0) return newSchedule;

    // Pick a random therapist
    const therapistIds = [...new Set(newSchedule.map(s => s.therapistId))];
    const tId = therapistIds[Math.floor(Math.random() * therapistIds.length)];
    const t = getTherapistById(therapists, tId);
    if(!t) return newSchedule;

    // Remove all their sessions
    const removedSessions = newSchedule.filter(s => s.therapistId === tId);
    let remainingSchedule = newSchedule.filter(s => s.therapistId !== tId);

    // Try to reschedule their client work (ignore lunch, it gets added later)
    const tracker = new AvailabilityTracker(remainingSchedule, callouts, selectedDate);
    
    removedSessions.forEach(session => {
        if(session.sessionType === 'IndirectTime') return;
        
        // Try to place again in a random valid slot
        const dur = timeToMinutes(session.endTime) - timeToMinutes(session.startTime);
        const opStart = timeToMinutes(COMPANY_OPERATING_HOURS_START);
        const opEnd = timeToMinutes(COMPANY_OPERATING_HOURS_END);
        
        // Random start point
        const startPoint = opStart + Math.floor(Math.random() * ((opEnd - opStart)/15)) * 15;
        
        for(let tOffset = 0; tOffset < (opEnd - opStart); tOffset+=15) {
            let tryTime = startPoint + tOffset;
            if(tryTime > opEnd) tryTime -= (opEnd - opStart); // Wrap around
            
            if(tryTime + dur <= opEnd) {
                if(tracker.isAvailable('therapist', tId, tryTime, tryTime + dur) &&
                   (session.clientId ? tracker.isAvailable('client', session.clientId, tryTime, tryTime + dur) : true)) {
                       
                       const newEntry = {
                           ...session,
                           startTime: minutesToTime(tryTime),
                           endTime: minutesToTime(tryTime + dur)
                       };
                       
                       if(canAddEntryToSchedule(newEntry, remainingSchedule, clients, therapists, selectedDate, callouts).valid) {
                           remainingSchedule.push(newEntry);
                           tracker.book(tId, session.clientId, tryTime, tryTime + dur);
                           return; // Placed
                       }
                   }
            }
        }
    });
    
    // Add lunch back
    return fixLunchIssues(remainingSchedule, therapists, getDayOfWeekFromDate(selectedDate), selectedDate, callouts);
}

// --- Repair Functions ---

function cleanupScheduleIssues(schedule: GeneratedSchedule): GeneratedSchedule {
    let merged = true;
    let iterations = 0;
    while(merged && iterations < 20){
        merged = false;
        iterations++;
        const therapistIds = [...new Set(schedule.map(s => s.therapistId))];
        let newSchedule: GeneratedSchedule = [];
        
        therapistIds.forEach(therapistId => {
            const sessions = schedule.filter(s => s.therapistId === therapistId).sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            if(sessions.length <= 1) { newSchedule.push(...sessions); return; }
            
            let current = {...sessions[0]};
            for(let i = 1; i < sessions.length; i++){
                const next = sessions[i];
                if(current.clientId === next.clientId && current.sessionType === next.sessionType && 
                   current.endTime === next.startTime && current.sessionType === 'ABA') { 
                    const combined = (timeToMinutes(next.endTime) - timeToMinutes(next.startTime)) + (timeToMinutes(current.endTime) - timeToMinutes(current.startTime));
                    if (combined <= 180) { current.endTime = next.endTime; merged = true; } 
                    else { newSchedule.push(current); current = {...next}; }
                } else { newSchedule.push(current); current = {...next}; }
            }
            newSchedule.push(current);
        });
        schedule = newSchedule;
    }
    return schedule;
}

function fixSessionDurations(schedule: GeneratedSchedule): GeneratedSchedule {
    return schedule.map(entry => {
        if (entry.sessionType === 'ABA') {
            const s = timeToMinutes(entry.startTime);
            const e = timeToMinutes(entry.endTime);
            if (e - s > 180) return { ...entry, endTime: minutesToTime(s + 180) };
            if (e - s < 60) return { ...entry, endTime: minutesToTime(s + 60) };
        }
        return entry;
    });
}

function fixCredentialIssues(schedule: GeneratedSchedule, clients: Client[], therapists: Therapist[], selectedDate: Date, callouts: Callout[]): GeneratedSchedule {
    schedule.forEach(entry => {
        if (!entry.clientId) return;
        const client = getClientById(clients, entry.clientId);
        const therapist = getTherapistById(therapists, entry.therapistId);
        
        if (client && therapist && !client.insuranceRequirements.every(req => therapist.qualifications.includes(req))) {
            const qualified = therapists.filter(t => client.insuranceRequirements.every(req => t.qualifications.includes(req)));
            // Try to find a replacement who is free
            const tracker = new AvailabilityTracker(schedule, callouts, selectedDate);
            const start = timeToMinutes(entry.startTime);
            const end = timeToMinutes(entry.endTime);
            
            const replacement = qualified.find(t => tracker.isAvailable('therapist', t.id, start, end, entry.id));
            if (replacement) {
                entry.therapistId = replacement.id;
                entry.therapistName = replacement.name;
                // Update tracker for next iteration
                tracker.book(replacement.id, entry.clientId, start, end);
            }
        }
    });
    return schedule;
}

function fixMdMedicaidLimit(schedule: GeneratedSchedule, clients: Client[], therapists: Therapist[], selectedDate: Date, callouts: Callout[]): GeneratedSchedule {
    clients.forEach(client => {
        if (!client.insuranceRequirements.includes("MD_MEDICAID")) return;
        const clientSessions = schedule.filter(s => s.clientId === client.id);
        const unique = [...new Set(clientSessions.map(s => s.therapistId))];
        
        if (unique.length > 3) {
            const allowed = unique.slice(0, 3);
            // Reassign excess sessions to allowed therapists if possible
            clientSessions.forEach(session => {
                if (!allowed.includes(session.therapistId)) {
                    // Try to move to an allowed therapist
                    const tracker = new AvailabilityTracker(schedule, callouts, selectedDate);
                    const start = timeToMinutes(session.startTime);
                    const end = timeToMinutes(session.endTime);
                    const target = allowed.find(tid => tracker.isAvailable('therapist', tid, start, end, session.id));
                    
                    if(target) {
                        const t = getTherapistById(therapists, target)!;
                        session.therapistId = t.id;
                        session.therapistName = t.name;
                    } else {
                        // If we can't move, we must drop it to respect law
                        const idx = schedule.findIndex(s => s.id === session.id);
                        if(idx > -1) schedule.splice(idx, 1);
                    }
                }
            });
        }
    });
    return schedule;
}

// **ENHANCED LUNCH STAGGERING**
function fixLunchIssues(schedule: GeneratedSchedule, therapists: Therapist[], day: DayOfWeek, selectedDate: Date, callouts: Callout[]): GeneratedSchedule {
    const tracker = new AvailabilityTracker(schedule, callouts, selectedDate);
    const workingTherapistIds = new Set(schedule.filter(s => s.sessionType !== 'IndirectTime').map(s => s.therapistId));
    
    // Group by team to calculate concurrent lunches
    const teamLunchCounts: Record<string, Record<number, number>> = {};
    const teamMap: Record<string, string> = {}; // therapistId -> teamId

    therapists.forEach(t => {
        const tid = t.teamId || 'no_team';
        teamMap[t.id] = tid;
        if (!teamLunchCounts[tid]) teamLunchCounts[tid] = {};
    });

    // Populate current lunch counts
    schedule.filter(s => s.sessionType === 'IndirectTime').forEach(s => {
        const teamId = teamMap[s.therapistId];
        const start = timeToMinutes(s.startTime);
        const end = timeToMinutes(s.endTime);
        for(let t = start; t < end; t+=15) {
            teamLunchCounts[teamId][t] = (teamLunchCounts[teamId][t] || 0) + 1;
        }
    });

    workingTherapistIds.forEach(therapistId => {
        const sessions = schedule.filter(s => s.therapistId === therapistId && s.sessionType !== 'IndirectTime');
        const mins = sessions.reduce((acc, s) => acc + (timeToMinutes(s.endTime) - timeToMinutes(s.startTime)), 0);
        if (mins < 300) return; // No lunch needed

        const hasLunch = schedule.some(s => s.therapistId === therapistId && s.sessionType === 'IndirectTime');
        if(!hasLunch) {
            const therapist = getTherapistById(therapists, therapistId)!;
            const teamId = therapist.teamId || 'no_team';
            
            // Find valid slots
            const validSlots: { time: number, score: number }[] = [];
            const searchStart = timeToMinutes(IDEAL_LUNCH_WINDOW_START); // 11:00
            const searchEnd = timeToMinutes(IDEAL_LUNCH_WINDOW_END_FOR_START); // 13:30 (ends at 14:00)

            for(let t = searchStart; t <= searchEnd; t+=15) {
                if (tracker.isAvailable('therapist', therapistId, t, t+30)) {
                    // Score based on team stagger
                    const teammatesEatingAtStart = teamLunchCounts[teamId][t] || 0;
                    const teammatesEatingAtNext = teamLunchCounts[teamId][t+15] || 0;
                    const maxTeammates = Math.max(teammatesEatingAtStart, teammatesEatingAtNext);
                    
                    // Prefer slots where 0 teammates are eating. Penalize heavily for overlaps.
                    // Score = Higher is better.
                    // 1000 base - (500 * concurrent eaters)
                    let score = 1000 - (500 * maxTeammates);
                    
                    // Small random noise to prevent identical scheduling order
                    score += Math.random() * 50;

                    validSlots.push({ time: t, score });
                }
            }

            if(validSlots.length > 0) {
                validSlots.sort((a,b) => b.score - a.score);
                const best = validSlots[0];
                
                // Add lunch
                schedule.push({
                    id: generateId(), clientName: null, clientId: null,
                    therapistName: therapist.name, therapistId: therapist.id, day,
                    startTime: minutesToTime(best.time), endTime: minutesToTime(best.time+30),
                    sessionType: 'IndirectTime'
                });
                
                // Update tracker and team counts for subsequent therapists in this loop
                tracker.book(therapistId, null, best.time, best.time+30);
                for(let t = best.time; t < best.time+30; t+=15) {
                    teamLunchCounts[teamId][t] = (teamLunchCounts[teamId][t] || 0) + 1;
                }
            }
        }
    });
    return schedule;
}

function fixClientCoverageGaps(schedule: GeneratedSchedule, clients: Client[], therapists: Therapist[], day: DayOfWeek, selectedDate: Date, callouts: Callout[]): GeneratedSchedule {
    const tracker = new AvailabilityTracker(schedule, callouts, selectedDate);
    clients.forEach(client => {
        const gaps = getClientCoverageGaps(schedule, client.id, callouts, selectedDate);
        const qualified = therapists.filter(t => client.insuranceRequirements.every(req => t.qualifications.includes(req)));
        
        gaps.forEach(gap => {
            if (gap.end - gap.start < 60) return;
            const maxLen = Math.min(180, gap.end - gap.start);
            for (let len = maxLen; len >= 60; len -= 15) {
                const start = gap.start;
                const end = gap.start + len;
                const avail = qualified.find(t => tracker.isAvailable('therapist', t.id, start, end));
                if (avail) {
                    const entry: ScheduleEntry = {
                        id: generateId(), clientName: client.name, clientId: client.id,
                        therapistName: avail.name, therapistId: avail.id, day,
                        startTime: minutesToTime(start), endTime: minutesToTime(end), sessionType: 'ABA'
                    };
                    schedule.push(entry);
                    tracker.book(avail.id, client.id, start, end);
                    break;
                }
            }
        });
    });
    return schedule;
}

function fixSameClientBackToBackIssues(schedule: GeneratedSchedule, clients: Client[], therapists: Therapist[], day: DayOfWeek, selectedDate: Date, callouts: Callout[]): GeneratedSchedule {
    // Basic greedy fix: if back to back, try to insert break or remove one
    // For simplicity in this optimization loop, we rely on the penalty to drive evolution, 
    // but we can try to slide the second session later if space permits.
    const tracker = new AvailabilityTracker(schedule, callouts, selectedDate);
    
    for(let i=0; i<schedule.length; i++) {
        const s1 = schedule[i];
        if(!s1.clientId) continue;
        
        for(let j=0; j<schedule.length; j++) {
            if (i===j) continue;
            const s2 = schedule[j];
            if(s1.clientId === s2.clientId && s1.therapistId === s2.therapistId && s1.endTime === s2.startTime) {
                // Violation. Try to move s2 later by 15 mins.
                const s2Start = timeToMinutes(s2.startTime);
                const s2End = timeToMinutes(s2.endTime);
                
                const newStart = s2Start + 15;
                const newEnd = s2End + 15;
                
                if(newEnd <= timeToMinutes(COMPANY_OPERATING_HOURS_END) && 
                   tracker.isAvailable('therapist', s2.therapistId, newStart, newEnd, s2.id) && 
                   tracker.isAvailable('client', s2.clientId!, newStart, newEnd, s2.id)) {
                       s2.startTime = minutesToTime(newStart);
                       s2.endTime = minutesToTime(newEnd);
                       // Update tracker
                       tracker.book(s2.therapistId, s2.clientId, newStart, newEnd);
                   }
            }
        }
    }
    return schedule;
}

function fixTeamAlignmentIssues(schedule: GeneratedSchedule, clients: Client[], therapists: Therapist[]): GeneratedSchedule {
    // Soft constraint repair
    schedule.forEach(entry => {
        if (!entry.clientId) return;
        const client = getClientById(clients, entry.clientId);
        const therapist = getTherapistById(therapists, entry.therapistId);
        
        if (client && therapist && client.teamId && therapist.teamId && client.teamId !== therapist.teamId) {
            // Try to swap with a teammate
            const teammates = therapists.filter(t => t.teamId === client.teamId && client.insuranceRequirements.every(r => t.qualifications.includes(r)));
            if (teammates.length === 0) return;
            
            // Check if any teammate is free at this time
            const availTeammate = teammates.find(t => {
                // Naive check: is this teammate doing anything?
                return !schedule.some(s => s.therapistId === t.id && sessionsOverlap(s.startTime, s.endTime, entry.startTime, entry.endTime));
            });
            
            if (availTeammate) {
                entry.therapistId = availTeammate.id;
                entry.therapistName = availTeammate.name;
            }
        }
    });
    return schedule;
}

function repairAndMutate(schedule: GeneratedSchedule, clients: Client[], therapists: Therapist[], day: DayOfWeek, selectedDate: Date, callouts: Callout[]): GeneratedSchedule {
    let modifiedSchedule = cloneSchedule(schedule);

    if (Math.random() < MUTATION_RATE) {
        if (Math.random() < 0.2) {
            modifiedSchedule = mutateRebuildTherapist(modifiedSchedule, clients, therapists, selectedDate, callouts);
        } else {
            modifiedSchedule = mutateIncremental(modifiedSchedule, clients, therapists, selectedDate, callouts);
        }
    }

    // Repair Pipeline
    modifiedSchedule = cleanupScheduleIssues(modifiedSchedule);
    modifiedSchedule = fixSessionDurations(modifiedSchedule);
    modifiedSchedule = fixCredentialIssues(modifiedSchedule, clients, therapists, selectedDate, callouts);
    modifiedSchedule = fixMdMedicaidLimit(modifiedSchedule, clients, therapists, selectedDate, callouts);
    modifiedSchedule = fixSameClientBackToBackIssues(modifiedSchedule, clients, therapists, day, selectedDate, callouts);
    modifiedSchedule = fixClientCoverageGaps(modifiedSchedule, clients, therapists, day, selectedDate, callouts);
    modifiedSchedule = fixLunchIssues(modifiedSchedule, therapists, day, selectedDate, callouts);
    modifiedSchedule = fixTeamAlignmentIssues(modifiedSchedule, clients, therapists);

    return modifiedSchedule;
}

// --- Local Search ---
function localSearchImprovement(
    schedule: GeneratedSchedule,
    clients: Client[],
    therapists: Therapist[],
    selectedDate: Date,
    callouts: Callout[],
    maxIterations: number = 30
): GeneratedSchedule {
    let currentSchedule = cloneSchedule(schedule);
    let currentFitness = calculateFitness(currentSchedule, clients, therapists, selectedDate, callouts);
    
    for (let iter = 0; iter < maxIterations; iter++) {
        let improved = false;
        
        for (let i = 0; i < currentSchedule.length; i++) {
            for (let j = i + 1; j < currentSchedule.length; j++) {
                const entry1 = currentSchedule[i];
                const entry2 = currentSchedule[j];
                
                if (entry1.clientId && entry2.clientId && 
                    entry1.therapistId !== entry2.therapistId) {
                    
                    const testSchedule = cloneSchedule(currentSchedule);
                    const temp = testSchedule[i].therapistId;
                    testSchedule[i].therapistId = testSchedule[j].therapistId;
                    testSchedule[i].therapistName = getTherapistById(therapists, testSchedule[j].therapistId)!.name;
                    testSchedule[j].therapistId = temp;
                    testSchedule[j].therapistName = getTherapistById(therapists, temp)!.name;
                    
                    const testFitness = calculateFitness(testSchedule, clients, therapists, selectedDate, callouts);
                    
                    if (testFitness < currentFitness) {
                        currentSchedule = testSchedule;
                        currentFitness = testFitness;
                        improved = true;
                        break;
                    }
                }
            }
            if (improved) break;
        }
        
        if (!improved) break;
    }
    
    return currentSchedule;
}

// --- GA Core Loop ---
function diversityPreservingSelection(
    population: {schedule: GeneratedSchedule, fitness: number}[]
): GeneratedSchedule {
    const similarityCheck = Math.random();
    if (similarityCheck < 0.3) {
        const randomIdx = Math.floor(Math.random() * population.length);
        return cloneSchedule(population[randomIdx].schedule);
    }
    
    const tournamentSize = 5;
    let best = null;
    for (let i = 0; i < tournamentSize; i++) {
        const idx = Math.floor(Math.random() * population.length);
        const candidate = population[idx];
        if (!best || candidate.fitness < best.fitness) {
            best = candidate;
        }
    }
    return cloneSchedule(best!.schedule);
}

function crossover(parent1: GeneratedSchedule, parent2: GeneratedSchedule, therapists: Therapist[], clients: Client[], selectedDate: Date, callouts: Callout[]): GeneratedSchedule {
    if (Math.random() > CROSSOVER_RATE) return cloneSchedule(Math.random() < 0.5 ? parent1 : parent2);
    
    const offspring: GeneratedSchedule = [];
    const therapistIds = therapists.map(t => t.id);
    const midpoint = Math.floor(therapistIds.length / 2);
    const p1Ids = new Set(therapistIds.slice(0, midpoint));

    parent1.forEach(s => { if (p1Ids.has(s.therapistId)) offspring.push({ ...s, id: generateId() }); });
    parent2.forEach(s => { if (!p1Ids.has(s.therapistId)) offspring.push({ ...s, id: generateId() }); });

    // Immediate conflict resolution
    offspring.sort((a, b) => {
        const aTherapist = getTherapistById(therapists, a.therapistId);
        const bTherapist = getTherapistById(therapists, b.therapistId);
        const aBCBA = aTherapist?.qualifications.includes("BCBA") ? 0 : 1;
        const bBCBA = bTherapist?.qualifications.includes("BCBA") ? 0 : 1;
        if (aBCBA !== bBCBA) return aBCBA - bBCBA;
        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });

    const validOffspring: GeneratedSchedule = [];
    const tracker = new AvailabilityTracker([], callouts, selectedDate);

    offspring.forEach(entry => {
        const start = timeToMinutes(entry.startTime);
        const end = timeToMinutes(entry.endTime);
        
        const tAvail = tracker.isAvailable('therapist', entry.therapistId, start, end);
        const cAvail = !entry.clientId || tracker.isAvailable('client', entry.clientId, start, end);
        
        if (tAvail && cAvail) {
            validOffspring.push(entry);
            tracker.book(entry.therapistId, entry.clientId, start, end);
        }
    });

    return validOffspring;
}

// --- Fitness Calculation ---
function calculateFitness(
    schedule: GeneratedSchedule,
    clients: Client[],
    therapists: Therapist[],
    selectedDate: Date,
    callouts: Callout[]
): number {
    const penalties = calculateAdaptivePenalties(clients, therapists, schedule);
    let fitness = 0;
    const errors = validateFullSchedule(schedule, clients, therapists, selectedDate, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, callouts);

    const counts: Record<string, number> = {};
    errors.forEach(e => counts[e.ruleId] = (counts[e.ruleId] || 0) + 1);

    if (counts["CLIENT_TIME_CONFLICT"]) fitness += penalties.CONFLICT_PENALTY * Math.min(counts["CLIENT_TIME_CONFLICT"], 5);
    if (counts["THERAPIST_TIME_CONFLICT"]) fitness += penalties.CONFLICT_PENALTY * Math.min(counts["THERAPIST_TIME_CONFLICT"], 5);
    if (counts["SAME_CLIENT_BACK_TO_BACK"]) fitness += penalties.SAME_CLIENT_BACK_TO_BACK_PENALTY * counts["SAME_CLIENT_BACK_TO_BACK"];
    if (counts["INSURANCE_MISMATCH"]) fitness += penalties.CREDENTIAL_MISMATCH_PENALTY * Math.min(counts["INSURANCE_MISMATCH"], 5);
    if (counts["SESSION_OVERLAPS_CALLOUT"]) fitness += penalties.CALLOUT_OVERLAP_PENALTY * Math.min(counts["SESSION_OVERLAPS_CALLOUT"], 5);
    
    if (counts["MISSING_LUNCH_BREAK"]) fitness += penalties.MISSING_LUNCH_PENALTY * Math.min(counts["MISSING_LUNCH_BREAK"], therapists.length);
    if (counts["LUNCH_OUTSIDE_WINDOW"]) fitness += penalties.LUNCH_OUTSIDE_WINDOW_PENALTY * counts["LUNCH_OUTSIDE_WINDOW"];
    
    const lunchViolations = countStaggerViolations(schedule, therapists);
    fitness += penalties.LUNCH_STAGGER_PENALTY * lunchViolations;

    if (counts["ABA_DURATION_TOO_SHORT"]) fitness += penalties.SESSION_DURATION_PENALTY * counts["ABA_DURATION_TOO_SHORT"];
    if (counts["ABA_DURATION_TOO_LONG"]) fitness += penalties.SESSION_DURATION_PENALTY * counts["ABA_DURATION_TOO_LONG"];

    if (counts["MD_MEDICAID_LIMIT_VIOLATED"]) fitness += penalties.MD_MEDICAID_LIMIT_PENALTY * counts["MD_MEDICAID_LIMIT_VIOLATED"];
    
    if (counts["CLIENT_COVERAGE_GAP_AT_TIME"]) {
        const gapPenalty = Math.floor(counts["CLIENT_COVERAGE_GAP_AT_TIME"] / 4);
        fitness += penalties.CLIENT_COVERAGE_GAP_PENALTY * Math.min(gapPenalty, clients.length * 2);
    }

    fitness += calculateFragmentationPenalty(schedule, therapists, penalties.SCHEDULE_FRAGMENTATION_PENALTY);

    if (counts["TEAM_ALIGNMENT_MISMATCH"]) fitness += penalties.TEAM_ALIGNMENT_PENALTY * counts["TEAM_ALIGNMENT_MISMATCH"];
    
    return fitness;
}

function countStaggerViolations(schedule: GeneratedSchedule, therapists: Therapist[]): number {
    let violations = 0;
    const teamLunches = new Map<string, number[]>();

    schedule.filter(s => s.sessionType === 'IndirectTime').forEach(s => {
        const t = getTherapistById(therapists, s.therapistId);
        if (t && t.teamId) {
            const start = timeToMinutes(s.startTime);
            const teamTimes = teamLunches.get(t.teamId) || [];
            
            const overlaps = teamTimes.filter(existing => Math.abs(existing - start) < 30).length;
            if (overlaps >= 1) { 
                violations++;
            }
            
            teamTimes.push(start);
            teamLunches.set(t.teamId, teamTimes);
        }
    });
    return violations;
}

function calculateFragmentationPenalty(schedule: GeneratedSchedule, therapists: Therapist[], penaltyWeight: number): number {
    let totalIdleMinutes = 0;
    
    therapists.forEach(t => {
        const sessions = schedule
            .filter(s => s.therapistId === t.id)
            .sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            
        if (sessions.length > 1) {
            for(let i=0; i<sessions.length - 1; i++) {
                const endCurrent = timeToMinutes(sessions[i].endTime);
                const startNext = timeToMinutes(sessions[i+1].startTime);
                const gap = startNext - endCurrent;
                
                if (gap > 0 && gap !== 30) {
                    totalIdleMinutes += gap;
                }
            }
        }
    });
    
    return totalIdleMinutes * penaltyWeight;
}

// --- Main Algorithm ---
export async function runCsoAlgorithm(
    clients: Client[],
    therapists: Therapist[],
    selectedDate: Date,
    callouts: Callout[],
    initialScheduleForOptimization: GeneratedSchedule | undefined | null,
    baseSchedules: BaseScheduleConfig[],
    learningContext: LearningContext
): Promise<GAGenerationResult> {
    const day = getDayOfWeekFromDate(selectedDate);
    const baseScheduleForDay = initialScheduleForOptimization ? null : baseSchedules.find(bs => bs.appliesToDays.includes(day));
    
    // 1. Initialization
    let population: GeneratedSchedule[] = [];
    
    // Seeds
    if (initialScheduleForOptimization) {
        population.push(repairAndMutate(initialScheduleForOptimization, clients, therapists, day, selectedDate, callouts));
    }
    if (baseScheduleForDay?.schedule) {
        population.push(repairAndMutate(baseScheduleForDay.schedule, clients, therapists, day, selectedDate, callouts));
    }
    // Historical Seeds
    for (const topSchedule of learningContext.topRatedSchedules.slice(0, 3)) {
        const daySched = topSchedule.filter(s => s.day === day).map(e => ({...e, id: generateId()}));
        if(daySched.length > 0) population.push(daySched);
    }

    // Random Seeds
    while (population.length < POPULATION_SIZE) {
        population.push(constructiveHeuristicInitialization(clients, therapists, day, selectedDate, callouts, baseScheduleForDay, learningContext));
    }

    let bestFitnessOverall = Infinity;
    let bestScheduleOverall: GeneratedSchedule | null = null;
    let generationsWithoutImprovement = 0;
    let restartCount = 0;

    // 2. Evolutionary Loop
    for (let gen = 0; gen < MAX_GENERATIONS; gen++) {
        
        // Evaluate
        const popWithFitness = population.map(p => ({
            schedule: p,
            fitness: calculateFitness(p, clients, therapists, selectedDate, callouts)
        }));
        popWithFitness.sort((a,b) => a.fitness - b.fitness);
        
        const currentBestFitness = popWithFitness[0].fitness;
        const currentBestSchedule = popWithFitness[0].schedule;

        if (currentBestFitness < bestFitnessOverall) {
            bestFitnessOverall = currentBestFitness;
            bestScheduleOverall = cloneSchedule(currentBestSchedule);
            generationsWithoutImprovement = 0;
        } else {
            generationsWithoutImprovement++;
        }

        // Perfect score check
        if (bestFitnessOverall === 0) break;

        // **Micro-GA Restart Logic**
        if (generationsWithoutImprovement >= RESTART_THRESHOLD) {
            restartCount++;
            generationsWithoutImprovement = 0;
            
            // Keep elite, replace rest with fresh randoms
            population = [];
            if (bestScheduleOverall) population.push(cloneSchedule(bestScheduleOverall)); // Keep absolute best
            
            // Add a few mutations of the best
            for(let k=0; k < 5; k++) {
                if(bestScheduleOverall) population.push(mutateRebuildTherapist(bestScheduleOverall, clients, therapists, selectedDate, callouts));
            }

            // Fill rest with brand new heuristics
            while(population.length < POPULATION_SIZE) {
                population.push(constructiveHeuristicInitialization(clients, therapists, day, selectedDate, callouts, null, learningContext));
            }
            continue; // Skip standard breeding for this generation
        }

        // Standard Breeding
        const newPop: GeneratedSchedule[] = [];
        const eliteCount = Math.ceil(POPULATION_SIZE * ELITISM_RATE);
        
        // Elitism
        for(let i=0; i<eliteCount; i++) newPop.push(cloneSchedule(popWithFitness[i].schedule));

        while(newPop.length < POPULATION_SIZE) {
            const p1 = diversityPreservingSelection(popWithFitness);
            const p2 = diversityPreservingSelection(popWithFitness);
            let child = crossover(p1, p2, therapists, clients, selectedDate, callouts);
            child = repairAndMutate(child, clients, therapists, day, selectedDate, callouts);
            newPop.push(child);
        }
        population = newPop;
    }

    // Final Polish
    if (bestScheduleOverall) {
        bestScheduleOverall = localSearchImprovement(bestScheduleOverall, clients, therapists, selectedDate, callouts, 50);
        // One last stagger check
        bestScheduleOverall = fixLunchIssues(bestScheduleOverall, therapists, day, selectedDate, callouts); 
    }

    const finalCleaned = bestScheduleOverall ? cleanupScheduleIssues(bestScheduleOverall) : [];
    const finalErrors = validateFullSchedule(finalCleaned, clients, therapists, selectedDate, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, callouts);
    const finalFitness = calculateFitness(finalCleaned, clients, therapists, selectedDate, callouts);

    return {
        schedule: finalCleaned,
        finalValidationErrors: finalErrors,
        generations: MAX_GENERATIONS,
        bestFitness: finalFitness,
        success: finalFitness < 1000,
        statusMessage: `Optimization Complete: ${MAX_GENERATIONS} generations (with ${restartCount} restarts). Best Fitness: ${finalFitness.toFixed(0)}`
    };
}