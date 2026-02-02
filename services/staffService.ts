import { Staff } from '../types';
import { supabase } from '../lib/supabase';

let _staff: Staff[] = [];
const listeners: Array<(staff: Staff[]) => void> = [];

const notifyListeners = () => {
  listeners.forEach(listener => listener([..._staff]));
};

const loadStaff = async () => {
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('name');

    if (error) throw error;

    _staff = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      role: row.role || "BT",
      teamId: row.team_id || undefined,
      qualifications: row.qualifications || [],
      canProvideAlliedHealth: row.can_provide_allied_health || []
    }));

    notifyListeners();
  } catch (error) {
    console.error("Error loading staff from Supabase:", error);
    _staff = [];
  }
};

loadStaff();

const setupRealtimeSubscription = () => {
  supabase
    .channel('staff_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => {
      loadStaff();
    })
    .subscribe();
};

setupRealtimeSubscription();

export const getStaff = (): Staff[] => {
  return [..._staff];
};

export const addStaff = async (newStaffData: Omit<Staff, 'id'>): Promise<Staff> => {
  try {
    const { data, error } = await supabase
      .from('staff')
      .insert({
        name: newStaffData.name,
        role: newStaffData.role,
        team_id: newStaffData.teamId || null,
        qualifications: newStaffData.qualifications || [],
        can_provide_allied_health: newStaffData.canProvideAlliedHealth || []
      })
      .select()
      .single();

    if (error) throw error;

    const staff: Staff = {
      id: data.id,
      name: data.name,
      role: data.role,
      teamId: data.team_id || undefined,
      qualifications: data.qualifications || [],
      canProvideAlliedHealth: data.can_provide_allied_health || []
    };

    await loadStaff();
    return staff;
  } catch (error) {
    console.error("Error adding staff:", error);
    throw error;
  }
};

export const updateStaff = async (updatedStaff: Staff): Promise<Staff | undefined> => {
  try {
    const { error } = await supabase
      .from('staff')
      .update({
        name: updatedStaff.name,
        role: updatedStaff.role,
        team_id: updatedStaff.teamId || null,
        qualifications: updatedStaff.qualifications,
        can_provide_allied_health: updatedStaff.canProvideAlliedHealth,
        updated_at: new Date().toISOString()
      })
      .eq('id', updatedStaff.id);

    if (error) throw error;

    await loadStaff();
    return updatedStaff;
  } catch (error) {
    console.error("Error updating staff:", error);
    throw error;
  }
};

export const removeStaff = async (staffId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('staff')
      .delete()
      .eq('id', staffId);

    if (error) throw error;

    await loadStaff();
    return true;
  } catch (error) {
    console.error("Error removing staff:", error);
    return false;
  }
};

export const addOrUpdateBulkStaff = async (staffToProcess: Partial<Staff>[]): Promise<{ addedCount: number; updatedCount: number }> => {
  let addedCount = 0;
  let updatedCount = 0;

  for (const staffData of staffToProcess) {
    if (!staffData.name) continue;

    try {
      const { data: existing } = await supabase
        .from('staff')
        .select('id')
        .ilike('name', staffData.name)
        .maybeSingle();

      if (existing) {
        const updateData: any = { updated_at: new Date().toISOString() };
        if (staffData.role !== undefined) updateData.role = staffData.role;
        if (staffData.teamId !== undefined) updateData.team_id = staffData.teamId || null;
        if (staffData.qualifications !== undefined) updateData.qualifications = staffData.qualifications;
        if (staffData.canProvideAlliedHealth !== undefined) updateData.can_provide_allied_health = staffData.canProvideAlliedHealth;

        await supabase
          .from('staff')
          .update(updateData)
          .eq('id', existing.id);

        updatedCount++;
      } else {
        await supabase
          .from('staff')
          .insert({
            name: staffData.name,
            role: staffData.role || "BT",
            team_id: staffData.teamId || null,
            qualifications: staffData.qualifications || [],
            can_provide_allied_health: staffData.canProvideAlliedHealth || []
          });

        addedCount++;
      }
    } catch (error) {
      console.error("Error processing staff:", staffData.name, error);
    }
  }

  await loadStaff();
  return { addedCount, updatedCount };
};

export const removeStaffByNames = async (staffNamesToRemove: string[]): Promise<{ removedCount: number }> => {
  let removedCount = 0;

  for (const name of staffNamesToRemove) {
    try {
      const { data } = await supabase
        .from('staff')
        .delete()
        .ilike('name', name)
        .select();

      if (data) removedCount += data.length;
    } catch (error) {
      console.error("Error removing staff:", name, error);
    }
  }

  await loadStaff();
  return { removedCount };
};

export const subscribeToStaff = (listener: (staff: Staff[]) => void): (() => void) => {
  listeners.push(listener);
  listener([..._staff]);

  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
};