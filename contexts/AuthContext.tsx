import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from '../services/authService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  hasRole: (role: 'admin' | 'staff' | 'viewer') => boolean;
  canEdit: boolean;
  canViewAdmin: boolean;
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

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = authService.onAuthStateChange((newUser) => {
      setUser(newUser);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error checking auth:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    if (response.success && response.user) {
      setUser(response.user);
    }
    return response;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const hasRole = (role: 'admin' | 'staff' | 'viewer'): boolean => {
    if (!user) return false;
    const roleHierarchy = { admin: 3, staff: 2, viewer: 1 };
    return roleHierarchy[user.role] >= roleHierarchy[role];
  };

  const canEdit = user?.role === 'admin' || user?.role === 'staff';
  const canViewAdmin = user?.role === 'admin';
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
