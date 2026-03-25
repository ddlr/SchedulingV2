import { Callout } from '../types';
import { supabase } from '../lib/supabase';
import { getCurrentOrgId } from './orgHelper';

let _callouts: Callout[] = [];
let _initialized = false;
let _realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
const listeners: Array<(callouts: Callout[]) => void> = [];

const notifyListeners = () => {
  listeners.forEach(listener => listener([..._callouts]));
};

const loadCallouts = async () => {
  try {
    const orgId = getCurrentOrgId();
    const { data, error } = await supabase
      .from('callouts')
      .select('*')
      .eq('organization_id', orgId)
      .order('start_date')
      .order('start_time');

    if (error) throw error;

    _callouts = (data || []).map(row => ({
      id: row.id,
      entityType: row.entity_type as 'client' | 'therapist',
      entityId: row.entity_id,
      entityName: row.entity_name,
      startDate: row.start_date,
      endDate: row.end_date,
      startTime: row.start_time,
      endTime: row.end_time,
      reason: row.reason
    }));

    notifyListeners();
  } catch (error) {
    console.error("Error loading callouts from Supabase:", error);
    _callouts = [];
  }
};

const setupRealtimeSubscription = () => {
  if (_realtimeChannel) {
    supabase.removeChannel(_realtimeChannel);
  }
  const orgId = getCurrentOrgId();
  _realtimeChannel = supabase
    .channel('callouts_changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'callouts',
      filter: `organization_id=eq.${orgId}`
    }, () => {
      loadCallouts();
    })
    .subscribe();
};

const ensureInitialized = () => {
  if (!_initialized) {
    _initialized = true;
    loadCallouts();
    setupRealtimeSubscription();
  }
};

export const reinitializeCallouts = () => {
  _initialized = false;
  _callouts = [];
  ensureInitialized();
};

export const getCallouts = (): Callout[] => {
  return [..._callouts];
};

export const addCalloutEntry = async (newCallout: Omit<Callout, 'id'>): Promise<Callout[]> => {
  try {
    const orgId = getCurrentOrgId();
    const id = `callout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const { error } = await supabase
      .from('callouts')
      .insert({
        id,
        entity_type: newCallout.entityType,
        entity_id: newCallout.entityId,
        entity_name: newCallout.entityName,
        start_date: newCallout.startDate,
        end_date: newCallout.endDate,
        start_time: newCallout.startTime,
        end_time: newCallout.endTime,
        reason: newCallout.reason,
        organization_id: orgId
      });

    if (error) throw error;

    await loadCallouts();
    return [..._callouts];
  } catch (error) {
    console.error("Error adding callout:", error);
    throw error;
  }
};

export const removeCalloutEntry = async (calloutId: string): Promise<Callout[]> => {
  try {
    const { error } = await supabase
      .from('callouts')
      .delete()
      .eq('id', calloutId);

    if (error) throw error;

    await loadCallouts();
    return [..._callouts];
  } catch (error) {
    console.error("Error removing callout:", error);
    throw error;
  }
};

export const updateCalloutEntry = async (updatedCallout: Callout): Promise<Callout[]> => {
  try {
    const { error } = await supabase
      .from('callouts')
      .update({
        entity_type: updatedCallout.entityType,
        entity_id: updatedCallout.entityId,
        entity_name: updatedCallout.entityName,
        start_date: updatedCallout.startDate,
        end_date: updatedCallout.endDate,
        start_time: updatedCallout.startTime,
        end_time: updatedCallout.endTime,
        reason: updatedCallout.reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', updatedCallout.id);

    if (error) throw error;

    await loadCallouts();
    return [..._callouts];
  } catch (error) {
    console.error("Error updating callout:", error);
    throw error;
  }
};

export const subscribeToCallouts = (listener: (callouts: Callout[]) => void): (() => void) => {
  listeners.push(listener);
  ensureInitialized();
  listener([..._callouts]);
  loadCallouts();

  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
};
