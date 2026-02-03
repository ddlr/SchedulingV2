import { supabase } from '../lib/supabase';

export interface EmailSignup {
  id: string;
  email: string;
  signup_source: string;
  subscribed: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailSignupInput {
  email: string;
  signup_source?: string;
}

export const emailSignupService = {
  async submitEmail(input: EmailSignupInput): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('email_signups')
        .insert([{
          email: input.email,
          signup_source: input.signup_source || 'landing_page',
          subscribed: true,
        }]);

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'This email is already registered' };
        }
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to submit email' };
    }
  },

  async getAllSignups(): Promise<EmailSignup[]> {
    try {
      const { data, error } = await supabase
        .from('email_signups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching email signups:', error);
      return [];
    }
  },
};
