import { supabase } from '../lib/supabase';
import { InsuranceQualification } from '../types';
import { getCurrentOrgId } from './orgHelper';

let _qualifications: InsuranceQualification[] = [];
let _initialized = false;
let _realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
const listeners: Array<(qualifications: InsuranceQualification[]) => void> = [];
const SETTINGS_KEY = 'insurance_qualifications';

const notifyListeners = () => {
  listeners.forEach(listener => listener([..._qualifications]));
};

const loadQualifications = async () => {
  try {
    const orgId = getCurrentOrgId();
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('organization_id', orgId)
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (error) throw error;

    if (data && data.value) {
      const rawValue = Array.isArray(data.value) ? data.value : [];
      _qualifications = rawValue.map((item: any) => {
        if (typeof item === 'string') {
          return {
            id: item,
            maxTherapistsPerDay: item === 'MD_MEDICAID' ? 3 : undefined
          };
        }
        return item as InsuranceQualification;
      });
    } else {
      _qualifications = [
        { id: 'BCBA' },
        { id: 'Clinical Fellow' },
        { id: 'MD_MEDICAID', maxTherapistsPerDay: 3 },
        { id: 'RBT' }
      ];
      const orgId = getCurrentOrgId();
      await supabase
        .from('settings')
        .insert({
          key: SETTINGS_KEY,
          value: _qualifications,
          organization_id: orgId
        });
    }

    _qualifications = _qualifications.sort((a, b) => a.id.localeCompare(b.id));
    notifyListeners();
  } catch (error) {
    console.error("Error loading qualifications from Supabase:", error);
    _qualifications = [];
  }
};

const setupRealtimeSubscription = () => {
  if (_realtimeChannel) {
    supabase.removeChannel(_realtimeChannel);
  }
  _realtimeChannel = supabase
    .channel('settings_changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'settings',
      filter: `key=eq.${SETTINGS_KEY}`
    }, () => {
      loadQualifications();
    })
    .subscribe();
};

const ensureInitialized = () => {
  if (!_initialized) {
    _initialized = true;
    loadQualifications();
    setupRealtimeSubscription();
  }
};

export const reinitializeSettings = () => {
  _initialized = false;
  _qualifications = [];
  ensureInitialized();
};

export const getInsuranceQualifications = (): InsuranceQualification[] => {
  return [..._qualifications];
};

export const updateInsuranceQualifications = async (updatedQualifications: InsuranceQualification[]): Promise<InsuranceQualification[]> => {
  try {
    const orgId = getCurrentOrgId();
    const sortedQualifications = [...updatedQualifications].sort((a, b) => a.id.localeCompare(b.id));

    const { error } = await supabase
      .from('settings')
      .upsert({
        key: SETTINGS_KEY,
        value: sortedQualifications,
        organization_id: orgId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'organization_id,key'
      });

    if (error) throw error;

    await loadQualifications();
    return [..._qualifications];
  } catch (error) {
    console.error("Error updating qualifications:", error);
    throw error;
  }
};

export const subscribeToInsuranceQualifications = (listener: (qualifications: InsuranceQualification[]) => void): (() => void) => {
  listeners.push(listener);
  ensureInitialized();
  listener([..._qualifications]);
  loadQualifications();

  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
};
