import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Organization } from '../types';
import { User } from './authService';

export const organizationService = {
  async getAll(): Promise<Organization[]> {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching organizations:', error);
      return [];
    }
  },

  async getById(id: string): Promise<Organization | null> {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching organization:', error);
      return null;
    }
  },

  async create(name: string, slug: string): Promise<{ success: boolean; organization?: Organization; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name,
          slug,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // Copy default config to the new organization
      const { error: rpcError } = await supabase.rpc('copy_default_config_to_org', {
        new_org_id: data.id
      });

      if (rpcError) {
        console.error('Error copying default config:', rpcError);
        // Don't fail the whole creation, config can be set up manually
      }

      return { success: true, organization: data };
    } catch (error) {
      console.error('Error creating organization:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create organization' };
    }
  },

  async update(id: string, data: Partial<Pick<Organization, 'name' | 'slug' | 'is_active'>>): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to update organization' };
    }
  },

  async deactivate(id: string): Promise<{ success: boolean; error?: string }> {
    return this.update(id, { is_active: false });
  },

  async activate(id: string): Promise<{ success: boolean; error?: string }> {
    return this.update(id, { is_active: true });
  },

  async getOrgUsers(orgId: string): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching org users:', error);
      return [];
    }
  },

  async getOrgUserCount(orgId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('is_active', true);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error counting org users:', error);
      return 0;
    }
  },

  async createOrgAdmin(
    orgId: string,
    email: string,
    password: string,
    fullName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const signUpClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { data: signUpData, error: signUpError } = await signUpClient.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        return { success: false, error: signUpError.message };
      }

      if (!signUpData.user) {
        return { success: false, error: 'Failed to create auth user' };
      }

      if (signUpData.user.identities && signUpData.user.identities.length === 0) {
        return { success: false, error: 'A user with this email already exists' };
      }

      const { error: profileError } = await supabase.from('users').insert([{
        id: signUpData.user.id,
        email,
        full_name: fullName,
        role: 'admin',
        is_active: true,
        organization_id: orgId,
      }]);

      if (profileError) {
        return { success: false, error: profileError.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create admin' };
    }
  },
};
