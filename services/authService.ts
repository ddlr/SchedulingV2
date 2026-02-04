import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'staff' | 'viewer';
  is_active: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'Authentication failed' };
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (userError) {
        return { success: false, error: userError.message };
      }

      if (!userData) {
        return { success: false, error: 'User profile not found' };
      }

      if (!userData.is_active) {
        await supabase.auth.signOut();
        return { success: false, error: 'Account is inactive' };
      }

      return { success: true, user: userData };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        return null;
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .maybeSingle();

      if (error || !userData) {
        return null;
      }

      if (!userData.is_active) {
        await supabase.auth.signOut();
        return null;
      }

      return userData;
    } catch (error) {
      return null;
    }
  },

  async isAuthenticated(): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    return session !== null;
  },

  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        const user = await this.getCurrentUser();
        callback(user);
      } else if (event === 'SIGNED_OUT' || !session) {
        callback(null);
      }
    });
  },
};
