import { Therapist } from '../types';
import { supabase } from '../lib/supabase';
import { getCurrentOrgId, getCurrentOrgIdOrNull } from './orgHelper';

let _therapists: Therapist[] = [];
let _initialized = false;
let _realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
const listeners: Array<(therapists: Therapist[]) => void> = [];

const notifyListeners = () => {
  listeners.forEach(listener => listener([..._therapists]));
};

const loadTherapists = async () => {
  try {
    const orgId = getCurrentOrgId();
    const { data, error } = await supabase
      .from('therapists')
      .select('*')
      .eq('organization_id', orgId)
      .order('name');

    if (error) throw error;

    _therapists = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      role: row.role || "BT",
      teamId: row.team_id || undefined,
      qualifications: row.qualifications || []
    }));

    notifyListeners();
  } catch (error) {
    console.error("Error loading therapists from Supabase:", error);
    _therapists = [];
  }
};

const setupRealtimeSubscription = () => {
  if (_realtimeChannel) {
    supabase.removeChannel(_realtimeChannel);
  }
  const orgId = getCurrentOrgIdOrNull();
  if (!orgId) return;
  _realtimeChannel = supabase
    .channel('therapists_changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'therapists',
      filter: `organization_id=eq.${orgId}`
    }, () => {
      loadTherapists();
    })
    .subscribe();
};

const ensureInitialized = () => {
  if (!_initialized) {
    _initialized = true;
    loadTherapists();
    setupRealtimeSubscription();
  }
};

export const reinitializeTherapists = () => {
  _initialized = false;
  _therapists = [];
  ensureInitialized();
};

export const getTherapists = (): Therapist[] => {
  return [..._therapists];
};

export const addTherapist = async (newTherapistData: Omit<Therapist, 'id'>): Promise<Therapist> => {
  try {
    const orgId = getCurrentOrgId();
    const newId = crypto.randomUUID();
    const { data, error } = await supabase
      .from('therapists')
      .insert({
        id: newId,
        name: newTherapistData.name,
        role: newTherapistData.role,
        team_id: newTherapistData.teamId || null,
        qualifications: newTherapistData.qualifications || [],
        organization_id: orgId
      })
      .select()
      .single();

    if (error) throw error;

    const therapist: Therapist = {
      id: data.id,
      name: data.name,
      role: data.role,
      teamId: data.team_id || undefined,
      qualifications: data.qualifications || []
    };

    await loadTherapists();
    return therapist;
  } catch (error) {
    console.error("Error adding therapist:", error);
    throw error;
  }
};

export const updateTherapist = async (updatedTherapist: Therapist): Promise<Therapist | undefined> => {
  try {
    const { error } = await supabase
      .from('therapists')
      .update({
        name: updatedTherapist.name,
        role: updatedTherapist.role,
        team_id: updatedTherapist.teamId || null,
        qualifications: updatedTherapist.qualifications,
        updated_at: new Date().toISOString()
      })
      .eq('id', updatedTherapist.id);

    if (error) throw error;

    await loadTherapists();
    return updatedTherapist;
  } catch (error) {
    console.error("Error updating therapist:", error);
    throw error;
  }
};

export const removeTherapist = async (therapistId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('therapists')
      .delete()
      .eq('id', therapistId);

    if (error) throw error;

    await loadTherapists();
    return true;
  } catch (error) {
    console.error("Error removing therapist:", error);
    return false;
  }
};

export const addOrUpdateBulkTherapists = async (therapistsToProcess: Partial<Therapist>[]): Promise<{ addedCount: number; updatedCount: number; errors: string[] }> => {
  let addedCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];
  const orgId = getCurrentOrgIdOrNull();
  if (!orgId) return { addedCount: 0, updatedCount: 0, errors: ['Organization not set'] };

  for (const therapistData of therapistsToProcess) {
    if (!therapistData.name) continue;

    try {
      const { data: existing, error: findError } = await supabase
        .from('therapists')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('name', therapistData.name)
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        const updateData: any = { updated_at: new Date().toISOString() };
        if (therapistData.role !== undefined) updateData.role = therapistData.role;
        if (therapistData.teamId !== undefined) updateData.team_id = therapistData.teamId || null;
        if (therapistData.qualifications !== undefined) updateData.qualifications = therapistData.qualifications;

        const { error: updateError } = await supabase
          .from('therapists')
          .update(updateData)
          .eq('id', existing.id);

        if (updateError) throw updateError;
        updatedCount++;
      } else {
        const { error: insertError } = await supabase
          .from('therapists')
          .insert({
            id: crypto.randomUUID(),
            name: therapistData.name,
            role: therapistData.role || "BT",
            team_id: therapistData.teamId || null,
            qualifications: therapistData.qualifications || [],
            organization_id: orgId
          });

        if (insertError) throw insertError;
        addedCount++;
      }
    } catch (error: any) {
      const msg = `Error processing staff "${therapistData.name}": ${error.message || 'Unknown error'}`;
      console.error(msg, error);
      errors.push(msg);
    }
  }

  await loadTherapists();
  return { addedCount, updatedCount, errors };
};

export const removeTherapistsByNames = async (therapistNamesToRemove: string[]): Promise<{ removedCount: number }> => {
  let removedCount = 0;

  for (const name of therapistNamesToRemove) {
    try {
      const { data } = await supabase
        .from('therapists')
        .delete()
        .ilike('name', name)
        .select();

      if (data) removedCount += data.length;
    } catch (error) {
      console.error("Error removing therapist:", name, error);
    }
  }

  await loadTherapists();
  return { removedCount };
};

export const subscribeToTherapists = (listener: (therapists: Therapist[]) => void): (() => void) => {
  listeners.push(listener);
  ensureInitialized();
  listener([..._therapists]);
  loadTherapists();

  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
};
