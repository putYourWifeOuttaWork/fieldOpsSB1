import { create } from 'zustand';
import { ActiveSession } from '../types/session';
import { supabase } from '../lib/supabaseClient';

interface SessionState {
  // Active sessions that the user has access to
  activeSessions: ActiveSession[];
  // Unclaimed sessions that the user can claim
  unclaimedSessions: ActiveSession[];
  // Loading state for sessions
  isLoading: boolean;
  // Error message if any
  error: string | null;
  
  // Current session ID that's being worked on
  currentSessionId: string | null;
  
  // Actions
  setActiveSessions: (sessions: ActiveSession[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  
  // Add a new session to the list (e.g., after creating one)
  addSession: (session: ActiveSession) => void;
  
  // Update a session in the list (e.g., after activity)
  updateSession: (sessionId: string, updates: Partial<ActiveSession>) => void;
  
  // Remove a session from the list (e.g., after completion or cancellation)
  removeSession: (sessionId: string) => void;
  
  // Clear all sessions (e.g., on logout)
  clearSessions: () => void;
  
  // Claim an unclaimed session
  claimSession: (sessionId: string) => Promise<boolean>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSessions: [],
  unclaimedSessions: [],
  isLoading: false,
  error: null,
  currentSessionId: null,
  
  setActiveSessions: (sessions) => {
    // Split the sessions into active and unclaimed based on is_unclaimed flag
    const active = sessions.filter(s => !s.is_unclaimed);
    const unclaimed = sessions.filter(s => s.is_unclaimed);
    
    set({ 
      activeSessions: active,
      unclaimedSessions: unclaimed
    });
  },
  
  setIsLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error }),
  
  setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),
  
  addSession: (session) => set((state) => {
    if (session.is_unclaimed) {
      return {
        unclaimedSessions: [session, ...state.unclaimedSessions]
      };
    }
    
    return {
      activeSessions: [session, ...state.activeSessions]
    };
  }),
  
  updateSession: (sessionId, updates) => set((state) => {
    // Check if this is in activeSessions
    const activeIndex = state.activeSessions.findIndex(s => s.session_id === sessionId);
    if (activeIndex !== -1) {
      const updatedActiveSessions = [...state.activeSessions];
      updatedActiveSessions[activeIndex] = {
        ...updatedActiveSessions[activeIndex],
        ...updates
      };
      return {
        activeSessions: updatedActiveSessions
      };
    }
    
    // Check if this is in unclaimedSessions
    const unclaimedIndex = state.unclaimedSessions.findIndex(s => s.session_id === sessionId);
    if (unclaimedIndex !== -1) {
      // If session is being claimed (is_unclaimed is set to false), move it from unclaimed to active
      if (updates.is_unclaimed === false) {
        const updatedUnclaimedSessions = [...state.unclaimedSessions];
        const claimedSession = {
          ...updatedUnclaimedSessions[unclaimedIndex],
          ...updates
        };
        
        // Remove from unclaimed and add to active
        return {
          unclaimedSessions: updatedUnclaimedSessions.filter((_, i) => i !== unclaimedIndex),
          activeSessions: [claimedSession, ...state.activeSessions]
        };
      }
      
      // Otherwise just update it in unclaimedSessions
      const updatedUnclaimedSessions = [...state.unclaimedSessions];
      updatedUnclaimedSessions[unclaimedIndex] = {
        ...updatedUnclaimedSessions[unclaimedIndex],
        ...updates
      };
      
      return {
        unclaimedSessions: updatedUnclaimedSessions
      };
    }
    
    return {};
  }),
  
  removeSession: (sessionId) => set((state) => {
    // Check both active and unclaimed sessions
    const isActive = state.activeSessions.some(s => s.session_id === sessionId);
    const isUnclaimed = state.unclaimedSessions.some(s => s.session_id === sessionId);
    
    return {
      activeSessions: isActive 
        ? state.activeSessions.filter(s => s.session_id !== sessionId) 
        : state.activeSessions,
      unclaimedSessions: isUnclaimed
        ? state.unclaimedSessions.filter(s => s.session_id !== sessionId)
        : state.unclaimedSessions,
      // If the current session is removed, clear currentSessionId
      currentSessionId: state.currentSessionId === sessionId
        ? null
        : state.currentSessionId
    };
  }),
  
  clearSessions: () => set({
    activeSessions: [],
    unclaimedSessions: [],
    currentSessionId: null,
    error: null
  }),
  
  claimSession: async (sessionId) => {
    try {
      const { data, error } = await supabase
        .rpc('claim_submission_session', { p_session_id: sessionId });
        
      if (error) {
        console.error('Error claiming session:', error);
        throw error;
      }
      
      if (data.success) {
        // Update the session in the store
        const state = get();
        const sessionIndex = state.unclaimedSessions.findIndex(s => s.session_id === sessionId);
        
        if (sessionIndex !== -1) {
          const session = state.unclaimedSessions[sessionIndex];
          const { id: currentUserId } = (await supabase.auth.getUser()).data.user || {};
          
          // Get the current user email and name from an active session if available,
          // otherwise default to empty values
          const currentUserInfo = state.activeSessions.length > 0 
            ? { 
                opened_by_user_email: state.activeSessions[0].opened_by_user_email,
                opened_by_user_name: state.activeSessions[0].opened_by_user_name
              }
            : { opened_by_user_email: null, opened_by_user_name: null };
          
          const claimedSession = {
            ...session,
            is_unclaimed: false,
            opened_by_user_id: currentUserId,
            opened_by_user_email: currentUserInfo.opened_by_user_email,
            opened_by_user_name: currentUserInfo.opened_by_user_name,
            session_status: 'Working'
          };
          
          // Update the store
          set({
            unclaimedSessions: state.unclaimedSessions.filter(s => s.session_id !== sessionId),
            activeSessions: [claimedSession, ...state.activeSessions],
            currentSessionId: sessionId  // Set as current session
          });
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error claiming session:', error);
      return false;
    }
  }
}));