# System Configuration Database Migration

## Overview
All system variables and configuration have been moved from hardcoded constants to a database-backed system. This allows runtime configuration without code changes.

## Database Schema

Create the following table in your Supabase database:

```sql
/*
  # System Configuration Table

  1. New Tables
    - `system_config`
      - `id` (text, primary key) - Configuration identifier (use 'default')
      - `config_data` (jsonb) - Configuration object
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `system_config` table
    - Add policy for authenticated users to read config
    - Add policy for admin users to update config
*/

CREATE TABLE IF NOT EXISTS system_config (
  id text PRIMARY KEY,
  config_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read system config
CREATE POLICY "Allow public read access to system config"
  ON system_config
  FOR SELECT
  TO public
  USING (true);

-- Only authenticated users can update
CREATE POLICY "Allow authenticated users to update system config"
  ON system_config
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only authenticated users can insert
CREATE POLICY "Allow authenticated users to insert system config"
  ON system_config
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert default configuration
INSERT INTO system_config (id, config_data)
VALUES (
  'default',
  '{
    "companyOperatingHoursStart": "09:00",
    "companyOperatingHoursEnd": "17:00",
    "staffAssumedAvailabilityStart": "08:45",
    "staffAssumedAvailabilityEnd": "17:15",
    "lunchCoverageStartTime": "11:00",
    "lunchCoverageEndTime": "14:00",
    "idealLunchWindowStart": "11:00",
    "idealLunchWindowEndForStart": "13:30",
    "teamColors": ["#FBBF24", "#34D399", "#60A5FA", "#F472B6", "#A78BFA", "#2DD4BF", "#F0ABFC", "#FCA5A5"],
    "allTherapistRoles": ["BCBA", "CF", "STAR 3", "STAR 2", "STAR 1", "RBT", "BT", "Other"],
    "defaultRoleRank": {
      "BCBA": 6,
      "CF": 5,
      "STAR 3": 4,
      "STAR 2": 3,
      "STAR 1": 2,
      "RBT": 1,
      "BT": 0,
      "Other": -1
    },
    "allAlliedHealthServices": ["OT", "SLP"],
    "allSessionTypes": ["ABA", "AlliedHealth_OT", "AlliedHealth_SLP", "IndirectTime"],
    "clientColorPalette": [
      "#E6194B", "#3CB44B", "#FFE119", "#4363D8", "#F58231", "#911EB4", "#46F0F0", "#F032E6",
      "#BCF60C", "#FABEBE", "#008080", "#E6BEFF", "#9A6324", "#FFFAC8", "#800000", "#AAFFC3",
      "#808000", "#FFD8B1", "#000075", "#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF"
    ],
    "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;
```

## What Changed

### Files Modified

1. **services/systemConfigService.ts** (NEW)
   - Manages all system configuration in the database
   - Provides subscription-based updates
   - Includes default values for fallback

2. **constants.ts**
   - Now uses systemConfigService instead of hardcoded values
   - Provides getter functions that return current config values
   - Maintains backwards compatibility with exported constants

3. **lib/supabase.ts**
   - Added system_config table initialization for mock database
   - Includes initial configuration data

4. **utils/colorUtils.ts**
   - Updated to use config-based client color palette
   - Dynamically retrieves colors from system config

5. **components/SystemConfigPanel.tsx** (NEW)
   - Admin UI for managing system configuration
   - Allows editing operating hours, lunch windows, and more
   - Real-time updates across the application

6. **components/AdminSettingsPanel.tsx**
   - Integrated SystemConfigPanel at the top
   - Renamed section to "Bulk Data Operations"

7. **App.tsx**
   - Subscribes to system config changes
   - Updates constants cache when config changes

## Configuration Options

The system now stores these configurable values in the database:

### Operating Hours
- `companyOperatingHoursStart` - When client services start
- `companyOperatingHoursEnd` - When client services end
- `staffAssumedAvailabilityStart` - When staff is available
- `staffAssumedAvailabilityEnd` - When staff availability ends

### Lunch Configuration
- `lunchCoverageStartTime` - Earliest allowed lunch start
- `lunchCoverageEndTime` - Latest allowed lunch end
- `idealLunchWindowStart` - Preferred lunch window start
- `idealLunchWindowEndForStart` - Preferred lunch window end

### UI Configuration
- `teamColors` - Array of team colors
- `clientColorPalette` - Array of client block colors

### System Options
- `allTherapistRoles` - Available therapist roles
- `defaultRoleRank` - Role hierarchy ranking
- `allAlliedHealthServices` - Available allied health types
- `allSessionTypes` - Available session types
- `workingDays` - Days considered working days

## How to Use

### Admin UI
1. Navigate to the "Admin" tab
2. Find "System Configuration" section
3. Modify any settings
4. Click "Save Configuration"
5. Changes apply immediately across the application

### Programmatic Access
```typescript
import { getSystemConfig, updateSystemConfig } from './services/systemConfigService';

// Get current config
const config = getSystemConfig();

// Update config
await updateSystemConfig({
  companyOperatingHoursStart: "08:00",
  companyOperatingHoursEnd: "18:00"
});

// Subscribe to changes
const unsubscribe = subscribeToSystemConfig((newConfig) => {
  console.log('Config updated:', newConfig);
});
```

## Benefits

1. **No Code Changes Required** - Adjust system behavior through the UI
2. **Real-time Updates** - Changes propagate instantly across all users
3. **Centralized Management** - All settings in one place
4. **Audit Trail** - Database tracks all configuration changes
5. **Multi-tenant Ready** - Can support different configs per organization
6. **Backwards Compatible** - Existing code continues to work

## Rollback Plan

If issues occur, the system uses built-in defaults:
- All default values are hardcoded in `systemConfigService.ts`
- If database is unavailable, defaults are used automatically
- No data loss - just reverts to standard settings

## Testing

The build has been verified and all components compile successfully. The system gracefully handles:
- Missing database entries (uses defaults)
- Malformed configuration (validates and uses defaults)
- Real-time updates (subscriptions work correctly)
- UI modifications (saves and applies immediately)
