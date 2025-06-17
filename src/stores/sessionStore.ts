import { create } from 'zustand';
import { ActiveSession } from '../types/session';

interface SessionState {
  // Active sessions that the user has access to
  activeSessions: ActiveSession[];
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
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSessions: [],
  isLoading: false,
  error: null,
  currentSessionId: null,
  
  setActiveSessions: (sessions) => set({ 
    // Filter out cancelled and expired sessions
    activeSessions: sessions.filter(s => 
      s.session_status !== 'Cancelled' && 
      s.session_status !== 'Expired'
    ) 
  }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),
  
  addSession: (session) => set((state) => ({
    // Only add if not cancelled or expired
    activeSessions: session.session_status !== 'Cancelled' && session.session_status !== 'Expired'
      ? [session, ...state.activeSessions]
      : state.activeSessions
  })),
  
  updateSession: (sessionId, updates) => set((state) => {
    // Get the updated session
    const updatedSession = {
      ...state.activeSessions.find(s => s.session_id === sessionId),
      ...updates
    } as ActiveSession;
    
    // If session is now cancelled or expired, remove it from active sessions
    if (updatedSession.session_status === 'Cancelled' || updatedSession.session_status === 'Expired') {
      return {
        activeSessions: state.activeSessions.filter(s => s.session_id !== sessionId)
      };
    }
    
    // Otherwise update it
    return {
      activeSessions: state.activeSessions.map((session) => 
        session.session_id === sessionId
          ? updatedSession
          : session
      )
    };
  }),
  
  removeSession: (sessionId) => set((state) => ({
    activeSessions: state.activeSessions.filter(
      (session) => session.session_id !== sessionId
    ),
    // If the current session is removed, clear currentSessionId
    currentSessionId: state.currentSessionId === sessionId
      ? null
      : state.currentSessionId
  })),
  
  clearSessions: () => set({
    activeSessions: [],
    currentSessionId: null,
    error: null
  }),
}));