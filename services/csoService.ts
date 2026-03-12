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

        // Optimization: Pre-sort therapists by role once
        const sortedTherapists = this.therapists.map((t, ti) => ({t, ti})).sort((a, b) => {
            return this.getRoleRank(a.t.role) - this.getRoleRank(b.t.role);
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
        const shuffledT = this.therapists.map((t, ti) => ({t, ti})).sort(() => Math.random() - 0.5);
        const lunchAtSlot: Set<number>[] = new Array(NUM_SLOTS).fill(null).map(() => new Set());

        shuffledT.forEach(q => {
            // Check if already has a lunch or indirect task in the lunch window from initialSchedule
            if (schedule.some(e => e.therapistId === q.t.id && e.sessionType === 'IndirectTime')) return;

            const ls = Math.floor((timeToMinutes(IDEAL_LUNCH_WINDOW_START) - OP_START) / SLOT_SIZE);
            const le = Math.floor((timeToMinutes(IDEAL_LUNCH_WINDOW_END_FOR_START) - OP_START) / SLOT_SIZE);
            const opts: number[] = [];
            for (let s = ls; s <= le; s++) opts.push(s);
            opts.sort((a, b) => (lunchCount[a] + lunchCount[a+1]) - (lunchCount[b] + lunchCount[b+1]) + (Math.random() - 0.5));

            let bestFallback = -1;
            let bestFallbackUncovered = Infinity;

            for (const s of opts) {
                if (!tracker.isTFree(q.ti, s, 2) || lunchCount[s] >= maxConcurrentLunches || lunchCount[s+1] >= maxConcurrentLunches) continue;

                // Coverage check: ensure every client this therapist could serve
                // has at least 1 other qualified therapist NOT on lunch at this slot
                let uncovered = 0;
                let allCovered = true;
                for (let ci = 0; ci < this.clients.length; ci++) {
                    if (!qualMatrix[ci].has(q.ti)) continue;
                    let hasCoverage = false;
                    for (const oti of qualMatrix[ci]) {
                        if (oti === q.ti) continue;
                        if (!lunchAtSlot[s].has(oti) && !lunchAtSlot[s + 1].has(oti)) {
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
        for (let s = 0; s < NUM_SLOTS; s++) {
            const shuffledClientsForSlot = [...shuffledC].sort(() => Math.random() - 0.5);
            shuffledClientsForSlot.forEach(target => {
                if (tracker.isCFree(target.ci, s, 1)) {
                    const quals = abaEligibleTherapists.filter(x => this.meetsInsurance(x.t, target.c)).sort((a, b) => {
                        // Priority 1: Already working with this client (Medicaid limit safety)
                        const aIsKnown = tracker.cT[target.ci].has(a.ti) ? 0 : 1;
                        const bIsKnown = tracker.cT[target.ci].has(b.ti) ? 0 : 1;
                        if (aIsKnown !== bIsKnown) return aIsKnown - bIsKnown;

                        // Priority 2: Same team as client (strict team-first)
                        const clientTeam = target.c.teamId;
                        if (clientTeam) {
                            const aSameTeam = a.t.teamId === clientTeam ? 0 : 1;
                            const bSameTeam = b.t.teamId === clientTeam ? 0 : 1;
                            if (aSameTeam !== bSameTeam) return aSameTeam - bSameTeam;
                        }

                        // Priority 3: Role rank (BT/RBT first for billable work)
                        const aRank = this.getRoleRank(a.t.role);
                        const bRank = this.getRoleRank(b.t.role);
                        if (aRank !== bRank) return aRank - bRank; // Lower rank (BT/RBT) first

                        // Priority 4: Current session count (even distribution among same-tier roles)
                        return (tSessionCount[a.ti] - tSessionCount[b.ti]) + (Math.random() - 0.5) * 2;
                    });

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
                                // Heuristic: Avoid leaving small unfillable gaps (< required min session duration)
                                let gapAfter = 0;
                                let tempS = s + len;
                                while(tempS < NUM_SLOTS && tracker.isCFree(target.ci, tempS, 1)) {
                                    gapAfter++;
                                    tempS++;
                                }
                                // Exempt gaps that contain this therapist's lunch — Pass 4 will fill coverage
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

                // If no existing provider, try any qualified free therapist
                if (coverTi < 0) {
                    for (const x of abaEligibleTherapists) {
                        if (x.ti === ti) continue;
                        if (maxSessions > 0 && tSessionCount[x.ti] >= maxSessions) continue;
                        if (tracker.isTFree(x.ti, lunchStart, lunchLen)
                            && this.meetsInsurance(x.t, this.clients[ci])
                            && !this.isBTB(schedule, this.clients[ci].id, x.t.id, lunchStart, lunchLen)) {
                            coverTi = x.ti;
                            break;
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
        // Scale iterations based on problem size
        const problemSize = this.clients.length * this.therapists.length;
        const iterations = problemSize > 500 ? 5000 : problemSize > 200 ? 10000 : problemSize > 50 ? 20000 : 50000;
        const maxTimeMs = 90000; // Hard time limit of 90 seconds per run
        const startTime = Date.now();
        let noImprovementCount = 0;
        const noImprovementLimit = problemSize > 200 ? 2000 : 3000;
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
            // Early exit if converged
            if (noImprovementCount > noImprovementLimit) break;
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

        // Team consistency penalty: penalize cross-team assignments
        s.forEach(e => {
            if (e.sessionType === 'ABA' || e.sessionType.startsWith('AlliedHealth_')) {
                if (e.clientId && e.therapistId) {
                    const client = this.clients.find(c => c.id === e.clientId);
                    const therapist = this.therapists.find(t => t.id === e.therapistId);
                    if (client?.teamId && therapist?.teamId && client.teamId !== therapist.teamId) {
                        penalty += 500;
                    }
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
    const CONCURRENT_RUNS = 4;
    const MAX_ROUNDS = 10; // Up to 10 rounds of concurrent runs (~15 min max)
    let globalBestSchedule: GeneratedSchedule = [];
    let globalBestScore = Infinity;
    let globalBestErrors: any[] = [];

    for (let round = 0; round < MAX_ROUNDS; round++) {
        const runners = Array.from({ length: CONCURRENT_RUNS }, () => {
            const algo = new FastScheduler(clients, therapists, insuranceQualifications, day, selectedDate, callouts, initialScheduleForOptimization);
            return algo.run(initialScheduleForOptimization);
        });
        const results = await Promise.all(runners);

        for (const schedule of results) {
            const errs = validateFullSchedule(schedule, clients, therapists, insuranceQualifications, selectedDate, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, callouts);
            if (errs.length < globalBestScore) {
                globalBestScore = errs.length;
                globalBestSchedule = schedule;
                globalBestErrors = errs;
            }
        }

        // Stop early if we found a valid schedule
        if (globalBestScore === 0) break;
    }

    return { schedule: globalBestSchedule, finalValidationErrors: globalBestErrors, generations: 0, bestFitness: globalBestErrors.length, success: globalBestErrors.length === 0, statusMessage: globalBestErrors.length === 0 ? "Perfect!" : "Nearly Perfect." };
}
