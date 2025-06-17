import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Clock, User, BarChart4, X, ChevronRight, Users, Hash, Hand } from 'lucide-react';
import Button from '../common/Button';
import { useSessionStore } from '../../stores/sessionStore';
import sessionManager from '../../lib/sessionManager';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import SessionProgress from './SessionProgress';
import { toast } from 'react-toastify';
import { ActiveSession } from '../../types/session';

interface ActiveSessionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ActiveSessionsDrawer: React.FC<ActiveSessionsDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { 
    activeSessions, 
    unclaimedSessions, // Added unclaimedSessions
    setActiveSessions, 
    setIsLoading,
    setError,
    currentSessionId,
    claimSession // Added claimSession
  } = useSessionStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sharedUsersDetails, setSharedUsersDetails] = useState<Map<string, { full_name: string | null; email: string }>>(new Map());

  // Load active sessions when the drawer is opened
  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  // Function to load active and unclaimed sessions
  const loadSessions = async () => {
    setIsRefreshing(true);
    try {
      setIsLoading(true);
      
      // Get active sessions using the enhanced RPC function
      const { data, error } = await supabase.rpc('get_active_sessions_with_details');
      
      if (error) throw error;
      
      // Set the sessions in the store - will be split into active and unclaimed
      setActiveSessions(data || []);
      
      // Collect all unique user IDs from escalated_to_user_ids arrays
      const uniqueUserIds = new Set<string>();
      data?.forEach(session => {
        if (session.escalated_to_user_ids && session.escalated_to_user_ids.length > 0) {
          session.escalated_to_user_ids.forEach(userId => uniqueUserIds.add(userId));
        }
      });
      
      // If we have shared users, fetch their details
      if (uniqueUserIds.size > 0) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', Array.from(uniqueUserIds));
          
        if (!userError && userData) {
          // Create a map for quick lookup
          const userDetailsMap = new Map<string, { full_name: string | null; email: string }>();
          userData.forEach(user => {
            userDetailsMap.set(user.id, { full_name: user.full_name, email: user.email });
          });
          setSharedUsersDetails(userDetailsMap);
        } else {
          console.error('Error fetching shared user details:', userError);
        }
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      setError('Failed to load sessions');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Handle claiming a session
  const handleClaimSession = async (session: ActiveSession) => {
    const success = await claimSession(session.session_id);
    
    if (success) {
      toast.success(`Session for ${session.site_name} claimed successfully!`);
      navigate(`/programs/${session.program_id}/sites/${session.site_id}/submissions/${session.submission_id}/edit`);
      onClose(); // Close the drawer
    } else {
      toast.error(`Failed to claim session for ${session.site_name}`);
      // Refresh sessions to get the latest state
      loadSessions();
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
              <h2 className="text-lg font-semibold">Sessions</h2>
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
            {/* Unclaimed Sessions Section */}
            {unclaimedSessions.length > 0 && (
              <div className="mb-6">
                <div className="mb-4 flex justify-between items-center">
                  <div className="flex items-center">
                    <Hand size={18} className="text-accent-600 mr-2" />
                    <h3 className="font-medium">Unclaimed Sessions</h3>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {unclaimedSessions.map((session) => (
                    <div 
                      key={`unclaimed-${session.session_id}`} 
                      className="border border-accent-200 rounded-lg p-3 bg-accent-50"
                      data-testid={`drawer-unclaimed-session-${session.session_id}`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900">{session.site_name}</h4>
                          <p className="text-xs text-gray-500">{session.program_name}</p>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center">
                          <Clock size={12} className="mr-1" />
                          {formatDistanceToNow(new Date(session.session_start_time), { addSuffix: true })}
                        </div>
                      </div>
                      
                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() => handleClaimSession(session)}
                        fullWidth
                        testId={`drawer-claim-session-${session.session_id}`}
                      >
                        Grab This Session
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          
            {/* Active Sessions Section */}
            <div>
              <div className="mb-4 flex justify-between items-center">
                <div className="flex items-center">
                  <ClipboardList size={18} className="text-primary-600 mr-2" />
                  <h3 className="font-medium">Active Sessions</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadSessions}
                  isLoading={isRefreshing}
                  disabled={isRefreshing}
                >
                  Refresh
                </Button>
              </div>
              
              {activeSessions.length === 0 && unclaimedSessions.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <ClipboardList size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-600 font-medium">No Active Sessions</p>
                  <p className="text-sm text-gray-500 mt-1">
                    When you start a submission, it will appear here.
                  </p>
                </div>
              ) : activeSessions.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-lg">
                  <p className="text-gray-600">You have no active sessions</p>
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
    </div>
  );
};

export default ActiveSessionsDrawer;