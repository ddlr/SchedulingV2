import { supabase } from '../lib/supabase';

export interface DemoRequest {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  message: string;
  status: 'pending' | 'contacted' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface DemoRequestInput {
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  message?: string;
}

export const demoRequestService = {
  async submitRequest(input: DemoRequestInput): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('demo_requests')
        .insert([{
          company_name: input.company_name,
          contact_name: input.contact_name,
          email: input.email,
          phone: input.phone || '',
          message: input.message || '',
          status: 'pending',
        }]);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to submit demo request' };
    }
  },

  async getAllRequests(): Promise<DemoRequest[]> {
    try {
      const { data, error } = await supabase
        .from('demo_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching demo requests:', error);
      return [];
    }
  },

  async updateRequestStatus(
    id: string,
    status: 'pending' | 'contacted' | 'approved' | 'rejected'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('demo_requests')
        .update({ status })
        .eq('id', id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to update request status' };
    }
  },
};
