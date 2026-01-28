# Schedule Generation Algorithm Improvements

## Overview
Systematically improved the CSO (Chicken Swarm Optimization) schedule generation algorithm to ensure generated schedules follow all hard constraints. The improvements address root causes of rule violations rather than just penalizing them.

## Problems Fixed

### 1. **Gap Filling Logic (Former Issue)**
**Problem**: `fixClientCoverageGaps()` was looping through every 15-minute interval and trying to fill with 60-minute sessions, causing explosive fitness penalties (105+ errors per client).

**Solution**:
- Moved to `constraintValidator.getClientCoverageGaps()` which intelligently identifies actual coverage gaps
- Only attempts to fill gaps >= 60 minutes (respects minimum ABA session duration)
- Uses dynamic session lengths (60-120 min) that fit within available gaps
- Tries progressively shorter sessions (120→60 min) to maximize fit

**Impact**: Eliminates false gap reports and reduces fitness explosion

### 2. **Weak Constraint Enforcement During Initialization**
**Problem**: Greedy initialization didn't respect the 120-minute ABA session limit and session duration constraints were only enforced through fitness penalties.

**Solution**:
- Created `constraintValidator.ts` module with hard constraint checks:
  - `canAddEntryToSchedule()` - validates all hard constraints before adding
  - `hasTherapistConflict()` - checks therapist time conflicts
  - `hasClientConflict()` - checks client time conflicts
  - `hasCalloutConflict()` - verifies callout compatibility
  - `isSessionDurationValid()` - enforces duration rules upfront
- Improved initialization uses dynamic session lengths that respect maxima
- Validates before adding entries to schedule

**Impact**: Schedules start with fewer constraint violations, reducing repair burden

### 3. **Explosive Fitness Penalties**
**Problem**: Client coverage gap penalty was applied per 15-minute interval. A single uncovered client could generate 50+ errors (gaps × therapists × factors).

**Solution**:
- Rewrote `calculateFitness()` to count errors by rule type instead of individual error objects
- Cap penalties at reasonable multiples:
  - `CONFLICT_PENALTY * Math.min(count, 3)` - cap at 3 conflicts max
  - `MISSING_LUNCH_PENALTY * Math.min(count, 10)` - cap at 10 lunch issues
  - `CLIENT_COVERAGE_GAP_PENALTY * Math.min(count / 4, 1)` - divide gap count by 4, cap at 1
- Prevents fitness scores from becoming astronomically large
- Allows algorithm to make progress on other constraints

**Impact**: Fitness scores are more meaningful; algorithm can escape gap-penalty trap

### 4. **Suboptimal Repair Order**
**Problem**: Repairs were applied sequentially without dependency consideration:
- Filling gaps before fixing session durations
- Adding lunch before removing overlapping sessions
- Not respecting BCBA requirements

**Solution**: Reorganized repair order to handle dependencies:
1. `cleanupScheduleIssues()` - merge overlaps, resolve double bookings
2. `fixSessionDurations()` - enforce 60-120 min ABA limits
3. `fixCredentialIssues()` - swap unqualified therapists
4. `fixMdMedicaidLimit()` - enforce therapist limits for MD Medicaid clients
5. `fixClientCoverageGaps()` - fill remaining gaps with validated sessions
6. `fixLunchIssues()` - schedule/split for lunch breaks
7. `fixBcbaDirectTime()` - ensure BCBA direct client contact
8. `fixTeamAlignmentIssues()` - soft preference enforcement

**Impact**: Repairs support each other instead of conflicting; fewer side effects

### 5. **Improved Gap Filling Algorithm**
**Before**:
```
For every 15-minute interval:
  If gap exists:
    Try to add 60-min ABA session
```
Result: Many failed attempts, fitness explosion

**After**:
```
For each actual coverage gap:
  If gap >= 60 minutes:
    Calculate max valid session length (min of gap size and 120)
    Try session lengths from max down to 60 in 15-min steps
    Add session if therapist available
```
Result: Respects constraints naturally, fewer failed attempts

## Technical Improvements

### New Module: `constraintValidator.ts`
- **Purpose**: Centralized constraint checking before modifications
- **Key Functions**:
  - `canAddEntryToSchedule()` - composite validation with violation reporting
  - `getClientCoverageGaps()` - intelligent gap detection that respects callouts
  - `getMdMedicaidTherapistCount()` - tracks insurance requirements
  - `therapistHasLunch()` - lunch validation
  - `therapistHasDirectClientTime()` - BCBA requirement checking

### Improved Fitness Calculation
- Groups errors by rule type instead of counting individually
- Applies reasonable caps to prevent explosion
- Prioritizes hard violations (conflicts, credentials, callouts)
- Soft violations (alignment, unmet needs) weighted lower

### Smarter Initialization
- Uses gap-aware filling instead of blind interval checking
- Respects session duration rules from the start
- More likely to produce valid initial populations

## Algorithm Parameters (Unchanged)
```
POPULATION_SIZE = 50
MAX_GENERATIONS = 150
ELITISM_RATE = 0.1
CROSSOVER_RATE = 0.7
MUTATION_RATE = 0.95
```

## Expected Improvements

1. **Faster Convergence**: Better initial populations and more meaningful fitness
2. **Higher Quality Schedules**: Fewer rule violations by design
3. **More Valid Solutions**: Repair order respects constraints
4. **Better Fitness Scores**: Penaltyscape is less chaotic

## Testing Recommendations

1. Generate 10 schedules and verify zero hard constraint violations
2. Check that coverage gaps are minimal (< 30 min per client preferred)
3. Verify all therapists have lunch breaks when working
4. Confirm MD Medicaid clients respect 3-therapist limit
5. Check BCBA therapists have direct client time
6. Verify no overlapping sessions for therapists or clients
7. Confirm all sessions respect insurance qualifications

## Files Modified

- `services/csoService.ts` - Improved initialization, repair order, fitness calculation
- `services/constraintValidator.ts` - New constraint validation module

## Files Created

- `services/constraintValidator.ts` - Hard constraint checking and gap detection

## Backward Compatibility

All changes are backward compatible. The algorithm still uses the same genetic algorithm core with tournament selection, crossover, and mutation. Only the constraint handling and fitness evaluation have been improved.
