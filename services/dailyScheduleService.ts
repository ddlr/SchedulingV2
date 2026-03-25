import { supabase } from '../lib/supabase';
import { GeneratedSchedule, DayOfWeek } from '../types';
import { getCurrentOrgId } from './orgHelper';

export interface DailySchedule {
  id: string;
  schedule_date: string;
  day_of_week: DayOfWeek;
  schedule_data: GeneratedSchedule;
  generated_by: string | null;
  validation_errors: any[] | null;
  created_at: string;
  updated_at: string;
}

export const dailyScheduleService = {
  async getDailySchedule(date: string): Promise<DailySchedule | null> {
    try {
      const orgId = getCurrentOrgId();
      const { data, error } = await supabase
        .from('daily_schedules')
        .select('*')
        .eq('organization_id', orgId)
        .eq('schedule_date', date)
        .maybeSingle();

      if (error) {
        console.error('Error fetching daily schedule:', error);
        return null;
      }

      return data as DailySchedule;
    } catch (error) {
      console.error('Unexpected error fetching daily schedule:', error);
      return null;
    }
  },

  async saveDailySchedule(
    date: string,
    dayOfWeek: DayOfWeek,
    schedule: GeneratedSchedule,
    userEmail: string,
    errors: any[] = []
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const orgId = getCurrentOrgId();
      const id = `ds-${orgId}-${date}`;
      const { error } = await supabase
        .from('daily_schedules')
        .upsert({
          id,
          schedule_date: date,
          day_of_week: dayOfWeek,
          schedule_data: schedule,
          generated_by: userEmail,
          validation_errors: errors,
          organization_id: orgId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id,schedule_date' });

      if (error) {
        console.error('Error saving daily schedule:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Unexpected error saving daily schedule:', error);
      return { success: false, error: error.message };
    }
  },

  subscribeToDailySchedule(date: string, callback: (schedule: DailySchedule | null) => void) {
    const subscription = supabase
      .channel(`daily_schedule_${date}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_schedules',
          filter: `schedule_date=eq.${date}`,
        },
        (payload) => {
          callback(payload.new as DailySchedule);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  },
};
