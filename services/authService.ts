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

const isMockMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

const devAdmin: User = {
  id: 'dev-admin-id',
  email: 'admin@fiddlerscheduler.com',
  full_name: 'Developer Admin',
  role: 'admin',
  is_active: true
};

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    if (isMockMode) {
      return { success: true, user: devAdmin };
    }
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
    if (isMockMode) return devAdmin;
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
    if (isMockMode) return true;
    const { data: { session } } = await supabase.auth.getSession();
    return session !== null;
  },

  onAuthStateChange(callback: (user: User | null) => void) {
    if (isMockMode) {
      setTimeout(() => callback(devAdmin), 0);
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          const user = await this.getCurrentUser();
          callback(user);
        } else if (event === 'SIGNED_OUT' || !session) {
          callback(null);
        }
      })();
    });
  },
};
