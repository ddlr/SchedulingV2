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
    // High contrast distinct colors
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6',
    '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3',
    '#808000', '#ffd8b1', '#000075', '#808080', '#ffffff', '#000000',
    // Modern vibrant palette
    '#FF6633', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6',
    '#E6B333', '#3366E6', '#999966', '#99FF99', '#B34D4D',
    '#80B300', '#809900', '#E6B3B3', '#6680B3', '#66991A',
    '#FF99E6', '#CCFF1A', '#FF1A66', '#E6331A', '#33FFCC',
    '#66994D', '#B366CC', '#4D8000', '#B33300', '#CC80CC',
    '#66664D', '#991AFF', '#E666FF', '#4DB3FF', '#1AB399',
    '#E666B3', '#33991A', '#CC9999', '#B3B31A', '#00E680',
    '#4D8066', '#809980', '#E6FF80', '#1AFF33', '#999933',
    '#FF3380', '#CCCC00', '#66E64D', '#4D80CC', '#9900B3',
    '#E64D66', '#4DB380', '#FF4D4D', '#99E6E6', '#6666FF'
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
