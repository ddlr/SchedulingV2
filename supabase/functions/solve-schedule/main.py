import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from supabase import create_client, Client
from ortools.sat.python import cp_model
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

def time_to_minutes(t_str: str) -> int:
    if not t_str: return 0
    try:
        parts = t_str.split(':')
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
        return h * 60 + m
    except:
        return 0

def minutes_to_time(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"

def get_day_of_week(date_str: str) -> str:
    d = datetime.strptime(date_str, '%Y-%m-%d')
    return d.strftime('%A')

@app.post("/")
async def solve_handler(request: Request):
    try:
        body = await request.json()
        target_date_str = body.get("date")
        if not target_date_str:
            return JSONResponse({"error": "Missing date"}, status_code=400)

        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not supabase_url or not supabase_key:
             return JSONResponse({"error": "Missing environment variables"}, status_code=500)

        supabase: Client = create_client(supabase_url, supabase_key)

        # 1. Fetch Data
        clients = supabase.table("clients").select("*").execute().data
        therapists = supabase.table("therapists").select("*").execute().data
        teams_data = supabase.table("teams").select("*").execute().data
        teams = {t['id']: t for t in teams_data}

        config_data = supabase.table("system_config").select("*").eq("id", "default").execute().data
        config = config_data[0]['config_data'] if config_data else {}

        settings_res = supabase.table("settings").select("*").eq("key", "insurance_qualifications").execute()
        raw_quals = settings_res.data[0]['value'] if settings_res.data else []
        qual_metadata = {}
        if isinstance(raw_quals, list):
            for q in raw_quals:
                if isinstance(q, dict) and 'id' in q:
                    qual_metadata[q['id']] = q
                elif isinstance(q, str):
                    qual_metadata[q] = {'id': q}

        callouts = supabase.table("callouts").select("*").lte("start_date", target_date_str).gte("end_date", target_date_str).execute().data

        day_of_week = get_day_of_week(target_date_str)

        # 2. Parameters
        OP_START = time_to_minutes(config.get("companyOperatingHoursStart", "09:00"))
        OP_END = time_to_minutes(config.get("companyOperatingHoursEnd", "17:00"))
        SLOT_SIZE = 15
        NUM_SLOTS = (OP_END - OP_START) // SLOT_SIZE

        LUNCH_WINDOW_START = time_to_minutes(config.get("idealLunchWindowStart", "11:00"))
        LUNCH_WINDOW_END_FOR_START = time_to_minutes(config.get("idealLunchWindowEndForStart", "13:30"))
        LUNCH_SLOTS_START = max(0, (LUNCH_WINDOW_START - OP_START) // SLOT_SIZE)
        LUNCH_SLOTS_END = min(NUM_SLOTS, (LUNCH_WINDOW_END_FOR_START - OP_START) // SLOT_SIZE + 1)

        role_ranks = config.get("defaultRoleRank", {})
        for q_id, q_data in qual_metadata.items():
            if 'roleHierarchyOrder' in q_data:
                role_ranks[q_id] = q_data['roleHierarchyOrder']

        model = cp_model.CpModel()

        # Variables
        assign = {} # (ci, ti, s)
        for ci in range(len(clients)):
            for ti in range(len(therapists)):
                for s in range(NUM_SLOTS):
                    assign[(ci, ti, s)] = model.NewBoolVar(f'assign_c{ci}_t{ti}_s{s}')

        is_start = {}
        for ci in range(len(clients)):
            for ti in range(len(therapists)):
                for s in range(NUM_SLOTS):
                    is_start[(ci, ti, s)] = model.NewBoolVar(f'start_c{ci}_t{ti}_s{s}')
                    if s == 0:
                        model.Add(is_start[(ci, ti, s)] == assign[(ci, ti, s)])
                    else:
                        model.Add(is_start[(ci, ti, s)] >= assign[(ci, ti, s)] - assign[(ci, ti, s-1)])

        # Constraints
        for ti in range(len(therapists)):
            for s in range(NUM_SLOTS):
                model.Add(sum(assign[(ci, ti, s)] for ci in range(len(clients))) <= 1)
        for ci in range(len(clients)):
            for s in range(NUM_SLOTS):
                model.Add(sum(assign[(ci, ti, s)] for ti in range(len(therapists))) <= 1)

        obj_ah_unassigned = []
        ah_slots_per_client = [set() for _ in range(len(clients))]

        for ci, client in enumerate(clients):
            c_reqs = client.get('insurance_requirements', [])
            ah_needs = client.get('allied_health_needs', [])
            for need in ah_needs:
                if day_of_week in need.get('specificDays', []):
                    n_start = time_to_minutes(need.get('startTime', ""))
                    n_end = time_to_minutes(need.get('endTime', ""))
                    n_role = need.get('type')
                    s_start = (n_start - OP_START) // SLOT_SIZE
                    s_end = (n_end - OP_START) // SLOT_SIZE
                    if 0 <= s_start < NUM_SLOTS and s_start < s_end <= NUM_SLOTS:
                        eligible_tis = [ti for ti, t in enumerate(therapists) if t.get('role') == n_role]
                        if eligible_tis:
                            for s in range(s_start, s_end):
                                ah_slots_per_client[ci].add(s)
                                is_covered = model.NewBoolVar(f'ah_covered_c{ci}_{s}')
                                model.Add(sum(assign[(ci, ti, s)] for ti in eligible_tis) == 1).OnlyEnforceIf(is_covered)
                                model.Add(sum(assign[(ci, ti, s)] for ti in eligible_tis) == 0).OnlyEnforceIf(is_covered.Not())
                                obj_ah_unassigned.append(is_covered.Not())
                                for ti in range(len(therapists)):
                                    if ti not in eligible_tis:
                                        model.Add(assign[(ci, ti, s)] == 0)
                        else:
                            for s in range(s_start, s_end):
                                ah_slots_per_client[ci].add(s)
                                obj_ah_unassigned.append(model.NewConstant(1))

            for ti, therapist in enumerate(therapists):
                t_role = therapist.get('role')
                t_quals = therapist.get('qualifications', [])
                meets = True
                for req in c_reqs:
                    if req in t_quals: continue
                    req_rank = role_ranks.get(req, -1)
                    t_rank = role_ranks.get(t_role, -1)
                    if t_rank >= req_rank and req_rank != -1: continue
                    if t_role == req: continue
                    meets = False; break
                if not meets:
                    for s in range(NUM_SLOTS): model.Add(assign[(ci, ti, s)] == 0)
                t_avail_start = time_to_minutes(config.get("staffAssumedAvailabilityStart", "08:45"))
                t_avail_end = time_to_minutes(config.get("staffAssumedAvailabilityEnd", "17:15"))
                for s in range(NUM_SLOTS):
                    st = OP_START + s * SLOT_SIZE
                    if st < t_avail_start or st + SLOT_SIZE > t_avail_end:
                        model.Add(assign[(ci, ti, s)] == 0)
                for co in callouts:
                    co_s = (time_to_minutes(co['start_time']) - OP_START) // SLOT_SIZE
                    co_e = (time_to_minutes(co['end_time']) - OP_START) // SLOT_SIZE
                    if co['entity_type'] == 'client' and co['entity_id'] == client['id']:
                        for s in range(max(0, co_s), min(NUM_SLOTS, co_e)): model.Add(assign[(ci, ti, s)] == 0)
                    if co['entity_type'] == 'therapist' and co['entity_id'] == therapist['id']:
                        for s in range(max(0, co_s), min(NUM_SLOTS, co_e)): model.Add(assign[(ci, ti, s)] == 0)

        # ABA Duration: Min 60m (4 slots)
        for ci in range(len(clients)):
            for ti in range(len(therapists)):
                for s in range(NUM_SLOTS):
                    if s in ah_slots_per_client[ci]: continue
                    if s + 4 <= NUM_SLOTS:
                        model.Add(sum(assign[(ci, ti, future_s)] for future_s in range(s, s + 4)) == 4).OnlyEnforceIf(is_start[(ci, ti, s)])
                    else:
                        model.Add(is_start[(ci, ti, s)] == 0)

        # Lunch Logic - Hard Constraint for working therapists
        therapist_works = [model.NewBoolVar(f'works_t{ti}') for ti in range(len(therapists))]
        lunch_start_vars = {}
        lunch_at_s_vars = {}
        for ti in range(len(therapists)):
            model.Add(sum(assign[(ci, ti, s)] for ci in range(len(clients)) for s in range(NUM_SLOTS)) >= 1).OnlyEnforceIf(therapist_works[ti])
            model.Add(sum(assign[(ci, ti, s)] for ci in range(len(clients)) for s in range(NUM_SLOTS)) == 0).OnlyEnforceIf(therapist_works[ti].Not())
            ls_var = model.NewIntVar(LUNCH_SLOTS_START, LUNCH_SLOTS_END - 1, f'lunch_start_t{ti}')
            lunch_start_vars[ti] = ls_var
            for s in range(LUNCH_SLOTS_START, LUNCH_SLOTS_END):
                lunch_at_s = model.NewBoolVar(f'lunch_at_t{ti}_s{s}')
                lunch_at_s_vars[(ti, s)] = lunch_at_s
                model.Add(ls_var == s).OnlyEnforceIf(lunch_at_s)
                model.Add(ls_var != s).OnlyEnforceIf(lunch_at_s.Not())
                for ci in range(len(clients)):
                    model.Add(assign[(ci, ti, s)] == 0).OnlyEnforceIf(lunch_at_s)
                    if s + 1 < NUM_SLOTS: model.Add(assign[(ci, ti, s+1)] == 0).OnlyEnforceIf(lunch_at_s)
            model.Add(sum(lunch_at_s_vars[(ti, s)] for s in range(LUNCH_SLOTS_START, LUNCH_SLOTS_END)) == 1).OnlyEnforceIf(therapist_works[ti])

        # Team Alignment & Lunch Staggering
        team_mismatches = []
        for ci, client in enumerate(clients):
            c_team_id = client.get('team_id')
            for ti, therapist in enumerate(therapists):
                if c_team_id and therapist.get('team_id') and c_team_id != therapist.get('team_id'):
                    for s in range(NUM_SLOTS): team_mismatches.append(assign[(ci, ti, s)])
        team_lunch_counts = {}
        for ti, therapist in enumerate(therapists):
            t_team_id = therapist.get('team_id')
            if t_team_id:
                for s in range(LUNCH_SLOTS_START, LUNCH_SLOTS_END):
                    key = (t_team_id, s)
                    if key not in team_lunch_counts: team_lunch_counts[key] = []
                    team_lunch_counts[key].append(lunch_at_s_vars[(ti, s)])

        # Objective
        obj_coverage = sum(assign.values())
        obj_splits = sum(is_start.values())
        obj_team_mismatch = sum(team_mismatches)
        obj_bcba_direct = sum(assign[(ci, ti, s)] for ci in range(len(clients)) for ti, t in enumerate(therapists) if t.get('role') == 'BCBA' for s in range(NUM_SLOTS))
        obj_lunch_stagger = 0
        for key, vars in team_lunch_counts.items():
            if len(vars) > 1:
                count = model.NewIntVar(0, len(vars), f'lunch_count_{key[0]}_{key[1]}')
                model.Add(count == sum(vars))
                excess = model.NewIntVar(0, len(vars), f'lunch_excess_{key[0]}_{key[1]}')
                model.Add(excess >= count - 1)
                obj_lunch_stagger += excess

        model.Maximize(
            100000 * obj_coverage
            - 2000000 * sum(obj_ah_unassigned)
            - 50000 * obj_team_mismatch
            - 1000 * obj_splits
            - 50 * obj_bcba_direct
            - 200 * obj_lunch_stagger
        )

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 60.0
        status = solver.Solve(model)

        schedule_entries = []
        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            for ci, client in enumerate(clients):
                for ti, therapist in enumerate(therapists):
                    cur_s = -1
                    cur_type = None
                    for s in range(NUM_SLOTS):
                        if solver.Value(assign[(ci, ti, s)]) == 1:
                            slot_type = "ABA"
                            for need in client.get('allied_health_needs', []):
                                if day_of_week in need.get('specificDays', []):
                                    ns = (time_to_minutes(need.get('startTime')) - OP_START) // SLOT_SIZE
                                    ne = (time_to_minutes(need.get('endTime')) - OP_START) // SLOT_SIZE
                                    if ns <= s < ne and therapist.get('role') == need.get('type'):
                                        slot_type = f"AlliedHealth_{need.get('type')}"; break
                            if cur_s == -1:
                                cur_s = s; cur_type = slot_type
                            elif slot_type != cur_type:
                                schedule_entries.append(create_entry(client, therapist, day_of_week, cur_s, s, OP_START, SLOT_SIZE, cur_type))
                                cur_s = s; cur_type = slot_type
                        else:
                            if cur_s != -1:
                                schedule_entries.append(create_entry(client, therapist, day_of_week, cur_s, s, OP_START, SLOT_SIZE, cur_type))
                                cur_s = -1; cur_type = None
                    if cur_s != -1:
                        schedule_entries.append(create_entry(client, therapist, day_of_week, cur_s, NUM_SLOTS, OP_START, SLOT_SIZE, cur_type))
            for ti, therapist in enumerate(therapists):
                if solver.Value(therapist_works[ti]):
                    ls_val = solver.Value(lunch_start_vars[ti])
                    schedule_entries.append({
                        "id": f"lunch-{therapist['id']}-{ls_val}",
                        "clientId": None, "clientName": None, "therapistId": therapist['id'], "therapistName": therapist['name'],
                        "day": day_of_week, "startTime": minutes_to_time(OP_START + ls_val * SLOT_SIZE), "endTime": minutes_to_time(OP_START + (ls_val + 2) * SLOT_SIZE), "sessionType": "IndirectTime"
                    })

        return JSONResponse({
            "success": status in [cp_model.OPTIMAL, cp_model.FEASIBLE],
            "status": solver.StatusName(status),
            "schedule": schedule_entries
        })
    except Exception as e:
        import traceback
        return JSONResponse({"error": str(e), "trace": traceback.format_exc()}, status_code=500)

def create_entry(client, therapist, day, start_slot, end_slot, op_start, slot_size, session_type="ABA"):
    return {
        "id": f"cpsat-{client['id']}-{therapist['id']}-{start_slot}",
        "clientId": client['id'], "clientName": client['name'], "therapistId": therapist['id'], "therapistName": therapist['name'],
        "day": day, "startTime": minutes_to_time(op_start + start_slot * slot_size), "endTime": minutes_to_time(op_start + end_slot * slot_size), "sessionType": session_type
    }
