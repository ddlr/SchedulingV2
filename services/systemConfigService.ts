import { supabase } from '../lib/supabase';
import { DayOfWeek, TherapistRole } from '../types';

export interface SystemConfig {
  companyOperatingHoursStart: string;
  companyOperatingHoursEnd: string;
  staffAssumedAvailabilityStart: string;
  staffAssumedAvailabilityEnd: string;
  lunchCoverageStartTime: string;
  lunchCoverageEndTime: string;
  idealLunchWindowStart: string;
  idealLunchWindowEndForStart: string;
  teamColors: string[];
  allTherapistRoles: TherapistRole[];
  defaultRoleRank: Record<string, number>;
  allAlliedHealthServices: string[];
  allSessionTypes: string[];
  clientColorPalette: string[];
  workingDays: DayOfWeek[];
}

const DEFAULT_CONFIG: SystemConfig = {
  companyOperatingHoursStart: "09:00",
  companyOperatingHoursEnd: "17:00",
  staffAssumedAvailabilityStart: "08:45",
  staffAssumedAvailabilityEnd: "17:15",
  lunchCoverageStartTime: "11:00",
  lunchCoverageEndTime: "14:00",
  idealLunchWindowStart: "11:00",
  idealLunchWindowEndForStart: "13:30",
  teamColors: [
    '#FBBF24', '#34D399', '#60A5FA', '#F472B6',
    '#A78BFA', '#2DD4BF', '#F0ABFC', '#FCA5A5'
  ],
  allTherapistRoles: ["BCBA", "CF", "STAR 3", "STAR 2", "STAR 1", "RBT", "BT", "OT", "SLP", "Other"],
  defaultRoleRank: {
    "BCBA": 6,
    "CF": 5,
    "STAR 3": 4,
    "STAR 2": 3,
    "STAR 1": 2,
    "RBT": 1,
    "BT": 0,
    "OT": -1,
    "SLP": -1,
    "Other": -1
  },
  allAlliedHealthServices: ["OT", "SLP"],
  allSessionTypes: ['ABA', 'AlliedHealth_OT', 'AlliedHealth_SLP', 'IndirectTime'],
  clientColorPalette: [
    '#E6194B', '#3CB44B', '#FFE119', '#4363D8', '#F58231', '#911EB4', '#46F0F0', '#F032E6',
    '#BCF60C', '#FABEBE', '#008080', '#E6BEFF', '#9A6324', '#FFFAC8', '#800000', '#AAFFC3',
    '#808000', '#FFD8B1', '#000075', '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
    '#D4A5A5', '#FF7F50', '#6495ED', '#483D8B', '#00CED1', '#9400D3', '#FF1493', '#00BFFF',
    '#ADFF2F', '#FF69B4', '#CD5C5C', '#4B0082', '#F0E68C', '#7CFC00', '#FFFAC8',
    '#ADD8E6', '#F08080', '#E0FFFF', '#FAFAD2', '#90EE90', '#FFB6C1', '#FFA07A', '#20B2AA',
    '#87CEFA', '#B0C4DE', '#FFFFE0', '#00FF00', '#32CD32', '#FAF0E6', '#FF00FF',
    '#FF4500', '#DA70D6', '#EEE8AA', '#98FB98', '#AFEEEE', '#DB7093', '#FFEFD5', '#FFDAB9',
    '#CD853F', '#FFC0CB', '#DDA0DD', '#B0E0E6', '#FF0000', '#BC8F8F', '#4169E1', '#8B4513',
    '#FA8072', '#F4A460', '#2E8B57', '#A0522D', '#87CEEB', '#6A5ACD', '#00FF7F', '#4682B4',
    '#D2B48C', '#008080', '#D8BFD8', '#FF6347', '#40E0D0', '#EE82EE', '#F5DEB3', '#FFFF00',
    '#9ACD32', '#FF4500', '#2E8B57', '#4682B4', '#D2691E', '#FF8C00', '#0000CD'
  ],
  workingDays: [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY
  ]
};

let _config: SystemConfig = { ...DEFAULT_CONFIG };
const listeners: Array<(config: SystemConfig) => void> = [];

const notifyListeners = () => {
  listeners.forEach(listener => listener({ ..._config }));
};

const loadConfig = async () => {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .maybeSingle();

    if (error) throw error;

    if (data && data.config_data) {
      _config = { ...DEFAULT_CONFIG, ...data.config_data };
    } else {
      _config = { ...DEFAULT_CONFIG };
      await supabase
        .from('system_config')
        .insert({
          id: 'default',
          config_data: _config
        });
    }

    notifyListeners();
  } catch (error) {
    console.error("Error loading system config from Supabase:", error);
    _config = { ...DEFAULT_CONFIG };
  }
};

loadConfig();

const setupRealtimeSubscription = () => {
  supabase
    .channel('system_config_changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'system_config'
    }, () => {
      loadConfig();
    })
    .subscribe();
};

setupRealtimeSubscription();

export const getSystemConfig = (): SystemConfig => {
  return { ..._config };
};

export const updateSystemConfig = async (updatedConfig: Partial<SystemConfig>): Promise<SystemConfig> => {
  try {
    const newConfig = { ..._config, ...updatedConfig };

    const { error } = await supabase
      .from('system_config')
      .upsert({
        id: 'default',
        config_data: newConfig,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (error) throw error;

    await loadConfig();
    return { ..._config };
  } catch (error) {
    console.error("Error updating system config:", error);
    throw error;
  }
};

export const subscribeToSystemConfig = (listener: (config: SystemConfig) => void): (() => void) => {
  listeners.push(listener);
  listener({ ..._config });

  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
};

export const resetToDefaults = async (): Promise<SystemConfig> => {
  return updateSystemConfig(DEFAULT_CONFIG);
};

export const generateTimeSlots = (config: SystemConfig): string[] => {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
};
