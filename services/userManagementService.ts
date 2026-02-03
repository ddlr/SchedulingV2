import { supabase } from '../lib/supabase';
import { User } from './authService';

export interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'staff' | 'viewer';
}

export interface UpdateUserInput {
  full_name?: string;
  role?: 'admin' | 'staff' | 'viewer';
  is_active?: boolean;
}

export const userManagementService = {
  async getAllUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  },

  async createUser(input: CreateUserInput): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
      });

      if (authError) {
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'Failed to create auth user' };
      }

      const { error: userError } = await supabase
        .from('users')
        .insert([{
          email: input.email,
          full_name: input.full_name,
          role: input.role,
          is_active: true,
        }]);

      if (userError) {
        return { success: false, error: userError.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to create user' };
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
