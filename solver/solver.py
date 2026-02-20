"""CP-SAT model builder for ABA scheduling optimization."""

import os
import uuid
import logging
from ortools.sat.python import cp_model

from models import (
    SolveRequest, SolveResponse, ScheduleEntry,
    Client, Therapist, InsuranceQualification,
)

logger = logging.getLogger(__name__)

SLOT_SIZE = 15  # minutes per slot


def time_to_minutes(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m


def minutes_to_time(mins: int) -> str:
    return f"{mins // 60:02d}:{mins % 60:02d}"


def slot_to_time(slot: int, op_start_min: int) -> str:
    return minutes_to_time(op_start_min + slot * SLOT_SIZE)


def time_to_slot(t: str, op_start_min: int) -> int:
    return (time_to_minutes(t) - op_start_min) // SLOT_SIZE


def get_role_rank(role: str, iqs: list[InsuranceQualification], default_ranks: dict[str, int]) -> int:
    for iq in iqs:
        if iq.id == role and iq.roleHierarchyOrder is not None:
            return iq.roleHierarchyOrder
    return default_ranks.get(role, -1)


def meets_insurance(t: Therapist, c: Client, iqs: list[InsuranceQualification], default_ranks: dict[str, int]) -> bool:
    if not c.insuranceRequirements:
        return True
    for req_id in c.insuranceRequirements:
        # Direct qualification match
        if req_id in t.qualifications:
            continue
        # Role hierarchy match
        required_rank = get_role_rank(req_id, iqs, default_ranks)
        therapist_rank = get_role_rank(t.role, iqs, default_ranks)
        if therapist_rank >= required_rank and required_rank != -1:
            continue
        # Role name match
        if t.role == req_id:
            continue
        return False
    return True


def get_max_providers(c: Client, iqs: list[InsuranceQualification]) -> int:
    max_p = 999
    for req_id in c.insuranceRequirements:
        for q in iqs:
            if q.id == req_id and q.maxTherapistsPerDay is not None:
                max_p = min(max_p, q.maxTherapistsPerDay)
    return max_p


def get_min_duration_minutes(c: Client, iqs: list[InsuranceQualification]) -> int:
    min_dur = 60  # ABA default
    found_custom = False
    for req_id in c.insuranceRequirements:
        for q in iqs:
            if q.id == req_id and q.minSessionDurationMinutes is not None and q.minSessionDurationMinutes > 0:
                if not found_custom or q.minSessionDurationMinutes > min_dur:
                    min_dur = q.minSessionDurationMinutes
                    found_custom = True
    return min_dur


def get_max_duration_minutes(c: Client, iqs: list[InsuranceQualification]) -> int:
    max_dur = 180  # ABA default
    found_custom = False
    for req_id in c.insuranceRequirements:
        for q in iqs:
            if q.id == req_id and q.maxSessionDurationMinutes is not None and q.maxSessionDurationMinutes > 0:
                if not found_custom or q.maxSessionDurationMinutes < max_dur:
                    max_dur = q.maxSessionDurationMinutes
                    found_custom = True
    return max_dur


def get_max_weekly_minutes(c: Client, iqs: list[InsuranceQualification]) -> int:
    max_m = 999999
    for req_id in c.insuranceRequirements:
        for q in iqs:
            if q.id == req_id and q.maxHoursPerWeek is not None:
                max_m = min(max_m, int(q.maxHoursPerWeek * 60))
    return max_m


# ---------------------------------------------------------------------------
# Main solver
# ---------------------------------------------------------------------------

def build_and_solve(req: SolveRequest) -> SolveResponse:
    """Try hard coverage first; fall back to soft coverage if infeasible."""
    cfg = req.config
    op_start = time_to_minutes(cfg.operatingHoursStart)
    op_end = time_to_minutes(cfg.operatingHoursEnd)
    num_slots = (op_end - op_start) // SLOT_SIZE
    LUNCH_SLOTS = 2  # 30 minutes

    num_t = len(req.therapists)
    num_c = len(req.clients)

    # Quick feasibility check: is full coverage even theoretically possible?
    # Each therapist has at most (num_slots - LUNCH_SLOTS) available slots.
    total_capacity = num_t * (num_slots - LUNCH_SLOTS)
    # Conservative demand estimate: num_clients * num_slots (ignoring callouts/AH)
    total_demand = num_c * num_slots

    if total_demand <= total_capacity:
        logger.info("Capacity check passed (%d demand <= %d capacity), trying hard coverage...",
                     total_demand, total_capacity)
        result = _solve_with_coverage_mode(req, hard_coverage=True)
        if result.success:
            result.coverageMode = "hard"
            return result
        logger.info("Hard coverage infeasible, retrying with soft coverage constraints...")
    else:
        logger.info("Skipping hard coverage: demand (%d slots) > capacity (%d slots) — "
                     "%d clients × %d slots vs %d therapists × %d available",
                     total_demand, total_capacity, num_c, num_slots, num_t, num_slots - LUNCH_SLOTS)

    result = _solve_with_coverage_mode(req, hard_coverage=False)
    result.coverageMode = "soft"
    return result


def _solve_with_coverage_mode(req: SolveRequest, hard_coverage: bool = True) -> SolveResponse:
    cfg = req.config
    op_start = time_to_minutes(cfg.operatingHoursStart)
    op_end = time_to_minutes(cfg.operatingHoursEnd)
    num_slots = (op_end - op_start) // SLOT_SIZE
    default_ranks = cfg.defaultRoleRank

    clients = req.clients
    therapists = req.therapists
    iqs = req.insuranceQualifications
    day = req.day

    # Weekend check
    if day in ("Saturday", "Sunday"):
        # Only allied health is possible on weekends, no ABA
        pass  # We'll skip ABA variable creation below

    is_weekend = day in ("Saturday", "Sunday")

    num_c = len(clients)
    num_t = len(therapists)

    if num_c == 0 or num_t == 0:
        return SolveResponse(
            schedule=[], success=True,
            statusMessage="No clients or therapists to schedule.",
        )

    model = cp_model.CpModel()

    # Lookup maps
    client_idx = {c.id: i for i, c in enumerate(clients)}
    therapist_idx = {t.id: i for i, t in enumerate(therapists)}

    # ------------------------------------------------------------------
    # Pre-compute eligibility and per-client team tiers
    # ------------------------------------------------------------------
    # eligible_pairs[ci] = list of ti indices eligible for ABA with this client
    # All insurance-qualified therapists are included; off-team assignments
    # are penalised in the objective via team_tier costs.
    # Team tier: 0=same-team non-BCBA, 1=cross-team non-BCBA,
    #            2=same-team BCBA, 3=cross-team BCBA
    # Team tier: 0=same-team non-BCBA, 1=cross-team non-BCBA (CF>STAR3>STAR2>STAR1>RBT),
    # 2=same-team BCBA, 3=cross-team BCBA, 99=ineligible (BT never cross-team)
    def _team_tier(t_role: str, t_team: str | None, c_team: str | None) -> int:
        if not c_team:
            return 0  # no team → no penalty
        same = (t_team == c_team) if t_team else False
        is_bcba = (t_role == "BCBA")
        if same and not is_bcba:
            return 0
        if not same and not is_bcba:
            if t_role == "BT":
                return 99  # BTs never take cross-team clients
            return 1
        if same and is_bcba:
            return 2
        return 3

    eligible_pairs: list[list[int]] = []
    # team_tier_map[ci][ti_local] = tier (0-3) for the ti at that local index
    team_tier_map: list[list[int]] = []
    for ci, c in enumerate(clients):
        all_eligible = []
        for ti, t in enumerate(therapists):
            if t.role in ("OT", "SLP"):
                continue  # OT/SLP don't do ABA
            if meets_insurance(t, c, iqs, default_ranks):
                tier = _team_tier(t.role, t.teamId, c.teamId)
                if tier >= 99:
                    continue  # BTs excluded from cross-team
                all_eligible.append((ti, tier))
        # Sort: tier ascending, then role rank ascending within each tier
        all_eligible.sort(key=lambda x: (x[1], get_role_rank(therapists[x[0]].role, iqs, default_ranks)))
        eligible_pairs.append([x[0] for x in all_eligible])
        team_tier_map.append([x[1] for x in all_eligible])

    # Reverse lookup: ti -> local index within eligible_pairs[ci]
    ti_to_local: list[dict[int, int]] = [
        {ti: idx for idx, ti in enumerate(ep)} for ep in eligible_pairs
    ]

    # Per-client duration and weekly limits
    min_dur_slots = []
    max_dur_slots = []
    remaining_weekly_slots = []
    for ci, c in enumerate(clients):
        min_d = get_min_duration_minutes(c, iqs)
        max_d = get_max_duration_minutes(c, iqs)
        min_dur_slots.append(max(1, (min_d + SLOT_SIZE - 1) // SLOT_SIZE))  # ceil
        max_dur_slots.append(max_d // SLOT_SIZE)

        max_weekly = get_max_weekly_minutes(c, iqs)
        other_day_mins = req.otherDayMinutesPerClient.get(c.id, 0)
        remaining = max(0, max_weekly - other_day_mins)
        remaining_weekly_slots.append(remaining // SLOT_SIZE)

    # Max sessions per (client, therapist) pair — 2 allows for lunch-interrupted coverage
    MAX_SESSIONS_PER_PAIR = 2

    # ------------------------------------------------------------------
    # Callout blackout computation
    # ------------------------------------------------------------------
    # Pre-compute blocked slot ranges for each therapist and client
    therapist_blocked: list[list[tuple[int, int]]] = [[] for _ in range(num_t)]
    client_blocked: list[list[tuple[int, int]]] = [[] for _ in range(num_c)]

    for co in req.callouts:
        s = max(0, (time_to_minutes(co.startTime) - op_start) // SLOT_SIZE)
        e = min(num_slots, -(-((time_to_minutes(co.endTime) - op_start)) // SLOT_SIZE))  # ceil
        if e <= s:
            continue
        if co.entityType == "therapist":
            ti = therapist_idx.get(co.entityId)
            if ti is not None:
                therapist_blocked[ti].append((s, e))
        else:
            ci = client_idx.get(co.entityId)
            if ci is not None:
                client_blocked[ci].append((s, e))

    # Pre-compute which slots are blocked for each client (for coverage objective)
    client_slot_blocked: list[list[bool]] = []
    for ci in range(num_c):
        blocked = [False] * num_slots
        for (bs, be) in client_blocked[ci]:
            for s in range(bs, be):
                blocked[s] = True
        client_slot_blocked.append(blocked)

    # ------------------------------------------------------------------
    # Prune: remove fully-blocked therapists from eligible pairs and
    # skip ABA variables for clients with zero remaining weekly budget.
    # ------------------------------------------------------------------
    therapist_fully_blocked: set[int] = set()
    for ti in range(num_t):
        blocked_count = 0
        for (bs, be) in therapist_blocked[ti]:
            blocked_count += (be - bs)
        if blocked_count >= num_slots:
            therapist_fully_blocked.add(ti)

    if therapist_fully_blocked:
        new_ep: list[list[int]] = []
        new_ttm: list[list[int]] = []
        for ci in range(num_c):
            filtered = [
                (ti, team_tier_map[ci][idx])
                for idx, ti in enumerate(eligible_pairs[ci])
                if ti not in therapist_fully_blocked
            ]
            new_ep.append([x[0] for x in filtered])
            new_ttm.append([x[1] for x in filtered])
        eligible_pairs = new_ep
        team_tier_map = new_ttm
        ti_to_local = [
            {ti: idx for idx, ti in enumerate(ep)} for ep in eligible_pairs
        ]

    # Track which clients have zero budget (skip ABA var creation)
    zero_budget_clients = {ci for ci in range(num_c) if remaining_weekly_slots[ci] <= 0}

    # ------------------------------------------------------------------
    # Decision variables
    # ------------------------------------------------------------------

    # ABA session variables: active[ci][ti_local][k], start, duration, interval
    # ti_local indexes into eligible_pairs[ci]
    aba_active: list[list[list]] = []       # [ci][ti_local][k]
    aba_start: list[list[list]] = []
    aba_duration: list[list[list]] = []
    aba_interval: list[list[list]] = []

    for ci in range(num_c):
        ci_active = []
        ci_start = []
        ci_dur = []
        ci_interval = []
        for ti_local, ti in enumerate(eligible_pairs[ci]):
            k_active = []
            k_start = []
            k_dur = []
            k_interval = []
            for k in range(MAX_SESSIONS_PER_PAIR):
                if is_weekend or ci in zero_budget_clients:
                    # No ABA on weekends or for zero-budget clients
                    break
                pfx = f"aba_c{ci}_t{ti}_k{k}"
                act = model.new_bool_var(f"{pfx}_act")
                st = model.new_int_var(0, num_slots, f"{pfx}_st")
                dur = model.new_int_var(0, num_slots, f"{pfx}_dur")
                end = model.new_int_var(0, num_slots, f"{pfx}_end")

                # Link end = start + duration
                model.add(end == st + dur)

                # Duration bounds when active
                model.add(dur >= min_dur_slots[ci]).only_enforce_if(act)
                model.add(dur <= max_dur_slots[ci]).only_enforce_if(act)
                # When inactive, duration must be 0
                model.add(dur == 0).only_enforce_if(act.negated())

                # Create optional interval
                iv = model.new_optional_interval_var(st, dur, end, act, f"{pfx}_iv")

                k_active.append(act)
                k_start.append(st)
                k_dur.append(dur)
                k_interval.append(iv)

            ci_active.append(k_active)
            ci_start.append(k_start)
            ci_dur.append(k_dur)
            ci_interval.append(k_interval)

        aba_active.append(ci_active)
        aba_start.append(ci_start)
        aba_duration.append(ci_dur)
        aba_interval.append(ci_interval)

    # ------------------------------------------------------------------
    # Allied Health variables
    # ------------------------------------------------------------------
    # For each allied health need on this day, we create a fixed-duration interval
    # and a choice variable for which eligible therapist handles it.
    ah_entries: list[dict] = []  # metadata for solution extraction

    for ci, c in enumerate(clients):
        for need_idx, need in enumerate(c.alliedHealthNeeds):
            if day not in need.specificDays:
                continue
            if not need.startTime or not need.endTime:
                continue
            start_min = time_to_minutes(need.startTime)
            end_min = time_to_minutes(need.endTime)
            s = (start_min - op_start) // SLOT_SIZE
            length = -(-((end_min - start_min)) // SLOT_SIZE)  # ceil

            if s < 0 or s + length > num_slots:
                continue

            # Check weekly minutes
            other_mins = req.otherDayMinutesPerClient.get(c.id, 0)
            max_weekly = get_max_weekly_minutes(c, iqs)
            if other_mins + length * SLOT_SIZE > max_weekly:
                continue

            service_role = need.type  # "OT" or "SLP"
            session_type = f"AlliedHealth_{need.type}"

            eligible_tis = [
                ti for ti, t in enumerate(therapists)
                if t.role == service_role
            ]

            if not eligible_tis:
                # No eligible therapist — create unassigned entry
                ah_entries.append({
                    "ci": ci, "start_slot": s, "length": length,
                    "session_type": session_type, "assigned_ti": None,
                    "choice_vars": [], "eligible_tis": [],
                    "interval_vars": [],
                })
                continue

            choice_vars = []
            interval_vars = []
            for ti in eligible_tis:
                pfx = f"ah_c{ci}_n{need_idx}_t{ti}"
                chosen = model.new_bool_var(f"{pfx}_chosen")
                # Fixed interval, but optional (only if this therapist is chosen)
                iv = model.new_optional_fixed_size_interval_var(
                    s, length, chosen, f"{pfx}_iv"
                )
                choice_vars.append(chosen)
                interval_vars.append(iv)

            # Exactly one therapist assigned (if any are eligible)
            model.add_exactly_one(choice_vars)

            # Prefer preferred provider via hint
            if need.preferredProviderId:
                pref_ti = therapist_idx.get(need.preferredProviderId)
                if pref_ti is not None and pref_ti in eligible_tis:
                    idx = eligible_tis.index(pref_ti)
                    model.add_hint(choice_vars[idx], 1)

            ah_entries.append({
                "ci": ci, "start_slot": s, "length": length,
                "session_type": session_type, "assigned_ti": None,
                "choice_vars": choice_vars, "eligible_tis": eligible_tis,
                "interval_vars": interval_vars,
            })

    # ------------------------------------------------------------------
    # Lunch variables
    # ------------------------------------------------------------------
    lunch_window_start = max(0, time_to_slot(cfg.idealLunchWindowStart, op_start))
    lunch_window_end = min(num_slots - 2, time_to_slot(cfg.idealLunchWindowEndForStart, op_start))
    LUNCH_SLOTS = 2  # 30 minutes

    lunch_start_var: list = []
    lunch_active_var: list = []
    lunch_interval_var: list = []

    for ti in range(num_t):
        pfx = f"lunch_t{ti}"
        act = model.new_bool_var(f"{pfx}_act")
        st = model.new_int_var(lunch_window_start, max(lunch_window_start, lunch_window_end), f"{pfx}_st")
        end = model.new_int_var(lunch_window_start + LUNCH_SLOTS, max(lunch_window_start + LUNCH_SLOTS, lunch_window_end + LUNCH_SLOTS), f"{pfx}_end")
        model.add(end == st + LUNCH_SLOTS)

        iv = model.new_optional_interval_var(st, LUNCH_SLOTS, end, act, f"{pfx}_iv")

        lunch_start_var.append(st)
        lunch_active_var.append(act)
        lunch_interval_var.append(iv)

    # ------------------------------------------------------------------
    # Constraint: Stagger lunches (limit concurrent lunches)
    # ------------------------------------------------------------------
    # Without this, the solver may schedule all lunches at 11:00 AM,
    # leaving no therapists to cover clients during that time.
    # Allow at most ~25% of therapists on lunch simultaneously.
    max_concurrent_lunches = max(1, num_t // 4)
    logger.info("Lunch staggering: max %d concurrent lunches (of %d therapists)",
                max_concurrent_lunches, num_t)
    model.add_cumulative(
        [lunch_interval_var[ti] for ti in range(num_t)],
        [1] * num_t,
        max_concurrent_lunches,
    )

    # ------------------------------------------------------------------
    # Constraint: No-overlap per therapist
    # ------------------------------------------------------------------
    for ti in range(num_t):
        intervals = []

        # ABA intervals for this therapist
        for ci in range(num_c):
            if ti in ti_to_local[ci]:
                tl = ti_to_local[ci][ti]
                for k in range(len(aba_interval[ci][tl])):
                    intervals.append(aba_interval[ci][tl][k])

        # Allied health intervals assigned to this therapist
        for ah in ah_entries:
            if ti in ah["eligible_tis"]:
                idx = ah["eligible_tis"].index(ti)
                intervals.append(ah["interval_vars"][idx])

        # Lunch interval
        intervals.append(lunch_interval_var[ti])

        # Callout blackout intervals (mandatory/fixed)
        for (bs, be) in therapist_blocked[ti]:
            co_iv = model.new_fixed_size_interval_var(bs, be - bs, f"co_t{ti}_{bs}_{be}")
            intervals.append(co_iv)

        if intervals:
            model.add_no_overlap(intervals)

    # ------------------------------------------------------------------
    # Constraint: No-overlap per client
    # ------------------------------------------------------------------
    for ci in range(num_c):
        intervals = []

        # ABA intervals
        for ti_local in range(len(eligible_pairs[ci])):
            for k in range(len(aba_interval[ci][ti_local])):
                intervals.append(aba_interval[ci][ti_local][k])

        # Allied health intervals (the chosen one, whichever therapist)
        for ah in ah_entries:
            if ah["ci"] == ci:
                for iv in ah["interval_vars"]:
                    intervals.append(iv)

        # Client callout blackout intervals
        for (bs, be) in client_blocked[ci]:
            co_iv = model.new_fixed_size_interval_var(bs, be - bs, f"co_c{ci}_{bs}_{be}")
            intervals.append(co_iv)

        if intervals:
            model.add_no_overlap(intervals)

    # ------------------------------------------------------------------
    # Constraint: Max providers per day per client
    # ------------------------------------------------------------------
    # provider_used[ci][ti] = 1 iff therapist ti has any active session with client ci
    provider_used: list[list] = []
    for ci in range(num_c):
        max_p = get_max_providers(clients[ci], iqs)
        ci_prov = []
        for ti_local, ti in enumerate(eligible_pairs[ci]):
            pvar = model.new_bool_var(f"prov_c{ci}_t{ti}")
            # prov_used >= any active session for (ci, ti)
            for k in range(len(aba_active[ci][ti_local])):
                model.add_implication(aba_active[ci][ti_local][k], pvar)
            # prov_used == 0 if no sessions active
            model.add(pvar == 0).only_enforce_if(
                [a.negated() for a in aba_active[ci][ti_local]]
            )
            ci_prov.append(pvar)

        # Also count allied health providers
        for ah in ah_entries:
            if ah["ci"] == ci:
                for idx, ti in enumerate(ah["eligible_tis"]):
                    # If this AH therapist is also an ABA-eligible therapist, the prov var
                    # already exists. Otherwise we need a separate one.
                    if ti in ti_to_local[ci]:
                        tl = ti_to_local[ci][ti]
                        # The prov var already captures ABA. We also need to link AH choice.
                        model.add_implication(ah["choice_vars"][idx], ci_prov[tl])
                    else:
                        # Separate provider var for AH-only therapist
                        ah_prov = model.new_bool_var(f"ah_prov_c{ci}_t{ti}")
                        model.add(ah_prov == ah["choice_vars"][idx])
                        ci_prov.append(ah_prov)

        if max_p < 999 and ci_prov:
            model.add(sum(ci_prov) <= max_p)

        provider_used.append(ci_prov)

    # ------------------------------------------------------------------
    # Constraint: Max weekly hours per client (remaining for today)
    # ------------------------------------------------------------------
    for ci in range(num_c):
        if remaining_weekly_slots[ci] >= num_slots * MAX_SESSIONS_PER_PAIR:
            continue  # Effectively unconstrained

        all_durations = []
        for ti_local in range(len(eligible_pairs[ci])):
            for k in range(len(aba_duration[ci][ti_local])):
                all_durations.append(aba_duration[ci][ti_local][k])

        # Add allied health durations (fixed)
        ah_slot_total = 0
        for ah in ah_entries:
            if ah["ci"] == ci:
                ah_slot_total += ah["length"]

        if all_durations:
            model.add(sum(all_durations) + ah_slot_total <= remaining_weekly_slots[ci])

    # ------------------------------------------------------------------
    # Constraint: Session pair symmetry breaking + back-to-back gap
    # ------------------------------------------------------------------
    for ci in range(num_c):
        for ti_local, ti in enumerate(eligible_pairs[ci]):
            sessions = list(range(len(aba_active[ci][ti_local])))
            if len(sessions) < 2:
                continue
            for k in range(len(sessions) - 1):
                k1, k2 = sessions[k], sessions[k + 1]

                # Symmetry breaking: k2 can only be active if k1 is active
                model.add_implication(aba_active[ci][ti_local][k2],
                                      aba_active[ci][ti_local][k1])

                # Both-active indicator for ordering + gap constraints
                both = model.new_bool_var(f"btb_c{ci}_t{ti}_{k}")
                model.add_bool_and([
                    aba_active[ci][ti_local][k1],
                    aba_active[ci][ti_local][k2],
                ]).only_enforce_if(both)
                model.add_bool_or([
                    aba_active[ci][ti_local][k1].negated(),
                    aba_active[ci][ti_local][k2].negated(),
                ]).only_enforce_if(both.negated())

                # Symmetry breaking: k1 starts before k2 (strict ordering)
                # Also enforces back-to-back gap of at least 1 slot
                model.add(
                    aba_start[ci][ti_local][k2] >= aba_start[ci][ti_local][k1] + aba_duration[ci][ti_local][k1] + 1
                ).only_enforce_if(both)

    # ------------------------------------------------------------------
    # Constraint: Lunch enforcement
    # ------------------------------------------------------------------
    # lunch_active[ti] = 1 iff therapist has ANY billable work
    for ti in range(num_t):
        billable_indicators = []

        # ABA sessions
        for ci in range(num_c):
            if ti in ti_to_local[ci]:
                tl = ti_to_local[ci][ti]
                for k in range(len(aba_active[ci][tl])):
                    billable_indicators.append(aba_active[ci][tl][k])

        # Allied health sessions
        for ah in ah_entries:
            if ti in ah["eligible_tis"]:
                idx = ah["eligible_tis"].index(ti)
                billable_indicators.append(ah["choice_vars"][idx])

        if billable_indicators:
            has_billable = model.new_bool_var(f"has_bill_t{ti}")
            model.add_max_equality(has_billable, billable_indicators)
            model.add(lunch_active_var[ti] == has_billable)
        else:
            # No possible billable work — no lunch
            model.add(lunch_active_var[ti] == 0)

    # ------------------------------------------------------------------
    # Objective: minimize penalties
    # ------------------------------------------------------------------
    objective_terms = []

    # 1. Coverage constraints
    # Aggregate encoding: because no-overlap per client is enforced, total ABA
    # duration == number of ABA-covered slots.  No per-slot booleans needed.
    COVERAGE_GAP_WEIGHT = 100_000
    if not is_weekend:
        # Compute total capacity and demand for fair-share minimum coverage
        total_therapist_capacity = num_t * (num_slots - LUNCH_SLOTS)
        total_client_available = 0
        client_available_slots: list[int] = []

        for ci in range(num_c):
            ah_covered = sum(ah["length"] for ah in ah_entries if ah["ci"] == ci)
            blocked = sum(1 for s in range(num_slots) if client_slot_blocked[ci][s])
            avail = num_slots - blocked - ah_covered
            client_available_slots.append(max(0, avail))
            total_client_available += max(0, avail)

        # Fair-share: each client is guaranteed at least their proportional share
        # of therapist capacity.  E.g. 12 therapists × 30 slots = 360 capacity
        # shared among 40 clients → each client gets at least ~9 slots (2h 15m).
        if total_client_available > 0:
            capacity_ratio = min(1.0, total_therapist_capacity / total_client_available)
        else:
            capacity_ratio = 1.0

        for ci in range(num_c):
            available = client_available_slots[ci]
            if available <= 0:
                continue

            all_dur_vars = []
            for ti_local in range(len(eligible_pairs[ci])):
                for k in range(len(aba_duration[ci][ti_local])):
                    all_dur_vars.append(aba_duration[ci][ti_local][k])

            if hard_coverage:
                if all_dur_vars:
                    model.add(sum(all_dur_vars) >= available)
            else:
                # Hard minimum: each client gets at least their fair share
                # (proportional to therapist capacity vs total demand)
                min_coverage = max(min_dur_slots[ci], int(available * capacity_ratio * 0.85))
                min_coverage = min(min_coverage, available)  # Can't exceed available
                # Also respect remaining weekly budget
                min_coverage = min(min_coverage, remaining_weekly_slots[ci])

                if all_dur_vars and min_coverage > 0:
                    model.add(sum(all_dur_vars) >= min_coverage)
                    logger.debug("Client %d: min coverage %d/%d slots (%.0f%%)",
                                 ci, min_coverage, available, 100 * min_coverage / available)

                # Soft penalty for remaining uncovered slots above minimum
                if all_dur_vars:
                    uncov = model.new_int_var(0, available, f"uncov_c{ci}")
                    model.add(uncov == available - sum(all_dur_vars))
                    objective_terms.append(COVERAGE_GAP_WEIGHT * uncov)
                else:
                    objective_terms.append(COVERAGE_GAP_WEIGHT * available)

    # 2. Workload balance penalty (weight 10)
    # Penalize higher-ranked therapists having more billable time than lower-ranked
    therapist_billable = []
    for ti in range(num_t):
        dur_vars = []
        for ci in range(num_c):
            if ti in ti_to_local[ci]:
                tl = ti_to_local[ci][ti]
                for k in range(len(aba_duration[ci][tl])):
                    dur_vars.append(aba_duration[ci][tl][k])
        # Add AH durations (fixed if chosen)
        ah_dur_terms = []
        for ah in ah_entries:
            if ti in ah["eligible_tis"]:
                idx = ah["eligible_tis"].index(ti)
                ah_dur_terms.append(ah["length"] * ah["choice_vars"][idx])

        if dur_vars or ah_dur_terms:
            total = model.new_int_var(0, num_slots * MAX_SESSIONS_PER_PAIR * num_c, f"bill_t{ti}")
            model.add(total == sum(dur_vars) + sum(ah_dur_terms))
            therapist_billable.append((ti, total))
        else:
            zero = model.new_constant(0)
            therapist_billable.append((ti, zero))

    for i, (ti_i, bill_i) in enumerate(therapist_billable):
        rank_i = get_role_rank(therapists[ti_i].role, iqs, default_ranks)
        for j, (ti_j, bill_j) in enumerate(therapist_billable):
            if i == j:
                continue
            rank_j = get_role_rank(therapists[ti_j].role, iqs, default_ranks)
            if rank_i > rank_j:
                # Penalize if higher-rank therapist has more billable than lower-rank
                excess = model.new_int_var(0, num_slots * MAX_SESSIONS_PER_PAIR * num_c, f"excess_{ti_i}_{ti_j}")
                model.add(excess >= bill_i - bill_j)
                model.add(excess >= 0)
                objective_terms.append(10 * excess)

    # 3. Off-team penalty: penalise cross-team and BCBA assignments by tier
    #    Tier weights are secondary to coverage (100_000 >> 1_500).
    #    Tier 0 (same-team non-BCBA) = 0, Tier 1 (cross-team non-BCBA) = 500/slot,
    #    Tier 2 (same-team BCBA) = 800/slot, Tier 3 (cross-team BCBA) = 1500/slot
    _TIER_WEIGHTS = {0: 0, 1: 500, 2: 800, 3: 1500}
    for ci in range(num_c):
        for ti_local, ti in enumerate(eligible_pairs[ci]):
            tier = team_tier_map[ci][ti_local]
            w = _TIER_WEIGHTS.get(tier, 0)
            if w > 0:
                for k in range(len(aba_duration[ci][ti_local])):
                    objective_terms.append(w * aba_duration[ci][ti_local][k])

    # 4. Note count penalty (weight 500 per active session) — discourages
    #    fragmentation into many short sessions.  Each additional session
    #    adds 500 to the objective (= 5 uncovered slots equivalent),
    #    making the solver prefer fewer, longer sessions.
    for ci in range(num_c):
        for ti_local in range(len(eligible_pairs[ci])):
            for k in range(len(aba_active[ci][ti_local])):
                objective_terms.append(500 * aba_active[ci][ti_local][k])

    # 5. Max billable sessions per therapist (hard cap at 4 notes)
    #    Prevents any therapist from having more than 4 ABA sessions.
    MAX_NOTES_PER_THERAPIST = 4
    for ti in range(num_t):
        ti_sessions = []
        for ci in range(num_c):
            if ti in ti_to_local[ci]:
                tl = ti_to_local[ci][ti]
                ti_sessions.extend(aba_active[ci][tl])
        # Also count allied health sessions
        for ah in ah_entries:
            if ti in ah["eligible_tis"]:
                idx = ah["eligible_tis"].index(ti)
                ti_sessions.append(ah["choice_vars"][idx])
        if ti_sessions:
            model.add(sum(ti_sessions) <= MAX_NOTES_PER_THERAPIST)

    if objective_terms:
        model.minimize(sum(objective_terms))

    # ------------------------------------------------------------------
    # Warm-start hints from initial schedule
    # ------------------------------------------------------------------
    if req.initialSchedule:
        # Track which (ci, ti_local) slots have been hinted
        hint_count: dict[tuple[int, int], int] = {}

        for entry in req.initialSchedule:
            if entry.day != day:
                continue
            if entry.sessionType == "IndirectTime":
                # Hint lunch
                if entry.therapistId:
                    ti = therapist_idx.get(entry.therapistId)
                    if ti is not None:
                        s = max(0, time_to_slot(entry.startTime, op_start))
                        if lunch_window_start <= s <= lunch_window_end:
                            model.add_hint(lunch_active_var[ti], 1)
                            model.add_hint(lunch_start_var[ti], s)
                continue

            if entry.sessionType == "ABA" and entry.clientId and entry.therapistId:
                ci = client_idx.get(entry.clientId)
                ti = therapist_idx.get(entry.therapistId)
                if ci is None or ti is None:
                    continue
                if ti not in ti_to_local[ci]:
                    continue
                tl = ti_to_local[ci][ti]
                key = (ci, tl)
                k = hint_count.get(key, 0)
                if k >= len(aba_active[ci][tl]):
                    continue
                s = max(0, time_to_slot(entry.startTime, op_start))
                dur = max(1, time_to_slot(entry.endTime, op_start) - s)
                model.add_hint(aba_active[ci][tl][k], 1)
                model.add_hint(aba_start[ci][tl][k], s)
                model.add_hint(aba_duration[ci][tl][k], dur)
                hint_count[key] = k + 1

    # Hint un-hinted sessions as inactive for a complete warm-start
    if req.initialSchedule:
        for ci in range(num_c):
            for tl in range(len(eligible_pairs[ci])):
                for k in range(len(aba_active[ci][tl])):
                    key = (ci, tl)
                    hinted_k = hint_count.get(key, 0)
                    if k >= hinted_k:
                        model.add_hint(aba_active[ci][tl][k], 0)
                        model.add_hint(aba_duration[ci][tl][k], 0)

    # ------------------------------------------------------------------
    # Solve
    # ------------------------------------------------------------------
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 45.0
    solver.parameters.num_workers = int(os.environ.get("SOLVER_WORKERS", "4"))
    solver.parameters.log_search_progress = True
    solver.parameters.linearization_level = 2
    solver.parameters.cp_model_probing_level = 2

    # Decision strategy: try activating sessions first (coverage-maximizing)
    all_active_vars = []
    for ci in range(num_c):
        for tl in range(len(eligible_pairs[ci])):
            all_active_vars.extend(aba_active[ci][tl])
    if all_active_vars:
        model.add_decision_strategy(
            all_active_vars,
            cp_model.CHOOSE_FIRST,
            cp_model.SELECT_MAX_VALUE,
        )

    logger.info("Starting CP-SAT solve: %d clients, %d therapists, %d slots, hard_coverage=%s",
                num_c, num_t, num_slots, hard_coverage)

    status = solver.solve(model)
    status_name = solver.status_name(status)

    logger.info("Solve status: %s, objective: %s",
                status_name, solver.objective_value if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else "N/A")

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolveResponse(
            schedule=[], success=False,
            statusMessage=f"Solver returned {status_name}. No feasible schedule found.",
            objectiveValue=None,
        )

    # ------------------------------------------------------------------
    # Extract solution
    # ------------------------------------------------------------------
    schedule: list[ScheduleEntry] = []

    # Extract ABA sessions
    for ci in range(num_c):
        for ti_local, ti in enumerate(eligible_pairs[ci]):
            for k in range(len(aba_active[ci][ti_local])):
                if solver.value(aba_active[ci][ti_local][k]):
                    s = solver.value(aba_start[ci][ti_local][k])
                    d = solver.value(aba_duration[ci][ti_local][k])
                    schedule.append(ScheduleEntry(
                        id=f"cpsat-{uuid.uuid4().hex[:12]}",
                        clientId=clients[ci].id,
                        clientName=clients[ci].name,
                        therapistId=therapists[ti].id,
                        therapistName=therapists[ti].name,
                        day=day,
                        startTime=slot_to_time(s, op_start),
                        endTime=slot_to_time(s + d, op_start),
                        sessionType="ABA",
                    ))

    # Extract Allied Health sessions
    for ah in ah_entries:
        ci = ah["ci"]
        assigned_ti = None
        for idx, ti in enumerate(ah["eligible_tis"]):
            if ah["choice_vars"] and solver.value(ah["choice_vars"][idx]):
                assigned_ti = ti
                break

        schedule.append(ScheduleEntry(
            id=f"cpsat-{uuid.uuid4().hex[:12]}",
            clientId=clients[ci].id,
            clientName=clients[ci].name,
            therapistId=therapists[assigned_ti].id if assigned_ti is not None else None,
            therapistName=therapists[assigned_ti].name if assigned_ti is not None else None,
            day=day,
            startTime=slot_to_time(ah["start_slot"], op_start),
            endTime=slot_to_time(ah["start_slot"] + ah["length"], op_start),
            sessionType=ah["session_type"],
        ))

    # Extract lunch sessions (only for therapists with billable work)
    for ti in range(num_t):
        if solver.value(lunch_active_var[ti]):
            s = solver.value(lunch_start_var[ti])
            schedule.append(ScheduleEntry(
                id=f"cpsat-{uuid.uuid4().hex[:12]}",
                clientId=None,
                clientName=None,
                therapistId=therapists[ti].id,
                therapistName=therapists[ti].name,
                day=day,
                startTime=slot_to_time(s, op_start),
                endTime=slot_to_time(s + LUNCH_SLOTS, op_start),
                sessionType="IndirectTime",
            ))

    obj_val = int(solver.objective_value) if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else None
    is_optimal = status == cp_model.OPTIMAL

    return SolveResponse(
        schedule=schedule,
        success=True,
        statusMessage="Optimal!" if is_optimal else "Feasible (time limit reached).",
        objectiveValue=obj_val,
    )
