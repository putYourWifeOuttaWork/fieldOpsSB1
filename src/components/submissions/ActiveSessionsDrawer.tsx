import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Clock, User, BarChart4, X, ChevronRight, Users, Hash } from 'lucide-react';
import Button from '../common/Button';
import { useSessionStore } from '../../stores/sessionStore';
import sessionManager from '../../lib/sessionManager';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import SessionProgress from './SessionProgress';

interface ActiveSessionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ActiveSessionsDrawer: React.FC<ActiveSessionsDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { 
    activeSessions, 
    setActiveSessions, 
    setIsLoading,
    setError,
    currentSessionId
  } = useSessionStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sharedUsersDetails, setSharedUsersDetails] = useState<Map<string, { full_name: string | null; email: string }>>(new Map());

  // Load active sessions when the drawer is opened
  useEffect(() => {
    if (isOpen) {
      loadActiveSessions();
    }
  }, [isOpen]);

  // Function to load active sessions
  const loadActiveSessions = async () => {
    setIsRefreshing(true);
    try {
      setIsLoading(true);
      
      // Get active sessions using the enhanced RPC function
      const sessions = await sessionManager.getActiveSessions();
      
      // Collect all unique user IDs from escalated_to_user_ids arrays
      const uniqueUserIds = new Set<string>();
      sessions.forEach(session => {
        if (session.escalated_to_user_ids && session.escalated_to_user_ids.length > 0) {
          session.escalated_to_user_ids.forEach(userId => uniqueUserIds.add(userId));
        }
      });
      
      // If we have shared users, fetch their details
      if (uniqueUserIds.size > 0) {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', Array.from(uniqueUserIds));
          
        if (!error && data) {
          // Create a map for quick lookup
          const userDetailsMap = new Map<string, { full_name: string | null; email: string }>();
          data.forEach(user => {
            userDetailsMap.set(user.id, { full_name: user.full_name, email: user.email });
          });
          setSharedUsersDetails(userDetailsMap);
        } else {
          console.error('Error fetching shared user details:', error);
        }
      }
      
      setActiveSessions(sessions);
    } catch (error) {
      console.error('Error loading active sessions:', error);
      setError('Failed to load active sessions');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'}`}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full sm:w-4/5 md:w-3/5 lg:max-w-md bg-white shadow-lg transform transition-transform duration-300 ease-in-out overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center">
              <ClipboardList size={20} className="text-primary-600 mr-2" />
              <h2 className="text-lg font-semibold">Active Sessions</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Close drawer"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                {activeSessions.length === 0 
                  ? 'You have no active sessions' 
                  : `You have ${activeSessions.length} active session${activeSessions.length !== 1 ? 's' : ''}`}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadActiveSessions}
                isLoading={isRefreshing}
                disabled={isRefreshing}
              >
                Refresh
              </Button>
            </div>
            
            {activeSessions.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <ClipboardList size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-600 font-medium">No Active Sessions</p>
                <p className="text-sm text-gray-500 mt-1">
                  When you start a submission, it will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeSessions.map((session) => (
                  <SessionProgress 
                    key={session.session_id}
                    session={session}
                    variant="compact"
                    sharedUsersDetails={sharedUsersDetails}
                    currentSessionId={currentSessionId}
                    onCloseDrawer={onClose}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveSessionsDrawer;