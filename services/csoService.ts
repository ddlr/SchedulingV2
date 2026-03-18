import { Client, Therapist, GeneratedSchedule, DayOfWeek, Callout, GAGenerationResult, ScheduleEntry, SessionType, InsuranceQualification, TherapistRole } from '../types';
import { COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, IDEAL_LUNCH_WINDOW_START, IDEAL_LUNCH_WINDOW_END_FOR_START, ALL_THERAPIST_ROLES, DEFAULT_ROLE_RANK, getMaxSessionsPerTherapist } from '../constants';
import { validateFullSchedule, timeToMinutes, minutesToTime, sessionsOverlap, isDateAffectedByCalloutRange } from '../utils/validationService';

const SLOT_SIZE = 15;
const OP_START = timeToMinutes(COMPANY_OPERATING_HOURS_START);
const OP_END = timeToMinutes(COMPANY_OPERATING_HOURS_END);
const NUM_SLOTS = (OP_END - OP_START) / SLOT_SIZE;
const IDEAL_SESSION_MIN = 90;  // 1.5 hours
const IDEAL_SESSION_MAX = 150; // 2.5 hours

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

    // Scheduling priority rank: determines assignment order and billable time penalties.
    // CFs are direct-care providers that should be heavily utilized.
    // Rank them between STAR 1 and STAR 2 so they get assigned early
    // and the billable time penalty doesn't discourage filling their schedule.
    private getSchedulingRank(role: string): number {
        if (role === 'CF') return this.getRoleRank('STAR 1') ?? 2;
        return this.getRoleRank(role);
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
        const maxSessions = getMaxSessionsPerTherapist();
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

        // Optimization: Pre-sort therapists by scheduling priority once
        const sortedTherapists = this.therapists.map((t, ti) => ({t, ti})).sort((a, b) => {
            return this.getSchedulingRank(a.t.role) - this.getSchedulingRank(b.t.role);
        });

        // Precompute qualification matrix: for each client, which ABA-eligible therapist indices are qualified
        const qualMatrix: Set<number>[] = this.clients.map((c) => {
            const qualified = new Set<number>();
            this.therapists.forEach((t, ti) => {
                if (t.role !== 'OT' && t.role !== 'SLP' && this.meetsInsurance(t, c)) {
                    qualified.add(ti);
                }
            });
            return qualified;
        });

        // Pass 1: Lunches (coverage-aware staggering)
        // Sort therapists for lunch placement:
        // 1. Role hierarchy (higher-ranked staff first — BCBAs/STAR 3 get first pick
        //    of lunch slots to maximize their indirect time)
        // 2. Coverage criticality (sole/rare qualified providers — tightest constraints)
        // 3. Random tiebreaker
        const therapistCriticality = this.therapists.map((t, ti) => {
            let sole = 0;
            for (let ci = 0; ci < this.clients.length; ci++) {
                if (!qualMatrix[ci].has(ti)) continue;
                if (qualMatrix[ci].size <= 2) sole++; // sole or near-sole provider
            }
            return sole;
        });
        const shuffledT = this.therapists.map((t, ti) => ({t, ti})).sort((a, b) => {
            const rankDiff = this.getSchedulingRank(b.t.role) - this.getSchedulingRank(a.t.role);
            if (rankDiff !== 0) return rankDiff;
            const critDiff = therapistCriticality[b.ti] - therapistCriticality[a.ti];
            if (critDiff !== 0) return critDiff;
            return Math.random() - 0.5;
        });
        const lunchAtSlot: Set<number>[] = new Array(NUM_SLOTS).fill(null).map(() => new Set());

        shuffledT.forEach(q => {
            // Check if already has a lunch or indirect task in the lunch window from initialSchedule
            if (schedule.some(e => e.therapistId === q.t.id && e.sessionType === 'IndirectTime')) return;

            const ls = Math.floor((timeToMinutes(IDEAL_LUNCH_WINDOW_START) - OP_START) / SLOT_SIZE);
            const le = Math.floor((timeToMinutes(IDEAL_LUNCH_WINDOW_END_FOR_START) - OP_START) / SLOT_SIZE);
            const opts: number[] = [];
            for (let s = ls; s <= le; s++) opts.push(s);
            opts.sort((a, b) => {
                const baseA = lunchCount[a] + lunchCount[a+1];
                const baseB = lunchCount[b] + lunchCount[b+1];
                // Penalize slots where same-team therapists are already on lunch
                let teamA = 0, teamB = 0;
                if (q.t.teamId) {
                    for (const oti of lunchAtSlot[a]) {
                        if (this.therapists[oti].teamId === q.t.teamId) teamA++;
                    }
                    if (a + 1 < NUM_SLOTS) for (const oti of lunchAtSlot[a + 1]) {
                        if (this.therapists[oti].teamId === q.t.teamId) teamA++;
                    }
                    for (const oti of lunchAtSlot[b]) {
                        if (this.therapists[oti].teamId === q.t.teamId) teamB++;
                    }
                    if (b + 1 < NUM_SLOTS) for (const oti of lunchAtSlot[b + 1]) {
                        if (this.therapists[oti].teamId === q.t.teamId) teamB++;
                    }
                }
                return (baseA + teamA * 3) - (baseB + teamB * 3) + (Math.random() - 0.5);
            });

            let bestFallback = -1;
            let bestFallbackUncovered = Infinity;

            for (const s of opts) {
                if (!tracker.isTFree(q.ti, s, 2) || lunchCount[s] >= maxConcurrentLunches || lunchCount[s+1] >= maxConcurrentLunches) continue;

                // Coverage check: ensure every client this therapist could serve
                // has at least 1 other qualified, available, preferably same-team therapist
                // NOT on lunch at this slot
                let uncovered = 0;
                let allCovered = true;
                for (let ci = 0; ci < this.clients.length; ci++) {
                    if (!qualMatrix[ci].has(q.ti)) continue;
                    let hasCoverage = false;
                    for (const oti of qualMatrix[ci]) {
                        if (oti === q.ti) continue;
                        // Must not be on lunch AND must actually be free at this slot
                        if (!lunchAtSlot[s].has(oti) && !lunchAtSlot[s + 1].has(oti)
                            && tracker.isTFree(oti, s, 1) && tracker.isTFree(oti, s + 1, 1)) {
                            hasCoverage = true;
                            break;
                        }
                    }
                    if (!hasCoverage) { allCovered = false; uncovered++; }
                }

                if (allCovered) {
                    schedule.push(this.ent(-1, q.ti, s, 2, 'IndirectTime'));
                    tracker.book(q.ti, -1, s, 2);
                    lunchCount[s]++; lunchCount[s+1]++;
                    lunchAtSlot[s].add(q.ti); lunchAtSlot[s + 1].add(q.ti);
                    return;
                }
                if (uncovered < bestFallbackUncovered) {
                    bestFallbackUncovered = uncovered;
                    bestFallback = s;
                }
            }

            // Fallback: no perfect slot, use the one with fewest uncovered clients
            if (bestFallback >= 0) {
                const s = bestFallback;
                schedule.push(this.ent(-1, q.ti, s, 2, 'IndirectTime'));
                tracker.book(q.ti, -1, s, 2);
                lunchCount[s]++; lunchCount[s+1]++;
                lunchAtSlot[s].add(q.ti); lunchAtSlot[s + 1].add(q.ti);
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
                        if (ti >= 0 && this.therapists[ti].role === serviceRole && tracker.isTFree(ti, s, len)
                            && !(maxSessions > 0 && tSessionCount[ti] >= maxSessions)) {
                            selectedTi = ti;
                        }
                    }

                    // 2. Try any other free therapist with the matching role
                    if (selectedTi === -1) {
                        const eligible = this.therapists.map((t, ti) => ({t, ti}))
                            .filter(x => x.t.role === serviceRole && tracker.isTFree(x.ti, s, len)
                                && !(maxSessions > 0 && tSessionCount[x.ti] >= maxSessions))
                            .sort(() => Math.random() - 0.5);
                        if (eligible.length > 0) {
                            selectedTi = eligible[0].ti;
                        }
                    }

                    if (selectedTi !== -1) {
                        schedule.push(this.ent(target.ci, selectedTi, s, len, type));
                        tracker.book(selectedTi, target.ci, s, len);
                        tSessionCount[selectedTi]++;
                        clientMinutes.set(target.ci, (clientMinutes.get(target.ci) || 0) + (len * SLOT_SIZE));
                    }
                    // Skip if no eligible therapist — don't create unassigned allied health sessions
                }
            });
        });

        // Pass 3: ABA Sessions (Global interleaved approach to ensure fair distribution and gap-free coverage)
        // Build lunch slot lookup for gap heuristic exemption
        const therapistLunchStart = new Array(this.therapists.length).fill(-1);
        schedule.forEach(e => {
            if (e.sessionType === 'IndirectTime') {
                const ti = this.therapists.findIndex(t => t.id === e.therapistId);
                if (ti >= 0) {
                    therapistLunchStart[ti] = Math.floor((timeToMinutes(e.startTime) - OP_START) / SLOT_SIZE);
                }
            }
        });

        const abaEligibleTherapists = sortedTherapists.filter(x => x.t.role !== 'OT' && x.t.role !== 'SLP');
        // Randomize slot order to avoid systematic morning bias
        const slotOrder = Array.from({length: NUM_SLOTS}, (_, i) => i);
        for (let i = slotOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [slotOrder[i], slotOrder[j]] = [slotOrder[j], slotOrder[i]];
        }
        for (const s of slotOrder) {
            const shuffledClientsForSlot = [...shuffledC].sort(() => Math.random() - 0.5);
            shuffledClientsForSlot.forEach(target => {
                if (tracker.isCFree(target.ci, s, 1)) {
                    const quals = abaEligibleTherapists.filter(x => this.meetsInsurance(x.t, target.c)).sort((a, b) => {
                        const clientTeam = target.c.teamId;
                        const aSameTeam = clientTeam ? (a.t.teamId === clientTeam ? true : false) : true;
                        const bSameTeam = clientTeam ? (b.t.teamId === clientTeam ? true : false) : true;

                        // Priority 1: Same team as client (strongest preference)
                        if (aSameTeam !== bSameTeam) return aSameTeam ? -1 : 1;

                        // If both are cross-team, prefer higher-ranked staff (STAR 3 first)
                        // Lower-ranked staff (STAR 1, BT, RBT) should rarely take cross-team clients
                        if (!aSameTeam && !bSameTeam) {
                            const aRank = this.getSchedulingRank(a.t.role);
                            const bRank = this.getSchedulingRank(b.t.role);
                            if (aRank !== bRank) return bRank - aRank; // Higher rank first for cross-team
                        }

                        // Priority 2: Already working with this client (Medicaid limit safety)
                        const aIsKnown = tracker.cT[target.ci].has(a.ti) ? 0 : 1;
                        const bIsKnown = tracker.cT[target.ci].has(b.ti) ? 0 : 1;
                        if (aIsKnown !== bIsKnown) return aIsKnown - bIsKnown;

                        // Priority 3: Role rank (BT/RBT/CF first for billable work)
                        const aRank = this.getSchedulingRank(a.t.role);
                        const bRank = this.getSchedulingRank(b.t.role);
                        if (aRank !== bRank) return aRank - bRank; // Lower rank (BT/RBT) first

                        // Priority 4: Current session count (even distribution among same-tier roles)
                        return (tSessionCount[a.ti] - tSessionCount[b.ti]) + (Math.random() - 0.5) * 2;
                    });

                    // Two-phase assignment: Phase 1 with gap heuristic, Phase 2 without
                    for (let phase = 0; phase < 2; phase++) {
                        if (phase === 1 && !tracker.isCFree(target.ci, s, 1)) break; // already filled in phase 0
                        for (const q of quals) {
                        // Check max sessions per therapist cap
                        if (maxSessions > 0 && tSessionCount[q.ti] >= maxSessions) continue;

                        // Check provider limit
                        const maxP = this.getMaxProviders(target.c);
                        if (tracker.cT[target.ci].size >= maxP && !tracker.cT[target.ci].has(q.ti)) continue;

                        // Try session lengths: prefer ideal range (1.5-2.5h), then fallback to longer
                        const minLenSlots = Math.ceil(this.getMinDuration(target.c) / SLOT_SIZE);
                        const maxAllowedLenSlots = Math.floor(this.getMaxDuration(target.c) / SLOT_SIZE);
                        const remainingMins = this.getMaxWeeklyMinutes(target.c) - (clientMinutes.get(target.ci) || 0);
                        const remainingSlots = Math.floor(remainingMins / SLOT_SIZE);

                        const capSlots = Math.min(maxAllowedLenSlots, remainingSlots);
                        const idealMaxSlots = Math.min(Math.floor(IDEAL_SESSION_MAX / SLOT_SIZE), capSlots);
                        // Build ordered length list: ideal range (longest first), then longer fallback
                        const lengthsToTry: number[] = [];
                        for (let l = idealMaxSlots; l >= minLenSlots; l--) lengthsToTry.push(l);
                        for (let l = capSlots; l > idealMaxSlots; l--) lengthsToTry.push(l);

                        for (const len of lengthsToTry) {
                            if (s + len <= NUM_SLOTS && tracker.isCFree(target.ci, s, len) && tracker.isTFree(q.ti, s, len)) {
                                // Gap heuristic (Phase 0 only): Avoid leaving small unfillable gaps
                                if (phase === 0) {
                                    let gapAfter = 0;
                                    let tempS = s + len;
                                    while(tempS < NUM_SLOTS && tracker.isCFree(target.ci, tempS, 1)) {
                                        gapAfter++;
                                        tempS++;
                                    }
                                    const gapStartSlot = s + len;
                                    const gapEndSlot = gapStartSlot + gapAfter;
                                    const myLunch = therapistLunchStart[q.ti];
                                    let gapIsMyLunch = false;
                                    if (myLunch >= 0 && myLunch >= gapStartSlot && myLunch + 2 <= gapEndSlot) {
                                        const preLunchFree = myLunch - gapStartSlot;
                                        const postLunchFree = gapEndSlot - (myLunch + 2);
                                        gapIsMyLunch = (preLunchFree === 0 || preLunchFree >= minLenSlots)
                                                    && (postLunchFree === 0 || postLunchFree >= minLenSlots);
                                    }
                                    if (gapAfter > 0 && gapAfter < minLenSlots && !gapIsMyLunch) continue;
                                }

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
                        // Pseudo-split: allow short ABA adjacent to AlliedHealth at edge of day
                        if (tracker.isCFree(target.ci, s, 1)) {
                            let maxFreeLen = 0;
                            while (s + maxFreeLen < NUM_SLOTS && tracker.isCFree(target.ci, s + maxFreeLen, 1)) maxFreeLen++;

                            if (maxFreeLen > 0 && maxFreeLen < minLenSlots) {
                                const blockSlot = s + maxFreeLen;
                                const isBlockedByAH = blockSlot < NUM_SLOTS && schedule.some(e =>
                                    e.clientId === target.c.id &&
                                    e.sessionType.startsWith('AlliedHealth_') &&
                                    timeToMinutes(e.startTime) === OP_START + blockSlot * SLOT_SIZE
                                );
                                const isAfterAH = s > 0 && schedule.some(e =>
                                    e.clientId === target.c.id &&
                                    e.sessionType.startsWith('AlliedHealth_') &&
                                    timeToMinutes(e.endTime) === OP_START + s * SLOT_SIZE
                                );

                                const isStartEdge = s === 0 || !tracker.isCFree(target.ci, s - 1, 1);
                                const isEndEdge = s + maxFreeLen >= NUM_SLOTS;

                                if ((isBlockedByAH && isStartEdge) || (isAfterAH && isEndEdge)) {
                                    if (tracker.isTFree(q.ti, s, maxFreeLen) && !this.isBTB(schedule, target.c.id, q.t.id, s, maxFreeLen)) {
                                        schedule.push(this.ent(target.ci, q.ti, s, maxFreeLen, 'ABA'));
                                        tracker.book(q.ti, target.ci, s, maxFreeLen);
                                        tSessionCount[q.ti]++;
                                        clientMinutes.set(target.ci, (clientMinutes.get(target.ci) || 0) + (maxFreeLen * SLOT_SIZE));
                                    }
                                }
                            }
                        }
                        if (!tracker.isCFree(target.ci, s, 1)) break;
                    }
                    if (!tracker.isCFree(target.ci, s, 1)) break; // exit phase loop if covered
                    }
                }
            });
        }

        // Pass 4: Fill lunch-time coverage gaps with handoff sessions
        // Iterate each therapist's lunch and check if their assigned clients need coverage
        const lunchLen = 2;
        for (let ti = 0; ti < this.therapists.length; ti++) {
            const lunchStart = therapistLunchStart[ti];
            if (lunchStart < 0) continue;

            for (let ci = 0; ci < this.clients.length; ci++) {
                if (!tracker.cT[ci].has(ti)) continue; // only clients this therapist works with
                if (!tracker.isCFree(ci, lunchStart, lunchLen)) continue; // client already covered

                // Find a cover therapist: prefer existing providers first
                let coverTi = -1;
                for (const existingTi of tracker.cT[ci]) {
                    if (existingTi === ti) continue;
                    if (maxSessions > 0 && tSessionCount[existingTi] >= maxSessions) continue;
                    if (tracker.isTFree(existingTi, lunchStart, lunchLen)
                        && this.meetsInsurance(this.therapists[existingTi], this.clients[ci])
                        && !this.isBTB(schedule, this.clients[ci].id, this.therapists[existingTi].id, lunchStart, lunchLen)) {
                        coverTi = existingTi;
                        break;
                    }
                }

                // If no existing provider, try any qualified free therapist — prefer same team
                if (coverTi < 0) {
                    const maxP = this.getMaxProviders(this.clients[ci]);
                    // Skip if adding a new provider would exceed max providers
                    if (tracker.cT[ci].size < maxP) {
                        const clientTeam = this.clients[ci].teamId;
                        const candidates = abaEligibleTherapists
                            .filter(x => x.ti !== ti
                                && !(maxSessions > 0 && tSessionCount[x.ti] >= maxSessions)
                                && tracker.isTFree(x.ti, lunchStart, lunchLen)
                                && this.meetsInsurance(x.t, this.clients[ci])
                                && !this.isBTB(schedule, this.clients[ci].id, x.t.id, lunchStart, lunchLen))
                            .sort((a, b) => {
                                // Prefer same team as client
                                const aSame = clientTeam && a.t.teamId === clientTeam ? 0 : 1;
                                const bSame = clientTeam && b.t.teamId === clientTeam ? 0 : 1;
                                if (aSame !== bSame) return aSame - bSame;
                                // Then prefer lower rank (BT/RBT first for billable)
                                return this.getSchedulingRank(a.t.role) - this.getSchedulingRank(b.t.role);
                            });
                        if (candidates.length > 0) {
                            coverTi = candidates[0].ti;
                        }
                    }
                }

                if (coverTi >= 0) {
                    schedule.push(this.ent(ci, coverTi, lunchStart, lunchLen, 'ABA'));
                    tracker.book(coverTi, ci, lunchStart, lunchLen);
                    clientMinutes.set(ci, (clientMinutes.get(ci) || 0) + (lunchLen * SLOT_SIZE));
                }
            }
        }

        // Pass 5: Coverage gap repair — scan for uncovered client slots and try to fill them
        for (let ci = 0; ci < this.clients.length; ci++) {
            const c = this.clients[ci];
            const minLenSlots = Math.ceil(this.getMinDuration(c) / SLOT_SIZE);
            const maxLenSlots = Math.floor(this.getMaxDuration(c) / SLOT_SIZE);
            const maxP = this.getMaxProviders(c);

            // Find uncovered slots (not booked by ABA or AlliedHealth)
            for (let s = 0; s < NUM_SLOTS; s++) {
                if (!tracker.isCFree(ci, s, 1)) continue; // already covered

                // Find the extent of this gap
                let gapEnd = s + 1;
                while (gapEnd < NUM_SLOTS && tracker.isCFree(ci, gapEnd, 1)) gapEnd++;
                const gapLen = gapEnd - s;

                // Strategy 1: Extend an adjacent session to cover the gap
                let filled = false;
                for (const e of schedule) {
                    if (e.clientId !== c.id || e.sessionType !== 'ABA') continue;
                    const eStart = Math.floor((timeToMinutes(e.startTime) - OP_START) / SLOT_SIZE);
                    const eEnd = Math.ceil((timeToMinutes(e.endTime) - OP_START) / SLOT_SIZE);
                    const eDur = eEnd - eStart;
                    const ti = this.therapists.findIndex(t => t.id === e.therapistId);
                    if (ti < 0) continue;

                    // Can extend forward? (session ends where gap starts)
                    if (eEnd === s) {
                        const extendBy = Math.min(gapLen, maxLenSlots - eDur);
                        const remainingMins = this.getMaxWeeklyMinutes(c) - (clientMinutes.get(ci) || 0);
                        const maxExtendByWeekly = Math.floor(remainingMins / SLOT_SIZE);
                        const actualExtend = Math.min(extendBy, maxExtendByWeekly);
                        if (actualExtend > 0 && tracker.isTFree(ti, s, actualExtend)) {
                            e.endTime = minutesToTime(OP_START + (eEnd + actualExtend) * SLOT_SIZE);
                            tracker.book(ti, ci, s, actualExtend);
                            clientMinutes.set(ci, (clientMinutes.get(ci) || 0) + (actualExtend * SLOT_SIZE));
                            filled = true;
                            break;
                        }
                    }
                    // Can extend backward? (session starts where gap ends)
                    if (eStart === gapEnd) {
                        const extendBy = Math.min(gapLen, maxLenSlots - eDur);
                        const remainingMins = this.getMaxWeeklyMinutes(c) - (clientMinutes.get(ci) || 0);
                        const maxExtendByWeekly = Math.floor(remainingMins / SLOT_SIZE);
                        const actualExtend = Math.min(extendBy, maxExtendByWeekly);
                        const extendStart = gapEnd - actualExtend;
                        if (actualExtend > 0 && tracker.isTFree(ti, extendStart, actualExtend)
                            && !this.isBTB(schedule, c.id, e.therapistId!, extendStart, eDur + actualExtend)) {
                            e.startTime = minutesToTime(OP_START + extendStart * SLOT_SIZE);
                            tracker.book(ti, ci, extendStart, actualExtend);
                            clientMinutes.set(ci, (clientMinutes.get(ci) || 0) + (actualExtend * SLOT_SIZE));
                            filled = true;
                            break;
                        }
                    }
                }

                // Strategy 2: Assign a new session from an existing or same-team therapist
                if (!filled && gapLen >= minLenSlots) {
                    const clientTeam = c.teamId;
                    const candidates = abaEligibleTherapists
                        .filter(x => this.meetsInsurance(x.t, c)
                            && !(maxSessions > 0 && tSessionCount[x.ti] >= maxSessions)
                            && (tracker.cT[ci].has(x.ti) || tracker.cT[ci].size < maxP))
                        .sort((a, b) => {
                            // Prefer existing providers
                            const aKnown = tracker.cT[ci].has(a.ti) ? 0 : 1;
                            const bKnown = tracker.cT[ci].has(b.ti) ? 0 : 1;
                            if (aKnown !== bKnown) return aKnown - bKnown;
                            // Prefer same team
                            const aSame = clientTeam && a.t.teamId === clientTeam ? 0 : 1;
                            const bSame = clientTeam && b.t.teamId === clientTeam ? 0 : 1;
                            return aSame - bSame;
                        });

                    const sessionLen = Math.min(gapLen, maxLenSlots);
                    const remainingMins = this.getMaxWeeklyMinutes(c) - (clientMinutes.get(ci) || 0);
                    const cappedLen = Math.min(sessionLen, Math.floor(remainingMins / SLOT_SIZE));

                    if (cappedLen >= minLenSlots) {
                        for (const q of candidates) {
                            if (tracker.isTFree(q.ti, s, cappedLen)
                                && !this.isBTB(schedule, c.id, q.t.id, s, cappedLen)) {
                                schedule.push(this.ent(ci, q.ti, s, cappedLen, 'ABA'));
                                tracker.book(q.ti, ci, s, cappedLen);
                                tSessionCount[q.ti]++;
                                clientMinutes.set(ci, (clientMinutes.get(ci) || 0) + (cappedLen * SLOT_SIZE));
                                filled = true;
                                break;
                            }
                        }
                    }
                }

                // Strategy 3: Fill short gaps (< minDuration) with extensions only
                // (Already handled by Strategy 1 above)

                // Skip past this gap for the next iteration
                s = gapEnd - 1;
            }
        }

        // Pass 5b: Session extension — grow short ABA sessions toward ideal minimum
        for (const e of schedule) {
            if (e.sessionType !== 'ABA' || !e.clientId) continue;
            const ci = this.clients.findIndex(c => c.id === e.clientId);
            if (ci < 0) continue;
            const ti = this.therapists.findIndex(t => t.id === e.therapistId);
            if (ti < 0) continue;

            const eStart = Math.floor((timeToMinutes(e.startTime) - OP_START) / SLOT_SIZE);
            const eEnd = Math.ceil((timeToMinutes(e.endTime) - OP_START) / SLOT_SIZE);
            const dur = eEnd - eStart;
            const idealMinSlots = Math.ceil(IDEAL_SESSION_MIN / SLOT_SIZE);
            if (dur >= idealMinSlots) continue; // already long enough

            const maxLenSlots = Math.floor(this.getMaxDuration(this.clients[ci]) / SLOT_SIZE);
            const remainingMins = this.getMaxWeeklyMinutes(this.clients[ci]) - (clientMinutes.get(ci) || 0);
            const maxExtend = Math.min(idealMinSlots - dur, maxLenSlots - dur, Math.floor(remainingMins / SLOT_SIZE));

            // Try extending forward
            let extended = 0;
            for (let x = 0; x < maxExtend; x++) {
                const slot = eEnd + x;
                if (slot >= NUM_SLOTS) break;
                if (!tracker.isCFree(ci, slot, 1) || !tracker.isTFree(ti, slot, 1)) break;
                extended++;
            }
            if (extended > 0) {
                e.endTime = minutesToTime(OP_START + (eEnd + extended) * SLOT_SIZE);
                tracker.book(ti, ci, eEnd, extended);
                clientMinutes.set(ci, (clientMinutes.get(ci) || 0) + (extended * SLOT_SIZE));
            }
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
        const iterations = problemSize > 500 ? 1000 : problemSize > 200 ? 2500 : problemSize > 50 ? 5000 : 10000;
        const maxTimeMs = 60000; // Hard time limit of 60 seconds
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

        const data = this.therapists.map(t => ({ p: this.getSchedulingRank(t.role), billable: billableTimes.get(t.id) || 0 }));
        for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < data.length; j++) {
                // If therapist i is higher rank (BCBA) than therapist j (BT)
                // but therapist i has MORE billable time than j, penalize.
                // We want to maximize indirect time for senior staff per the hierarchy.
                // Scale penalty by rank gap so BCBA vs BT is much stronger than STAR 2 vs STAR 1.
                if (data[i].p > data[j].p && data[i].billable > data[j].billable) {
                    const rankGap = data[i].p - data[j].p;
                    penalty += (data[i].billable - data[j].billable) * rankGap * 300;
                }
            }
        }

        // Session duration preference: penalize ABA sessions outside ideal 1.5-2.5h range
        s.forEach(e => {
            if (e.sessionType === 'ABA') {
                const dur = timeToMinutes(e.endTime) - timeToMinutes(e.startTime);
                if (dur > IDEAL_SESSION_MAX) {
                    // Stronger penalty the further over 2.5h — discourage long sessions
                    penalty += (dur - IDEAL_SESSION_MAX) * 10;
                } else if (dur < IDEAL_SESSION_MIN) {
                    // Mild penalty for short sessions (handoffs, edge cases are okay)
                    penalty += (IDEAL_SESSION_MIN - dur) * 2;
                }
            }
        });

        // Team consistency penalty: penalize cross-team assignments based on therapist role.
        // STAR 3 staff are expected to handle cross-team clients; lower roles should rarely do so.
        s.forEach(e => {
            if (e.sessionType === 'ABA' || e.sessionType.startsWith('AlliedHealth_')) {
                if (e.clientId && e.therapistId) {
                    const client = this.clients.find(c => c.id === e.clientId);
                    const therapist = this.therapists.find(t => t.id === e.therapistId);
                    if (client?.teamId && therapist?.teamId && client.teamId !== therapist.teamId) {
                        const rank = this.getSchedulingRank(therapist.role);
                        const star3Rank = this.getRoleRank('STAR 3') ?? 4;
                        if (rank >= star3Rank) {
                            // STAR 3 or above: moderate penalty (cross-team is acceptable but not ideal)
                            penalty += 3000;
                        } else {
                            // Below STAR 3: very heavy penalty (cross-team should be rare)
                            penalty += 15000;
                        }
                    }
                }
            }
        });

        // Lunch distribution penalty: penalize clustering of lunches at the same slot
        // Well-staggered lunches maintain better client coverage throughout the day
        const lunchSlotCounts = new Map<number, number>();
        s.forEach(e => {
            if (e.sessionType === 'IndirectTime') {
                const slot = Math.floor((timeToMinutes(e.startTime) - OP_START) / SLOT_SIZE);
                lunchSlotCounts.set(slot, (lunchSlotCounts.get(slot) || 0) + 1);
                lunchSlotCounts.set(slot + 1, (lunchSlotCounts.get(slot + 1) || 0) + 1);
            }
        });
        for (const count of lunchSlotCounts.values()) {
            if (count > 1) {
                // Quadratic penalty: 2 overlapping = 200, 3 = 900, etc.
                penalty += (count - 1) * (count - 1) * 200;
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
    const algo = new FastScheduler(clients, therapists, insuranceQualifications, day, selectedDate, callouts, initialScheduleForOptimization);
    const schedule = await algo.run(initialScheduleForOptimization);
    const errors = validateFullSchedule(schedule, clients, therapists, insuranceQualifications, selectedDate, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, callouts);
    return { schedule, finalValidationErrors: errors, generations: 0, bestFitness: errors.length, success: errors.length === 0, statusMessage: errors.length === 0 ? "Perfect!" : "Nearly Perfect." };
}
