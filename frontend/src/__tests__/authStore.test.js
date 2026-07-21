import useAuthStore from '../store/authStore';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
      signOut: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
    },
    from: jest.fn(),
  },
}));

jest.mock('../services/api', () => ({
  authAPI: {
    register: jest.fn()
  }
}));

const initialState = useAuthStore.getState();

describe('Auth Store', () => {
  beforeEach(() => {
    useAuthStore.setState(initialState);
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const state = useAuthStore.getState();
      
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('isAdmin check', () => {
    test('should identify non-admin user', () => {
      useAuthStore.setState({ user: { id: 'user123', email: 'test@example.com', role: 'user' } });
      expect(useAuthStore.getState().isAdmin()).toBe(false);
    });

    test('should identify admin user', () => {
      useAuthStore.setState({ user: { id: 'admin123', email: 'admin@example.com', role: 'admin' } });
      expect(useAuthStore.getState().isAdmin()).toBe(true);
    });

    test('should identify superadmin user', () => {
      useAuthStore.setState({ user: { id: 'super123', email: 'super@example.com', role: 'superadmin' } });
      expect(useAuthStore.getState().isAdmin()).toBe(true);
    });

    test('should return false if user is null', () => {
      useAuthStore.setState({ user: null });
      expect(useAuthStore.getState().isAdmin()).toBeNull();
    });
  });

  describe('clearError', () => {
    test('should clear error message', () => {
      useAuthStore.setState({ error: 'Some error message' });
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('login action', () => {
    test('should login user successfully', async () => {
      const mockSessionUser = { id: 'user123', email: 'test@example.com' };
      const mockDbUser = { id: 'user123', email: 'test@example.com', name: 'Test User', role: 'user' };

      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockSessionUser },
        error: null
      });

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockDbUser, error: null })
      });

      const result = await useAuthStore.getState().login('test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(useAuthStore.getState().user).toEqual({
        ...mockSessionUser,
        role: 'user'
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().error).toBeNull();
    });

    test('should handle login error correctly', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid credentials')
      });

      const result = await useAuthStore.getState().login('test@example.com', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().error).toBe('Invalid credentials');
    });
  });

  describe('register action', () => {
    test('should register user successfully', async () => {
      const mockSessionUser = { id: 'user123', email: 'new@example.com' };

      const { authAPI } = require('../services/api');
      authAPI.register.mockResolvedValue({ success: true });

      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockSessionUser },
        error: null
      });

      const result = await useAuthStore.getState().register('New User', 'new@example.com', 'password123', '5', 'mock-token');

      expect(result.success).toBe(true);
      expect(useAuthStore.getState().user).toEqual({
        ...mockSessionUser,
        role: 'user'
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('logout action', () => {
    test('should logout and clear state', async () => {
      useAuthStore.setState({ user: { id: 'user123' }, isAuthenticated: true });
      
      supabase.auth.signOut.mockResolvedValue({ error: null });

      await useAuthStore.getState().logout();

      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('initAuth action', () => {
    test('should set authenticated state when valid session and user are found', async () => {
      const mockSessionUser = { id: 'user123', email: 'test@example.com' };
      const mockDbUser = { id: 'user123', email: 'test@example.com', name: 'Test User', role: 'admin' };

      supabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      });

      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockSessionUser },
        error: null
      });

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockDbUser, error: null })
      });

      await useAuthStore.getState().initAuth();

      expect(useAuthStore.getState().user).toEqual({
        ...mockSessionUser,
        role: 'admin'
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    test('should reset state to null/false when session is null', async () => {
      // Simulate stale state loaded from persist
      useAuthStore.setState({ user: { id: 'user123', email: 'test@example.com' }, isAuthenticated: true });

      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      await useAuthStore.getState().initAuth();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    test('should reset state to null/false when getUser fails or returns null user', async () => {
      useAuthStore.setState({ user: { id: 'user123', email: 'test@example.com' }, isAuthenticated: true });

      supabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      });

      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('User not found')
      });

      await useAuthStore.getState().initAuth();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });
});
