import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Clock, User, BarChart4, X, ChevronRight, Users, Hash, Plus } from 'lucide-react';
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
    unclaimedSessions,
    setActiveSessions, 
    setUnclaimedSessions,
    setIsLoading,
    claimSession
  } = useSessionStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sharedUsersDetails, setSharedUsersDetails] = useState<Map<string, { full_name: string | null; email: string }>>(new Map());
  const [hasActiveSessions, setHasActiveSessions] = useState(false);
  const [hasUnclaimedSessions, setHasUnclaimedSessions] = useState(false);
  
  // Load active sessions periodically
  useEffect(() => {
    const loadActiveSessions = async () => {
      try {
        setIsLoading(true);
        const sessions = await sessionManager.getActiveSessions();
        
        // Split sessions into active and unclaimed
        const active = sessions.filter(s => !s.is_unclaimed);
        const unclaimed = sessions.filter(s => s.is_unclaimed);
        
        setActiveSessions(active);
        setUnclaimedSessions(unclaimed);
        
        setHasActiveSessions(active.length > 0);
        setHasUnclaimedSessions(unclaimed.length > 0);
      } catch (error) {
        console.error('Error loading active sessions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Load initially
    loadActiveSessions();
    
    // Set up interval (every 5 minutes)
    const interval = setInterval(loadActiveSessions, 5 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, [setActiveSessions, setUnclaimedSessions, setIsLoading]);
  
  // Fetch shared users' details when sessions change
  useEffect(() => {
    const fetchSharedUserDetails = async () => {
      // Collect all unique user IDs from escalated_to_user_ids arrays
      const uniqueUserIds = new Set<string>();
      
      activeSessions.forEach(session => {
        if (session.escalated_to_user_ids && session.escalated_to_user_ids.length > 0) {
          session.escalated_to_user_ids.forEach(userId => uniqueUserIds.add(userId));
        }
      });
      
      if (uniqueUserIds.size === 0) return;
      
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', Array.from(uniqueUserIds));
          
        if (error) throw error;
        
        if (data) {
          // Create a map for quick lookup
          const userDetailsMap = new Map<string, { full_name: string | null; email: string }>();
          data.forEach(user => {
            userDetailsMap.set(user.id, { full_name: user.full_name, email: user.email });
          });
          setSharedUsersDetails(userDetailsMap);
        }
      } catch (error) {
        console.error('Error fetching shared user details:', error);
      }
    };
    
    fetchSharedUserDetails();
  }, [activeSessions]);

  const handleClaimSession = async (sessionId: string) => {
    const success = await claimSession(sessionId);
    if (success) {
      // Navigate to the submission edit page
      const session = unclaimedSessions.find(s => s.session_id === sessionId);
      if (session) {
        navigate(`/programs/${session.program_id}/sites/${session.site_id}/submissions/${session.submission_id}/edit`);
        onClose();
      }
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
            <div className="mb-4 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                {activeSessions.length === 0 && unclaimedSessions.length === 0
                  ? 'You have no active sessions' 
                  : `You have ${activeSessions.length} active session${activeSessions.length !== 1 ? 's' : ''}`}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsRefreshing(true);
                  sessionManager.getActiveSessions()
                    .then(sessions => {
                      // Split sessions into active and unclaimed
                      const active = sessions.filter(s => !s.is_unclaimed);
                      const unclaimed = sessions.filter(s => s.is_unclaimed);
                      
                      setActiveSessions(active);
                      setUnclaimedSessions(unclaimed);
                      setHasActiveSessions(active.length > 0);
                      setHasUnclaimedSessions(unclaimed.length > 0);
                    })
                    .catch(error => console.error('Error refreshing sessions:', error))
                    .finally(() => setIsRefreshing(false));
                }}
                isLoading={isRefreshing}
                disabled={isRefreshing}
              >
                Refresh
              </Button>
            </div>
            
            {/* Unclaimed Sessions Section */}
            {hasUnclaimedSessions && (
              <div className="mb-6">
                <h3 className="text-md font-medium mb-3 flex items-center">
                  <Plus size={16} className="mr-1 text-success-600" />
                  Available Sessions
                </h3>
                <div className="space-y-3">
                  {unclaimedSessions.map((session) => (
                    <div 
                      key={session.session_id} 
                      className="border border-success-200 rounded-md p-3 bg-success-50 hover:bg-success-100 transition-colors"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-medium">{session.site_name}</div>
                        <div className="text-xs text-success-700 px-2 py-0.5 rounded-full bg-success-100">
                          Available
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        {session.program_name}
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                          Created {formatDistanceToNow(new Date(session.session_start_time), { addSuffix: true })}
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleClaimSession(session.session_id)}
                          className="!py-1 !px-2 text-xs"
                        >
                          Claim
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Active Sessions Section */}
            {activeSessions.length === 0 && unclaimedSessions.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <ClipboardList size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-600 font-medium">No Active Sessions</p>
                <p className="text-sm text-gray-500 mt-1">
                  When you start a submission, it will appear here.
                </p>
              </div>
            ) : activeSessions.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-md font-medium mb-3 flex items-center">
                  <Clock size={16} className="mr-1 text-primary-600" />
                  Your Active Sessions
                </h3>
                {activeSessions.map((session) => (
                  <SessionProgress 
                    key={session.session_id}
                    session={session}
                    variant="compact"
                    sharedUsersDetails={sharedUsersDetails}
                    currentSessionId={null}
                    onCloseDrawer={onClose}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveSessionsDrawer;