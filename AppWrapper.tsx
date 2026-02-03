import React from 'react';
import { useAuth } from './contexts/AuthContext';
import App from './App';

const AppWrapper: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to log out?')) {
      await logout();
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-900 border-b border-slate-700">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-white text-sm">
              <span className="text-slate-400">Logged in as:</span> <span className="font-medium">{user?.full_name}</span>
            </span>
            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-full uppercase">
              {user?.role}
            </span>
            {user?.role === 'viewer' && (
              <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full">
                Read-Only Mode
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
      <App />
    </div>
  );
};

export default AppWrapper;
