import { Client, Therapist, GeneratedSchedule, DayOfWeek, Callout, GAGenerationResult, ScheduleEntry, SessionType } from '../types';
import { COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, IDEAL_LUNCH_WINDOW_START, IDEAL_LUNCH_WINDOW_END_FOR_START } from '../constants';
import { validateFullSchedule, timeToMinutes, minutesToTime, sessionsOverlap, isDateAffectedByCalloutRange } from '../utils/validationService';

const SLOT_SIZE = 15;
const OP_START = timeToMinutes(COMPANY_OPERATING_HOURS_START);
const OP_END = timeToMinutes(COMPANY_OPERATING_HOURS_END);
const NUM_SLOTS = (OP_END - OP_START) / SLOT_SIZE;

const generateId = () => `cso-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const getDayOfWeekFromDate = (date: Date): DayOfWeek => {
    const days: DayOfWeek[] = [DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY];
    return days[date.getDay()];
};

class BitTracker {
    public tBusy: bigint[];
    public cBusy: bigint[];
    public cT: Set<number>[];
    constructor(numT: number, numC: number) {
        this.tBusy = new Array(numT).fill(0n);
        this.cBusy = new Array(numC).fill(0n);
        this.cT = new Array(numC).fill(null).map(() => new Set());
    }
    public isTFree(ti: number, s: number, l: number) {
        const m = ((1n << BigInt(l)) - 1n) << BigInt(s);
        return (this.tBusy[ti] & m) === 0n;
    }
    public isCFree(ci: number, s: number, l: number) {
        const m = ((1n << BigInt(l)) - 1n) << BigInt(s);
        return (this.cBusy[ci] & m) === 0n;
    }
    public book(ti: number, ci: number, s: number, l: number) {
        const m = ((1n << BigInt(l)) - 1n) << BigInt(s);
        this.tBusy[ti] |= m;
        if (ci >= 0) { this.cBusy[ci] |= m; this.cT[ci].add(ti); }
    }
}

class FastScheduler {
    private clients: Client[];
    private therapists: Therapist[];
    private day: DayOfWeek;
    private selectedDate: Date;
    private callouts: Callout[];

    constructor(clients: Client[], therapists: Therapist[], day: DayOfWeek, selectedDate: Date, callouts: Callout[]) {
        this.clients = clients;
        this.therapists = therapists;
        this.day = day;
        this.selectedDate = selectedDate;
        this.callouts = callouts;
    }

    private meetsInsurance(t: Therapist, c: Client) {
        return c.insuranceRequirements.every(r => t.qualifications.includes(r));
    }

    public createSchedule(initialSchedule?: GeneratedSchedule): GeneratedSchedule {
        const schedule: GeneratedSchedule = [];
        const tracker = new BitTracker(this.therapists.length, this.clients.length);
        const lunchCount = new Array(NUM_SLOTS).fill(0);
        const maxConcurrentLunches = Math.max(1, Math.floor(this.therapists.length * 0.35));
        const tSessionCount = new Array(this.therapists.length).fill(0);

        // 1. Initial Constraints
        this.callouts.forEach(co => {
            if (isDateAffectedByCalloutRange(this.selectedDate, co.startDate, co.endDate)) {
                const s = Math.max(0, Math.floor((timeToMinutes(co.startTime) - OP_START) / SLOT_SIZE));
                const e = Math.min(NUM_SLOTS, Math.ceil((timeToMinutes(co.endTime) - OP_START) / SLOT_SIZE));
                if (co.entityType === 'therapist') {
                    const idx = this.therapists.findIndex(t => t.id === co.entityId);
                    if (idx >= 0) tracker.tBusy[idx] |= ((1n << BigInt(e - s)) - 1n) << BigInt(s);
                } else {
                    const idx = this.clients.findIndex(c => c.id === co.entityId);
                    if (idx >= 0) tracker.cBusy[idx] |= ((1n << BigInt(e - s)) - 1n) << BigInt(s);
                }
            }
        });

        // 2. Seed with Initial Schedule (if valid)
        if (initialSchedule) {
            initialSchedule.forEach(entry => {
                if (entry.day !== this.day) return;
                const ti = this.therapists.findIndex(t => t.id === entry.therapistId);
                const ci = this.clients.findIndex(c => c.id === entry.clientId);
                const s = Math.max(0, Math.floor((timeToMinutes(entry.startTime) - OP_START) / SLOT_SIZE));
                const l = Math.ceil((timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime)) / SLOT_SIZE);
                
                if (ti >= 0 && (ci >= 0 || entry.clientId === null) && tracker.isTFree(ti, s, l) && (ci < 0 || tracker.isCFree(ci, s, l))) {
                    if (ci >= 0 && !this.meetsInsurance(this.therapists[ti], this.clients[ci])) return;
                    schedule.push({ ...entry, id: generateId() });
                    tracker.book(ti, ci, s, l);
                    if (entry.sessionType === 'ABA') tSessionCount[ti]++;
                }
            });
        }

        // 3. Mandatory Lunches for working staff
        const shuffledT = this.therapists.map((t, ti) => ({t, ti})).sort(() => Math.random() - 0.5);
        shuffledT.forEach(q => {
            const ls = (timeToMinutes(IDEAL_LUNCH_WINDOW_START) - OP_START) / SLOT_SIZE;
            const le = (timeToMinutes(IDEAL_LUNCH_WINDOW_END_FOR_START) - OP_START) / SLOT_SIZE;
            const opts = [];
            for (let s = ls; s <= le; s++) opts.push(s);
            opts.sort((a, b) => (lunchCount[a] + lunchCount[a+1]) - (lunchCount[b] + lunchCount[b+1]) + (Math.random() - 0.5));
            for (const s of opts) {
                if (tracker.isTFree(q.ti, s, 2) && lunchCount[s] < maxConcurrentLunches && lunchCount[s+1] < maxConcurrentLunches) {
                    schedule.push(this.ent(-1, q.ti, s, 2, 'IndirectTime'));
                    tracker.book(q.ti, -1, s, 2);
                    lunchCount[s]++; lunchCount[s+1]++;
                    break;
                }
            }
        });

        // 4. Client Coverage (ABA)
        const shuffledC = this.clients.map((c, ci) => ({c, ci})).sort(() => Math.random() - 0.5);
        shuffledC.forEach(target => {
            for (let s = 0; s < NUM_SLOTS; s++) {
                if (tracker.isCFree(target.ci, s, 1)) {
                    // Find therapists
                    const quals = this.therapists.map((t, ti) => ({t, ti})).filter(x => this.meetsInsurance(x.t, target.c)).sort((a, b) => {
                        // BCBA Rule
                        const aNeed = (a.t.role === 'BCBA' && tSessionCount[a.ti] === 0);
                        const bNeed = (b.t.role === 'BCBA' && tSessionCount[b.ti] === 0);
                        if (aNeed && !bNeed) return -1;
                        if (bNeed && !aNeed) return 1;

                        const aHas = tracker.cT[target.ci].has(a.ti);
                        const bHas = tracker.cT[target.ci].has(b.ti);
                        if (aHas !== bHas) {
                           if (aHas && a.t.role !== 'BCBA') return -1;
                           if (bHas && b.t.role !== 'BCBA') return 1;
                        }
                        const rank: any = { "BCBA": 0, "Clinical Fellow": 1, "RBT": 2, "3 STAR": 2, "Technician": 3 };
                        return rank[b.t.role] - rank[a.t.role];
                    });

                    for (const q of quals) {
                        if (tracker.cT[target.ci].size >= 3 && !tracker.cT[target.ci].has(q.ti) && target.c.insuranceRequirements.includes("MD_MEDICAID")) continue;
                        
                        for (let len = 12; len >= 4; len--) {
                            if (s + len <= NUM_SLOTS && tracker.isCFree(target.ci, s, len) && tracker.isTFree(q.ti, s, len)) {
                                if (schedule.some(x => x.clientId === target.c.id && x.therapistId === q.t.id && timeToMinutes(x.endTime) === OP_START + s * SLOT_SIZE)) continue;
                                schedule.push(this.ent(target.ci, q.ti, s, len, 'ABA'));
                                tracker.book(q.ti, target.ci, s, len);
                                tSessionCount[q.ti]++;
                                break;
                            }
                        }
                        if (!tracker.isCFree(target.ci, s, 1)) break;
                    }
                }
            }
        });

        // 5. Cleanup
        return schedule.filter(e => e.sessionType !== 'IndirectTime' || schedule.some(s => s.therapistId === e.therapistId && s.sessionType !== 'IndirectTime'));
    }

    private ent(ci: number, ti: number, s: number, l: number, type: SessionType): ScheduleEntry {
        const client = ci >= 0 ? this.clients[ci] : null;
        const therapist = this.therapists[ti];
        return { id: generateId(), clientId: client ? client.id : null, clientName: client ? client.name : null, therapistId: therapist.id, therapistName: therapist.name, day: this.day, startTime: minutesToTime(OP_START + s * SLOT_SIZE), endTime: minutesToTime(OP_START + (s + l) * SLOT_SIZE), sessionType: type };
    }

    public calculateScore(s: GeneratedSchedule): number {
        const errs = validateFullSchedule(s, this.clients, this.therapists, this.selectedDate, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, []);
        if (errs.length > 0) return 1000000 + errs.length;
        
        let penalty = 0;
        const ROLE_PRIO: any = { "BCBA": 4, "Clinical Fellow": 3, "RBT": 2, "3 STAR": 2, "Technician": 1 };
        const indirect = this.therapists.map(t => ({ p: ROLE_PRIO[t.role], time: s.filter(x => x.therapistId === t.id && (x.sessionType === 'IndirectTime' || x.sessionType === 'AdminTime')).length }));
        for (let i = 0; i < indirect.length; i++) {
            for (let j = 0; j < indirect.length; j++) {
                if (indirect[i].p > indirect[j].p && indirect[i].time < indirect[j].time) penalty += (indirect[j].time - indirect[i].time) * 10;
            }
        }
        return penalty;
    }
}

export async function runCsoAlgorithm(
    clients: Client[],
    therapists: Therapist[],
    selectedDate: Date,
    callouts: Callout[],
    initialScheduleForOptimization?: GeneratedSchedule
): Promise<GAGenerationResult> {
    const day = getDayOfWeekFromDate(selectedDate);
    const algo = new FastScheduler(clients, therapists, day, selectedDate, callouts);
    
    let best: GeneratedSchedule = [];
    let minScore = Infinity;
    
    for (let i = 0; i < 200; i++) {
        const s = algo.createSchedule(initialScheduleForOptimization);
        const score = algo.calculateScore(s);
        if (score < minScore) { best = s; minScore = score; if (minScore === 0) break; }
    }

    // Final Filler
    const ROLE_PRIO: any = { "BCBA": 4, "Clinical Fellow": 3, "RBT": 2, "3 STAR": 2, "Technician": 1 };
    therapists.sort((a, b) => ROLE_PRIO[b.role] - ROLE_PRIO[a.role]).forEach(th => {
        for (let time = OP_START; time <= OP_END - 15; time += 15) {
            if (!best.some(x => x.therapistId === th.id && sessionsOverlap(x.startTime, x.endTime, minutesToTime(time), minutesToTime(time + 15)))) {
                best.push({ id: generateId(), clientId: null, clientName: null, therapistId: th.id, therapistName: th.name, day: day, startTime: minutesToTime(time), endTime: minutesToTime(time + 15), sessionType: 'AdminTime' });
            }
        }
    });

    const finalErrors = validateFullSchedule(best, clients, therapists, selectedDate, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, callouts);
    return {
        schedule: best,
        finalValidationErrors: finalErrors,
        generations: 0,
        bestFitness: finalErrors.length,
        success: finalErrors.length === 0,
        statusMessage: finalErrors.length === 0 ? "Perfect!" : "Nearly Perfect."
    };
}
