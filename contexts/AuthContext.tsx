import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from '../services/authService';
import { setCurrentOrgId } from '../services/orgHelper';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  hasRole: (role: 'super_admin' | 'admin' | 'staff' | 'viewer') => boolean;
  canEdit: boolean;
  canViewAdmin: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncOrgId = (u: User | null) => {
    if (u && u.organization_id) {
      setCurrentOrgId(u.organization_id);
    } else {
      setCurrentOrgId(null);
    }
  };

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = authService.onAuthStateChange((newUser) => {
      setUser(newUser);
      syncOrgId(newUser);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      syncOrgId(currentUser);
    } catch (error) {
      console.error('Error checking auth:', error);
      setUser(null);
      setCurrentOrgId(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    if (response.success && response.user) {
      setUser(response.user);
      syncOrgId(response.user);
    }
    return response;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setCurrentOrgId(null);
  };

  const hasRole = (role: 'super_admin' | 'admin' | 'staff' | 'viewer'): boolean => {
    if (!user) return false;
    const roleHierarchy = { super_admin: 4, admin: 3, staff: 2, viewer: 1 };
    return roleHierarchy[user.role] >= roleHierarchy[role];
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const canEdit = user?.role === 'admin' || user?.role === 'staff' || user?.role === 'super_admin';
  const canViewAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isAuthenticated = user !== null;

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated,
    hasRole,
    canEdit,
    canViewAdmin,
    isSuperAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
