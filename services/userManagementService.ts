import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from './authService';
import { getCurrentOrgId, getCurrentOrgIdOrNull } from './orgHelper';

export interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'staff' | 'viewer';
  organization_id?: string;
}

export interface UpdateUserInput {
  full_name?: string;
  role?: 'admin' | 'staff' | 'viewer';
  is_active?: boolean;
}

export const userManagementService = {
  async getAllUsers(): Promise<User[]> {
    try {
      const orgId = getCurrentOrgIdOrNull();
      let query = supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (orgId) {
        query = query.eq('organization_id', orgId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  },

  async getOrgUsers(orgId: string): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching org users:', error);
      return [];
    }
  },

  async createUser(input: CreateUserInput): Promise<{ success: boolean; error?: string }> {
    try {
      const signUpClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { data: signUpData, error: signUpError } = await signUpClient.auth.signUp({
        email: input.email,
        password: input.password,
      });

      if (signUpError) {
        console.error('create-user: signUp failed', signUpError);
        return { success: false, error: signUpError.message };
      }

      if (!signUpData.user) {
        return { success: false, error: 'Failed to create auth user' };
      }

      if (signUpData.user.identities && signUpData.user.identities.length === 0) {
        return { success: false, error: 'A user with this email already exists' };
      }

      const orgId = input.organization_id || getCurrentOrgId();

      const { error: profileError } = await supabase.from('users').insert([{
        id: signUpData.user.id,
        email: input.email,
        full_name: input.full_name,
        role: input.role,
        is_active: true,
        organization_id: orgId,
      }]);

      if (profileError) {
        console.error('create-user: profile insert failed', profileError);
        return { success: false, error: profileError.message };
      }

      return { success: true };
    } catch (error) {
      console.error('create-user: unexpected error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create user' };
    }
  },

  async updateUser(userId: string, input: UpdateUserInput): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('users')
        .update(input)
        .eq('id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to update user' };
    }
  },

  async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to delete user' };
    }
  },
};
