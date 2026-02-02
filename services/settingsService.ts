import { supabase } from '../lib/supabase';
import { InsuranceQualification } from '../types';

let _qualifications: InsuranceQualification[] = [];
const listeners: Array<(qualifications: InsuranceQualification[]) => void> = [];

const notifyListeners = () => {
  listeners.forEach(listener => listener([..._qualifications]));
};

const loadQualifications = async () => {
  try {
    const { data, error } = await supabase
      .from('insurance_qualifications')
      .select('*')
      .order('id');

    if (error) throw error;

    if (data && data.length > 0) {
      _qualifications = data.map(row => ({
        id: row.id,
        maxStaffPerDay: row.max_staff_per_day ?? undefined,
        minSessionDurationMinutes: row.min_session_duration_minutes ?? undefined,
        maxSessionDurationMinutes: row.max_session_duration_minutes ?? undefined,
        maxHoursPerWeek: row.max_hours_per_week ?? undefined,
        roleHierarchyOrder: row.role_hierarchy_order ?? undefined,
      }));
    } else {
      // If table is empty, we could insert defaults, but the migration should have handled it.
      // For safety, if it's still empty, we'll initialize it.
      const defaults: InsuranceQualification[] = [
        { id: 'BCBA' },
        { id: 'Clinical Fellow' },
        { id: 'MD_MEDICAID', maxStaffPerDay: 3 },
        { id: 'RBT' }
      ];

      for (const item of defaults) {
        await supabase.from('insurance_qualifications').insert({
          id: item.id,
          max_staff_per_day: item.maxStaffPerDay || null
        });
      }

      // Reload after insertion
      return loadQualifications();
    }

    notifyListeners();
  } catch (error) {
    console.error("Error loading qualifications from Supabase:", error);
    _qualifications = [];
  }
};

loadQualifications();

const setupRealtimeSubscription = () => {
  supabase
    .channel('insurance_qualifications_changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'insurance_qualifications'
    }, () => {
      loadQualifications();
    })
    .subscribe();
};

setupRealtimeSubscription();

export const getInsuranceQualifications = (): InsuranceQualification[] => {
  return [..._qualifications];
};

export const updateInsuranceQualifications = async (updatedQualifications: InsuranceQualification[]): Promise<InsuranceQualification[]> => {
  try {
    const existingIds = _qualifications.map(q => q.id);
    const updatedIds = updatedQualifications.map(q => q.id);

    // Delete removed ones
    const toDelete = existingIds.filter(id => !updatedIds.includes(id));
    for (const id of toDelete) {
        await supabase.from('insurance_qualifications').delete().eq('id', id);
    }

    // Upsert current ones
    for (const q of updatedQualifications) {
        await supabase
          .from('insurance_qualifications')
          .upsert({
            id: q.id,
            max_staff_per_day: q.maxStaffPerDay ?? null,
            min_session_duration_minutes: q.minSessionDurationMinutes ?? null,
            max_session_duration_minutes: q.maxSessionDurationMinutes ?? null,
            max_hours_per_week: q.maxHoursPerWeek ?? null,
            role_hierarchy_order: q.roleHierarchyOrder ?? null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          });
    }

    await loadQualifications();
    return [..._qualifications];
  } catch (error) {
    console.error("Error updating qualifications:", error);
    throw error;
  }
};

export const subscribeToInsuranceQualifications = (listener: (qualifications: InsuranceQualification[]) => void): (() => void) => {
  listeners.push(listener);
  listener([..._qualifications]);

  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
};