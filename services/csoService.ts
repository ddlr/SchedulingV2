import { Client, Therapist, GeneratedSchedule, DayOfWeek, Callout, GAGenerationResult, ScheduleEntry, SessionType, InsuranceQualification, TherapistRole } from '../types';
import { COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, IDEAL_LUNCH_WINDOW_START, IDEAL_LUNCH_WINDOW_END_FOR_START, ALL_THERAPIST_ROLES, DEFAULT_ROLE_RANK } from '../constants';
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
        if (ti >= 0) { this.tBusy[ti] |= m; }
        if (ci >= 0) {
            this.cBusy[ci] |= m;
            if (ti >= 0) { this.cT[ci].add(ti); }
        }
    }
}

export class FastScheduler {
    private clients: Client[];
    private therapists: Therapist[];
    private insuranceQualifications: InsuranceQualification[];
    private day: DayOfWeek;
    private selectedDate: Date;
    private callouts: Callout[];
    private otherDayEntries: GeneratedSchedule;

    constructor(clients: Client[], therapists: Therapist[], insuranceQualifications: InsuranceQualification[], day: DayOfWeek, selectedDate: Date, callouts: Callout[], initialSchedule?: GeneratedSchedule) {
        this.clients = clients;
        this.therapists = therapists;
        this.insuranceQualifications = insuranceQualifications;
        this.day = day;
        this.selectedDate = selectedDate;
        this.callouts = callouts;
        this.otherDayEntries = initialSchedule ? initialSchedule.filter(e => e.day !== day) : [];
    }

    private getRoleRank(role: string): number {
        const metadata = this.insuranceQualifications.find(iq => iq.id === role);
        if (metadata && metadata.roleHierarchyOrder !== undefined) {
            return metadata.roleHierarchyOrder;
        }
        return DEFAULT_ROLE_RANK[role] ?? -1;
    }

    private meetsInsurance(t: Therapist, c: Client): boolean {
        if (c.insuranceRequirements.length === 0) return true;
        return c.insuranceRequirements.every(reqId => {
            if (t.qualifications.includes(reqId)) return true;

            const requiredRank = this.getRoleRank(reqId);
            const therapistRank = this.getRoleRank(t.role);

            if (therapistRank >= requiredRank && requiredRank !== -1) return true;
            if (t.role === reqId) return true;
            return false;
        });
    }

    private getMaxProviders(c: Client): number {
        let max = Infinity;
        c.insuranceRequirements.forEach(reqId => {
            const q = this.insuranceQualifications.find(qual => qual.id === reqId);
            if (q && q.maxTherapistsPerDay !== undefined && q.maxTherapistsPerDay < max) {
                max = q.maxTherapistsPerDay;
            }
        });
        return max;
    }

    private getMinDuration(c: Client): number {
        let min = 60; // Default ABA min
        let foundCustom = false;
        c.insuranceRequirements.forEach(reqId => {
            const q = this.insuranceQualifications.find(qual => qual.id === reqId);
            if (q && q.minSessionDurationMinutes !== undefined && q.minSessionDurationMinutes > 0) {
                // Use the most restrictive (highest) custom minimum session duration.
                if (!foundCustom || q.minSessionDurationMinutes > min) {
                    min = q.minSessionDurationMinutes;
                    foundCustom = true;
                }
            }
        });
        return min;
    }

    private getMaxDuration(c: Client): number {
        let max = 180; // Default ABA max
        let foundCustom = false;
        c.insuranceRequirements.forEach(reqId => {
            const q = this.insuranceQualifications.find(qual => qual.id === reqId);
            if (q && q.maxSessionDurationMinutes !== undefined && q.maxSessionDurationMinutes > 0) {
                // Use the most restrictive (lowest) custom maximum session duration.
                if (!foundCustom || q.maxSessionDurationMinutes < max) {
                    max = q.maxSessionDurationMinutes;
                    foundCustom = true;
                }
            }
        });
        return max;
    }

    private getMaxWeeklyMinutes(c: Client): number {
        let max = Infinity;
        c.insuranceRequirements.forEach(reqId => {
            const q = this.insuranceQualifications.find(qual => qual.id === reqId);
            if (q && q.maxHoursPerWeek !== undefined) {
                if (q.maxHoursPerWeek * 60 < max) max = q.maxHoursPerWeek * 60;
            }
        });
        return max;
    }

