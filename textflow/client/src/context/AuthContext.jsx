import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check auth state on boot
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await authAPI.me();
        if (res.success && res.user) {
          setUser(res.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('[Auth Context] Boot check failed:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await authAPI.login(email, password);
      if (res.success && res.user) {
        setUser(res.user);
      }
      return res;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email, password, name) => {
    setLoading(true);
    try {
      const res = await authAPI.signup(email, password, name);
      if (res.success && res.user) {
        setUser(res.user);
      }
      return res;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const res = await authAPI.logout();
      if (res.success) {
        setUser(null);
      }
      return res;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    setUser,
    loading,
    login,
    signup,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
