import { Client, Therapist, GeneratedSchedule, DayOfWeek, Callout, GAGenerationResult, ScheduleEntry, SessionType, InsuranceQualification, TherapistRole } from '../types';
import { COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, IDEAL_LUNCH_WINDOW_START, IDEAL_LUNCH_WINDOW_END_FOR_START, ALL_THERAPIST_ROLES, DEFAULT_ROLE_RANK } from '../constants';
import { validateFullSchedule, timeToMinutes, minutesToTime, sessionsOverlap, isDateAffectedByCalloutRange } from '../utils/validationService';
import { solveWithCloudSolver } from './solverClientService';

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

    // Returns team fallback tier (lower = preferred):
    // 0: same-team non-BCBA, 1: cross-team non-BCBA (CF→STAR3→STAR2→STAR1→RBT),
    // 2: same-team BCBA, 3: cross-team BCBA, 99: ineligible (BT never cross-team)
    private getTeamTier(t: Therapist, clientTeamId: string): number {
        const sameTeam = t.teamId === clientTeamId;
        const isBCBA = t.role === 'BCBA';
        if (sameTeam && !isBCBA) return 0;
        if (!sameTeam && !isBCBA) {
            if (t.role === 'BT') return 99; // BTs never take cross-team clients
            return 1;
        }
        if (sameTeam && isBCBA) return 2;
        return 3;
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

        // Pass 3: ABA Sessions — two-pass approach to protect team assignments
        // Pass 3a: Same-team only (tier 0) — reserves team therapists for their own clients
        // Pass 3b: Cross-team fallback (tiers 1-3) — fills remaining gaps
        const abaEligibleTherapists = sortedTherapists.filter(x => x.t.role !== 'OT' && x.t.role !== 'SLP');

        const tryAssignSlot = (target: {c: Client; ci: number}, s: number, pool: typeof abaEligibleTherapists) => {
            if (!tracker.isCFree(target.ci, s, 1)) return;

            const quals = pool.filter(x => this.meetsInsurance(x.t, target.c)).sort((a, b) => {
                const aIsKnown = tracker.cT[target.ci].has(a.ti) ? 0 : 1;
                const bIsKnown = tracker.cT[target.ci].has(b.ti) ? 0 : 1;
                if (aIsKnown !== bIsKnown) return aIsKnown - bIsKnown;
                const aRank = this.getRoleRank(a.t.role);
                const bRank = this.getRoleRank(b.t.role);
                if (aRank !== bRank) return aRank - bRank;
                return (tSessionCount[a.ti] - tSessionCount[b.ti]) + (Math.random() - 0.5) * 2;
            });

            for (const q of quals) {
                const maxP = this.getMaxProviders(target.c);
                if (tracker.cT[target.ci].size >= maxP && !tracker.cT[target.ci].has(q.ti)) continue;

                const minLenSlots = Math.ceil(this.getMinDuration(target.c) / SLOT_SIZE);
                const maxAllowedLenSlots = Math.floor(this.getMaxDuration(target.c) / SLOT_SIZE);
                const remainingMins = this.getMaxWeeklyMinutes(target.c) - (clientMinutes.get(target.ci) || 0);
                const remainingSlots = Math.floor(remainingMins / SLOT_SIZE);
                const startLenSlots = Math.min(maxAllowedLenSlots, remainingSlots);

                for (let len = startLenSlots; len >= minLenSlots; len--) {
                    if (s + len <= NUM_SLOTS && tracker.isCFree(target.ci, s, len) && tracker.isTFree(q.ti, s, len)) {
                        let gapAfter = 0;
                        let tempS = s + len;
                        while (tempS < NUM_SLOTS && tracker.isCFree(target.ci, tempS, 1)) { gapAfter++; tempS++; }
                        if (gapAfter > 0 && gapAfter < minLenSlots) continue;
                        if (this.isBTB(schedule, target.c.id, q.t.id, s, len)) continue;
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
        };

        // Pass 3a: Same-team only — each client can only use their own team's non-BCBA staff
        for (let s = 0; s < NUM_SLOTS; s++) {
            const shuffledClientsForSlot = [...shuffledC].sort(() => Math.random() - 0.5);
            shuffledClientsForSlot.forEach(target => {
                const cTeam = target.c.teamId;
                if (!cTeam) return; // no team — handled in 3b
                const sameTeamPool = abaEligibleTherapists.filter(x => x.t.teamId === cTeam && x.t.role !== 'BCBA');
                tryAssignSlot(target, s, sameTeamPool);
            });
        }

        // Pass 3b: Cross-team fallback — fill remaining gaps using tiered hierarchy
        for (let s = 0; s < NUM_SLOTS; s++) {
            const shuffledClientsForSlot = [...shuffledC].sort(() => Math.random() - 0.5);
            shuffledClientsForSlot.forEach(target => {
                if (!tracker.isCFree(target.ci, s, 1)) return;
                const cTeam = target.c.teamId;

                // Build fallback pool: exclude tier 99 (BTs never cross-team)
                let fallbackPool = abaEligibleTherapists.filter(x => this.meetsInsurance(x.t, target.c));
                if (cTeam) {
                    fallbackPool = fallbackPool.filter(x => this.getTeamTier(x.t, cTeam) < 99);
                    fallbackPool.sort((a, b) => {
                        const aTier = this.getTeamTier(a.t, cTeam);
                        const bTier = this.getTeamTier(b.t, cTeam);
                        if (aTier !== bTier) return aTier - bTier;
                        // Within cross-team non-BCBA (tier 1): CF > STAR 3 > STAR 2 > STAR 1 > RBT
                        if (aTier === 1) {
                            const diff = this.getRoleRank(b.t.role) - this.getRoleRank(a.t.role);
                            if (diff !== 0) return diff;
                        }
                        return 0;
                    });
                }
                tryAssignSlot(target, s, fallbackPool);
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
        const maxTimeMs = 30000; // 30 second time limit
        const startTime = Date.now();
        let noImprovementCount = 0;
        for (let i = 0; ; i++) {
            // Yield to the UI thread every 50 iterations to prevent freezing
            if (i > 0 && i % 50 === 0) {
                await new Promise(r => setTimeout(r, 0));
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
            // Early exit if no improvement for 500 iterations (converged)
            if (noImprovementCount > 500) break;
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

        // Tiered off-team penalty: cross-team BCBA penalized more than cross-team non-BCBA
        const therapistMap = new Map(this.therapists.map(t => [t.id, t]));
        const clientMap = new Map(this.clients.map(c => [c.id, c]));
        s.forEach(e => {
            if (e.sessionType === 'ABA' && e.clientId && e.therapistId) {
                const client = clientMap.get(e.clientId);
                const therapist = therapistMap.get(e.therapistId);
                if (client?.teamId && therapist) {
                    const tier = this.getTeamTier(therapist, client.teamId);
                    if (tier > 0) {
                        const dur = timeToMinutes(e.endTime) - timeToMinutes(e.startTime);
                        // Tier 1 (cross-team non-BCBA): 300/min, Tier 2 (same-team BCBA): 500/min, Tier 3 (cross-team BCBA): 1000/min
                        const weight = tier === 1 ? 300 : tier === 2 ? 500 : 1000;
                        penalty += dur * weight;
                    }
                }
            }
        });

        const data = this.therapists.map(t => ({ p: this.getRoleRank(t.role), billable: billableTimes.get(t.id) || 0 }));
        for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < data.length; j++) {
                if (data[i].p > data[j].p && data[i].billable > data[j].billable) {
                    penalty += (data[i].billable - data[j].billable) * 100;
                }
            }
        }
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

    // Try cloud CP-SAT solver first
    try {
        const cloudResult = await solveWithCloudSolver(
            clients, therapists, insuranceQualifications,
            selectedDate, day, callouts, initialScheduleForOptimization
        );
        if (cloudResult && cloudResult.schedule) {
            // Re-validate client-side (safety net — authoritative validation)
            const errors = validateFullSchedule(
                cloudResult.schedule, clients, therapists,
                insuranceQualifications, selectedDate,
                COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END,
                callouts
            );
            return {
                ...cloudResult,
                finalValidationErrors: errors,
                success: errors.length === 0,
                statusMessage: errors.length === 0
                    ? cloudResult.statusMessage
                    : `Cloud solver completed with ${errors.length} validation issue(s). ${cloudResult.statusMessage}`,
            };
        }
    } catch (e) {
        console.warn('Cloud solver unavailable, falling back to local scheduler:', e);
    }

    // Fall back to local greedy scheduler
    const algo = new FastScheduler(clients, therapists, insuranceQualifications, day, selectedDate, callouts, initialScheduleForOptimization);
    const schedule = await algo.run(initialScheduleForOptimization);
    const errors = validateFullSchedule(schedule, clients, therapists, insuranceQualifications, selectedDate, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, callouts);
    return { schedule, finalValidationErrors: errors, generations: 0, bestFitness: errors.length, success: errors.length === 0, statusMessage: errors.length === 0 ? "Perfect! (local)" : "Nearly Perfect. (local)" };
}