    public createSchedule(initialSchedule?: GeneratedSchedule): GeneratedSchedule {
        const schedule: GeneratedSchedule = [];
        const tracker = new BitTracker(this.therapists.length, this.clients.length);
        const lunchCount = new Array(NUM_SLOTS).fill(0);
        // Allow enough concurrent lunches to ensure remaining staff can cover all clients
        const maxConcurrentLunches = Math.max(1, this.therapists.length - this.clients.length);
        const tSessionCount = new Array(this.therapists.length).fill(0);
        const clientMinutes = new Map<number, number>();
        this.clients.forEach((c, ci) => {
            const otherDayMins = this.otherDayEntries
                .filter(e => e.clientId === c.id && (e.sessionType === 'ABA' || e.sessionType.startsWith('AlliedHealth_')))
                .reduce((sum, e) => sum + (timeToMinutes(e.endTime) - timeToMinutes(e.startTime)), 0);
            clientMinutes.set(ci, otherDayMins);
        });

        this.callouts.forEach(co => {
            if (isDateAffectedByCalloutRange(this.selectedDate, co.startDate, co.endDate)) {
                const s = Math.max(0, Math.floor((timeToMinutes(co.startTime) - OP_START) / SLOT_SIZE));
                const e = Math.min(NUM_SLOTS, Math.ceil((timeToMinutes(co.endTime) - OP_START) / SLOT_SIZE));
                if (e <= s) return; // Skip callouts fully outside operating hours
                if (co.entityType === 'therapist') {
                    const idx = this.therapists.findIndex(t => t.id === co.entityId);
                    if (idx >= 0) tracker.tBusy[idx] |= ((1n << BigInt(e - s)) - 1n) << BigInt(s);
                } else {
                    const idx = this.clients.findIndex(c => c.id === co.entityId);
                    if (idx >= 0) tracker.cBusy[idx] |= ((1n << BigInt(e - s)) - 1n) << BigInt(s);
                }
            }
        });

        if (initialSchedule) {
            initialSchedule.forEach(entry => {
                if (entry.day !== this.day) return;
                const ti = this.therapists.findIndex(t => t.id === entry.therapistId);
                const ci = this.clients.findIndex(c => c.id === entry.clientId);
                const s = Math.max(0, Math.floor((timeToMinutes(entry.startTime) - OP_START) / SLOT_SIZE));
                const l = Math.ceil((timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime)) / SLOT_SIZE);

                if (ti >= 0 && (ci >= 0 || entry.clientId === null) && tracker.isTFree(ti, s, l) && (ci < 0 || tracker.isCFree(ci, s, l))) {
                    if (ci >= 0) {
                        if (!this.meetsInsurance(this.therapists[ti], this.clients[ci])) return;

                        // Enforce Max Duration even for initial sessions (allows fixing invalid sessions)
                        const durationMinutes = timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime);
                        if (durationMinutes > this.getMaxDuration(this.clients[ci])) return;

                        // Enforce BTB rule for initial sessions
                        if (this.isBTB(schedule, entry.clientId!, entry.therapistId, s, l)) return;
                    }

                    schedule.push({ ...entry, id: generateId() });
                    tracker.book(ti, ci, s, l);
                    if (ci >= 0 && (entry.sessionType === 'ABA' || entry.sessionType.startsWith('AlliedHealth_'))) {
                        tSessionCount[ti]++;
                        clientMinutes.set(ci, (clientMinutes.get(ci) || 0) + (l * SLOT_SIZE));
                    }
                }
            });
        }

        // Optimization: Pre-sort therapists by role once
        const sortedTherapists = this.therapists.map((t, ti) => ({t, ti})).sort((a, b) => {
            return this.getRoleRank(a.t.role) - this.getRoleRank(b.t.role);
        });

        // Pass 1: Lunches
        const shuffledT = this.therapists.map((t, ti) => ({t, ti})).sort(() => Math.random() - 0.5);
        shuffledT.forEach(q => {
            // Check if already has a lunch or indirect task in the lunch window from initialSchedule
            if (schedule.some(e => e.therapistId === q.t.id && e.sessionType === 'IndirectTime')) return;

            const ls = Math.floor((timeToMinutes(IDEAL_LUNCH_WINDOW_START) - OP_START) / SLOT_SIZE);
            const le = Math.floor((timeToMinutes(IDEAL_LUNCH_WINDOW_END_FOR_START) - OP_START) / SLOT_SIZE);
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

        const shuffledC = this.clients.map((c, ci) => ({c, ci})).sort(() => Math.random() - 0.5);

        // Pass 2: Allied Health (Attempt to assign therapists to Allied Health sessions)
        shuffledC.forEach(target => {
            target.c.alliedHealthNeeds.forEach(need => {
                if (!need.specificDays || !need.specificDays.includes(this.day)) return;
                if (!need.startTime || !need.endTime) return;

                const startMin = timeToMinutes(need.startTime);
                const endMin = timeToMinutes(need.endTime);
                const s = Math.floor((startMin - OP_START) / SLOT_SIZE);
                const len = Math.ceil((endMin - startMin) / SLOT_SIZE);

                if (s < 0 || s + len > NUM_SLOTS) return;

                const currentMins = clientMinutes.get(target.ci) || 0;
                const maxD = this.getMaxDuration(target.c);
                if (currentMins + (len * SLOT_SIZE) > this.getMaxWeeklyMinutes(target.c)) return;
                if (len * SLOT_SIZE > maxD) return;

                const type: SessionType = `AlliedHealth_${need.type}` as SessionType;
                const serviceRole = need.type; // 'OT' or 'SLP'

                if (tracker.isCFree(target.ci, s, len)) {
                    let selectedTi = -1;

                    // 1. Try preferred provider if they match the role and are free
                    if (need.preferredProviderId) {
                        const ti = this.therapists.findIndex(t => t.id === need.preferredProviderId);
                        if (ti >= 0 && this.therapists[ti].role === serviceRole && tracker.isTFree(ti, s, len)) {
                            selectedTi = ti;
                        }
                    }

                    // 2. Try any other free therapist with the matching role
                    if (selectedTi === -1) {
                        const eligible = this.therapists.map((t, ti) => ({t, ti}))
                            .filter(x => x.t.role === serviceRole && tracker.isTFree(x.ti, s, len))
                            .sort(() => Math.random() - 0.5);
                        if (eligible.length > 0) {
                            selectedTi = eligible[0].ti;
                        }
                    }

                    if (selectedTi !== -1) {
                        schedule.push(this.ent(target.ci, selectedTi, s, len, type));
                        tracker.book(selectedTi, target.ci, s, len);
                        tSessionCount[selectedTi]++;
                    } else {
                        // Fallback: keep unassigned if no eligible therapist is available
                        schedule.push(this.entUnassigned(target.ci, s, len, type));
                        tracker.book(-1, target.ci, s, len);
                    }
                    clientMinutes.set(target.ci, (clientMinutes.get(target.ci) || 0) + (len * SLOT_SIZE));
                }
            });
        });

        // Pass 3: ABA Sessions (Global interleaved approach to ensure fair distribution and gap-free coverage)
        const abaEligibleTherapists = sortedTherapists.filter(x => x.t.role !== 'OT' && x.t.role !== 'SLP');

        // Build team-to-therapist index for efficient same-team lookups
        const teamTherapistIndex = new Map<string, typeof abaEligibleTherapists>();
        abaEligibleTherapists.forEach(x => {
            if (x.t.teamId) {
                if (!teamTherapistIndex.has(x.t.teamId)) teamTherapistIndex.set(x.t.teamId, []);
                teamTherapistIndex.get(x.t.teamId)!.push(x);
            }
        });

        for (let s = 0; s < NUM_SLOTS; s++) {
            // Pre-compute which clients have a free, qualified same-team therapist in this slot
            const clientHasTeamMatch = new Map<number, boolean>();
            shuffledC.forEach(target => {
                if (!target.c.teamId) { clientHasTeamMatch.set(target.ci, false); return; }
                const teammates = teamTherapistIndex.get(target.c.teamId) || [];
                clientHasTeamMatch.set(target.ci, teammates.some(x =>
                    tracker.isTFree(x.ti, s, 1) && this.meetsInsurance(x.t, target.c)
                ));
            });

            // Sort clients: those with available same-team therapists go first to prevent cross-team stealing
            const shuffledClientsForSlot = [...shuffledC].sort((a, b) => {
                const aMatch = clientHasTeamMatch.get(a.ci)!;
                const bMatch = clientHasTeamMatch.get(b.ci)!;
                if (aMatch !== bMatch) return aMatch ? -1 : 1;
                return Math.random() - 0.5;
            });
            shuffledClientsForSlot.forEach(target => {
                if (tracker.isCFree(target.ci, s, 1)) {
                    const quals = abaEligibleTherapists.filter(x => this.meetsInsurance(x.t, target.c)).sort((a, b) => {
                        const clientTeamId = target.c.teamId;
                        const aOnTeam = !!(clientTeamId && a.t.teamId === clientTeamId);
                        const bOnTeam = !!(clientTeamId && b.t.teamId === clientTeamId);

                        // Priority 1: Same team as client
                        if (aOnTeam !== bOnTeam) return aOnTeam ? -1 : 1;

                        if (aOnTeam) {
                            // Both on same team as client:
                            // Sub-priority 1: Already working with this client (Medicaid limit safety)
                            const aIsKnown = tracker.cT[target.ci].has(a.ti) ? 0 : 1;
                            const bIsKnown = tracker.cT[target.ci].has(b.ti) ? 0 : 1;
                            if (aIsKnown !== bIsKnown) return aIsKnown - bIsKnown;

                            // Sub-priority 2: Lower rank first (preserve senior staff time)
                            const aRank = this.getRoleRank(a.t.role);
                            const bRank = this.getRoleRank(b.t.role);
                            if (aRank !== bRank) return aRank - bRank;

                            // Sub-priority 3: Even distribution
                            return (tSessionCount[a.ti] - tSessionCount[b.ti]) + (Math.random() - 0.5) * 2;
                        } else {
                            // Both off-team (or client has no team):
                            // Sub-priority 1: CF role first (preferred off-team fallback)
                            const aIsCF = a.t.role === 'CF';
                            const bIsCF = b.t.role === 'CF';
                            if (aIsCF !== bIsCF) return aIsCF ? -1 : 1;

                            // Sub-priority 2: Already working with this client (experience)
                            const aIsKnown = tracker.cT[target.ci].has(a.ti) ? 0 : 1;
                            const bIsKnown = tracker.cT[target.ci].has(b.ti) ? 0 : 1;
                            if (aIsKnown !== bIsKnown) return aIsKnown - bIsKnown;

                            // Sub-priority 3: Higher rank first for off-team (STAR 3 > STAR 2 > STAR 1 > ...)
                            const aRank = this.getRoleRank(a.t.role);
                            const bRank = this.getRoleRank(b.t.role);
                            if (aRank !== bRank) return bRank - aRank;

                            // Sub-priority 4: Even distribution
                            return (tSessionCount[a.ti] - tSessionCount[b.ti]) + (Math.random() - 0.5) * 2;
                        }
                    });

                    for (const q of quals) {
                        // Check provider limit
                        const maxP = this.getMaxProviders(target.c);
                        if (tracker.cT[target.ci].size >= maxP && !tracker.cT[target.ci].has(q.ti)) continue;

                        // Try session lengths from max down to min required
                        const minLenSlots = Math.ceil(this.getMinDuration(target.c) / SLOT_SIZE);
                        const maxAllowedLenSlots = Math.floor(this.getMaxDuration(target.c) / SLOT_SIZE);
                        const remainingMins = this.getMaxWeeklyMinutes(target.c) - (clientMinutes.get(target.ci) || 0);
                        const remainingSlots = Math.floor(remainingMins / SLOT_SIZE);

                        const startLenSlots = Math.min(maxAllowedLenSlots, remainingSlots);

                        for (let len = startLenSlots; len >= minLenSlots; len--) {
                            if (s + len <= NUM_SLOTS && tracker.isCFree(target.ci, s, len) && tracker.isTFree(q.ti, s, len)) {
                                // Heuristic: Avoid leaving small unfillable gaps (< required min session duration)
                                let gapAfter = 0;
                                let tempS = s + len;
                                while(tempS < NUM_SLOTS && tracker.isCFree(target.ci, tempS, 1)) {
                                    gapAfter++;
                                    tempS++;
                                }
                                if (gapAfter > 0 && gapAfter < minLenSlots) continue;

                                if (this.isBTB(schedule, target.c.id, q.t.id, s, len)) continue;

                                // Final duration safety check
                                if (len * SLOT_SIZE > maxAllowedLenSlots * SLOT_SIZE) continue;

                                schedule.push(this.ent(target.ci, q.ti, s, len, 'ABA'));
                                tracker.book(q.ti, target.ci, s, len);
                                tSessionCount[q.ti]++;
                                clientMinutes.set(target.ci, (clientMinutes.get(target.ci) || 0) + (len * SLOT_SIZE));
                                break;
                            }
                        }
                        if (!tracker.isCFree(target.ci, s, 1)) break;
                    }
                }
            });
        }

        // Filter out lunches for people with no billable work
        return schedule.filter(e => {
            if (e.sessionType !== 'IndirectTime') return true;
            return schedule.some(s =>
                s.therapistId === e.therapistId &&
                (s.sessionType === 'ABA' || s.sessionType.startsWith('AlliedHealth_'))
            );
        });
    }

    private isBTB(s: GeneratedSchedule, cid: string, tid: string, startSlot: number, len: number) {
        const startMin = OP_START + startSlot * SLOT_SIZE;
        const endMin = OP_START + (startSlot + len) * SLOT_SIZE;
        return s.some(x => x.clientId === cid && x.therapistId === tid && (timeToMinutes(x.endTime) === startMin || timeToMinutes(x.startTime) === endMin));
    }

    private ent(ci: number, ti: number, s: number, l: number, type: SessionType): ScheduleEntry {
        const client = ci >= 0 ? this.clients[ci] : null;
        const therapist = this.therapists[ti];
        return { id: generateId(), clientId: client ? client.id : null, clientName: client ? client.name : null, therapistId: therapist.id, therapistName: therapist.name, day: this.day, startTime: minutesToTime(OP_START + s * SLOT_SIZE), endTime: minutesToTime(OP_START + (s + l) * SLOT_SIZE), sessionType: type };
    }

    private entUnassigned(ci: number, s: number, l: number, type: SessionType): ScheduleEntry {
        const client = ci >= 0 ? this.clients[ci] : null;
        return { id: generateId(), clientId: client ? client.id : null, clientName: client ? client.name : null, therapistId: null, therapistName: null, day: this.day, startTime: minutesToTime(OP_START + s * SLOT_SIZE), endTime: minutesToTime(OP_START + (s + l) * SLOT_SIZE), sessionType: type };
    }

    public async run(initialSchedule?: GeneratedSchedule): Promise<GeneratedSchedule> {
        let best: GeneratedSchedule = [];
        let minScore = Infinity;
        // Scale iterations based on problem size - avoid excessive computation
        const problemSize = this.clients.length * this.therapists.length;
        const iterations = problemSize > 500 ? 200 : problemSize > 200 ? 500 : problemSize > 50 ? 1000 : 2000;
        const maxTimeMs = 8000; // Hard time limit of 8 seconds
        const startTime = Date.now();
        let noImprovementCount = 0;
        for (let i = 0; i < iterations; i++) {
            // Yield to the UI thread every 50 iterations to prevent freezing
            if (i > 0 && i % 50 === 0) {
                await new Promise(r => setTimeout(r, 0));
                // Check time limit
                if (Date.now() - startTime > maxTimeMs) break;
            }
            const s = this.createSchedule(initialSchedule);
            const score = this.calculateScore(s, initialSchedule);
            if (score < minScore) {
                best = s;
                minScore = score;
                noImprovementCount = 0;
                if (minScore === 0) break;
            } else {
                noImprovementCount++;
            }
            // Early exit if no improvement for a while (converged)
            if (noImprovementCount > 150) break;
        }
        return best;
    }

    private calculateScore(s: GeneratedSchedule, initialSchedule?: GeneratedSchedule): number {
        const otherDayEntries = initialSchedule ? initialSchedule.filter(e => e.day !== this.day) : [];
        const fullSchedule = [...otherDayEntries, ...s];
        const errs = validateFullSchedule(fullSchedule, this.clients, this.therapists, this.insuranceQualifications, this.selectedDate, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, this.callouts);
        if (errs.length > 0) {
            let p = 10000000; // Higher base penalty for any error
            errs.forEach(e => {
                if (e.ruleId === "CLIENT_COVERAGE_GAP_AT_TIME") p += 100000; // Extremely high penalty for gaps
                else if (e.ruleId === "THERAPIST_TIME_CONFLICT" || e.ruleId === "CLIENT_TIME_CONFLICT") p += 200000;
                else if (e.ruleId === "MAX_PROVIDERS_VIOLATED") p += 500000;
                else if (e.ruleId === "MAX_WEEKLY_HOURS_VIOLATED") p += 500000;
                else if (e.ruleId === "MIN_DURATION_VIOLATED" || e.ruleId === "ABA_DURATION_TOO_SHORT") p += 2000000;
                else if (e.ruleId === "MAX_DURATION_VIOLATED" || e.ruleId === "ABA_DURATION_TOO_LONG") p += 2000000;
                else if (e.ruleId === "MULTIPLE_LUNCHES" || e.ruleId === "LUNCH_OUTSIDE_WINDOW" || e.ruleId === "MISSING_LUNCH_BREAK") p += 1000000;
                else if (e.ruleId === "MAX_NOTES_EXCEEDED") p += 10;
                else p += 1000;
            });
            return p;
        }
        
        let penalty = 0;
        const billableTimes = new Map<string, number>();
        s.forEach(e => {
            if (e.sessionType === 'ABA' || e.sessionType.startsWith('AlliedHealth_')) {
                const dur = timeToMinutes(e.endTime) - timeToMinutes(e.startTime);
                billableTimes.set(e.therapistId, (billableTimes.get(e.therapistId) || 0) + dur);
            }
        });

        const data = this.therapists.map(t => ({ p: this.getRoleRank(t.role), billable: billableTimes.get(t.id) || 0 }));
        for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < data.length; j++) {
                // If therapist i is higher rank (BCBA) than therapist j (BT)
                // but therapist i has MORE billable time than j, penalize.
                // We want to preserve 'blank' time for senior staff.
                if (data[i].p > data[j].p && data[i].billable > data[j].billable) {
                    penalty += (data[i].billable - data[j].billable) * 100;
                }
            }
        }

        // Team alignment penalty: penalize off-team ABA assignments
        s.forEach(e => {
            if (e.clientId && e.therapistId && e.sessionType === 'ABA') {
                const client = this.clients.find(c => c.id === e.clientId);
                const therapist = this.therapists.find(t => t.id === e.therapistId);
                if (client?.teamId && therapist && therapist.teamId !== client.teamId) {
                    const dur = timeToMinutes(e.endTime) - timeToMinutes(e.startTime);
                    penalty += dur * 200; // Heavily penalize each minute of off-team ABA coverage
                }
            }
        });

        return penalty;
    }
}

export async function runCsoAlgorithm(
    clients: Client[],
    therapists: Therapist[],
    insuranceQualifications: InsuranceQualification[],
    selectedDate: Date,
    callouts: Callout[],
    initialScheduleForOptimization?: GeneratedSchedule
): Promise<GAGenerationResult> {
    const day = getDayOfWeekFromDate(selectedDate);
    const algo = new FastScheduler(clients, therapists, insuranceQualifications, day, selectedDate, callouts, initialScheduleForOptimization);
    const schedule = await algo.run(initialScheduleForOptimization);
    const errors = validateFullSchedule(schedule, clients, therapists, insuranceQualifications, selectedDate, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, callouts);
    return { schedule, finalValidationErrors: errors, generations: 0, bestFitness: errors.length, success: errors.length === 0, statusMessage: errors.length === 0 ? "Perfect!" : "Nearly Perfect." };
}
