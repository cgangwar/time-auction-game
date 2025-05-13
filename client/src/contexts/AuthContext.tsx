import React, { createContext, useContext, useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  username: string;
  displayName: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, displayName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Failed to parse stored user:', err);
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const res = await apiRequest('POST', '/api/login', credentials);
      return res.json();
    },
    onSuccess: (data) => {
      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      setError(null);
      toast({
        title: "Login successful",
        description: `Welcome back, ${data.displayName}!`,
      });
    },
    onError: (err: Error) => {
      setError(err.message || 'Login failed');
      toast({
        title: "Login failed",
        description: err.message || 'Invalid credentials',
        variant: "destructive"
      });
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (userData: { username: string; displayName: string; email: string; password: string }) => {
      const res = await apiRequest('POST', '/api/register', userData);
      return res.json();
    },
    onSuccess: (data) => {
      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      setError(null);
      toast({
        title: "Registration successful",
        description: `Welcome, ${data.displayName}!`,
      });
    },
    onError: (err: Error) => {
      setError(err.message || 'Registration failed');
      toast({
        title: "Registration failed",
        description: err.message || 'Could not create account',
        variant: "destructive"
      });
    },
  });

  const login = async (username: string, password: string) => {
    setError(null);
    await loginMutation.mutateAsync({ username, password });
  };

  const register = async (username: string, displayName: string, email: string, password: string) => {
    setError(null);
    await registerMutation.mutateAsync({ username, displayName, email, password });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    toast({
      title: "Logged out",
      description: "You have been logged out successfully"
    });
  };

  const value = {
    user,
    login,
    register,
    logout,
    isLoading: loginMutation.isPending || registerMutation.isPending,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}
