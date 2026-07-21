import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../supabase';
import { authAPI } from '../services/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setState: (state) => set(state),

      initAuth: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: dbUser } = await supabase
                .from('users')
                .select('role')
                .eq('email', user.email)
                .maybeSingle();
              const mergedUser = {
                ...user,
                role: dbUser?.role || 'user'
              };
              set({ user: mergedUser, isAuthenticated: true });
            } else {
              set({ user: null, isAuthenticated: false });
            }
          } else {
            set({ user: null, isAuthenticated: false });
          }
        } catch (error) {
          console.error('Init auth error:', error);
          set({ user: null, isAuthenticated: false });
        }
      },

      logout: async () => {
        await supabase.auth.signOut();
        set({ user: null, isAuthenticated: false, error: null });
      },

      googleLogin: async (credential) => {
        set({ isLoading: true, error: null });
        try {
          let result;
          if (supabase.auth.signInWithIdToken) {
            result = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: credential
            });
          } else {
            result = await supabase.auth.signInWithOAuth({
              provider: 'google'
            });
          }

          const { data, error } = result;
          if (error) throw error;

          const loggedInUser = data?.user || data?.session?.user;
          if (loggedInUser) {
            const { data: existingUser } = await supabase
              .from('users')
              .select('*')
              .eq('email', loggedInUser.email)
              .maybeSingle();

            const mergedUser = {
              ...loggedInUser,
              role: existingUser?.role || 'user'
            };

            set({ user: mergedUser, isAuthenticated: true, isLoading: false });
            return { success: true };
          }

          set({ user: null, isAuthenticated: false, isLoading: false });
          return { success: false, error: 'No user data received' };
        } catch (error) {
          console.error('Google login error:', error.message);
          set({ error: error.message, isLoading: false });
          return { success: false, message: error.message };
        }
      },

      clearError: () => set({ error: null }),

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (error) throw error;

          const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

          const mergedUser = {
            ...data.user,
            role: existingUser?.role || 'user'
          };

          set({ user: mergedUser, isAuthenticated: true, isLoading: false });
          return { success: true, user: mergedUser };
        } catch (error) {
          set({ error: error.message, isLoading: false });
          return { success: false, error: error.message };
        }
      },

      register: async (name, email, password, captchaAnswer, captchaToken) => {
        set({ isLoading: true, error: null });
        try {
          // 1. Backend signup (creates auto-confirmed user in Supabase auth & public.users)
          await authAPI.register({ name, email, password, captchaAnswer, captchaToken });

          // 2. Frontend login to establish Supabase session
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (error) throw error;

          const mergedUser = {
            ...data.user,
            role: 'user'
          };

          set({ user: mergedUser, isAuthenticated: true, isLoading: false });
          return { success: true, user: mergedUser };
        } catch (error) {
          set({ error: error.message, isLoading: false });
          return { success: false, error: error.message };
        }
      },


    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);

export default useAuthStore;