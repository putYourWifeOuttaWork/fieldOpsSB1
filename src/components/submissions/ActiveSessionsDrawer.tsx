import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Clock, User, BarChart4, X, ChevronRight, Users, Hash, PlusCircle } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import { useSessionStore } from '../../stores/sessionStore';
import sessionManager from '../../lib/sessionManager';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import SessionProgress from './SessionProgress';
import { toast } from 'react-toastify';

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
    currentSessionId,
    hasUnclaimedSessions,
    setHasUnclaimedSessions,
    claimSession
  } = useSessionStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sharedUsersDetails, setSharedUsersDetails] = useState<Map<string, { full_name: string | null; email: string }>>(new Map());
  const [showUnclaimedSessions, setShowUnclaimedSessions] = useState(false);

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
      const { data, error } = await supabase.rpc('get_active_sessions_with_details');
      
      if (error) {
        console.error('Error getting active sessions:', error);
        throw error;
      }
      
      // Check if there are any unclaimed sessions
      const hasUnclaimed = data?.some(session => session.is_unclaimed === true) || false;
      setHasUnclaimedSessions(hasUnclaimed);
      
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
      
      setActiveSessions(data || []);
    } catch (error) {
      console.error('Error loading active sessions:', error);
      setError('Failed to load active sessions');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  // Handle claiming a session
  const handleClaimSession = async (sessionId: string) => {
    const success = await claimSession(sessionId);
    
    if (success) {
      toast.success('Session claimed successfully');
      // First close the drawer
      onClose();
      // Then navigate to the submission edit page
      const session = activeSessions.find(s => s.session_id === sessionId);
      if (session) {
        navigate(`/programs/${session.program_id}/sites/${session.site_id}/submissions/${session.submission_id}/edit`);
      }
    } else {
      toast.error('Failed to claim session');
    }
  };

  // Filter sessions based on claimed/unclaimed status
  const filteredSessions = activeSessions.filter(session => 
    showUnclaimedSessions ? session.is_unclaimed : !session.is_unclaimed
  );

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
          
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              className={`flex-1 py-2 px-4 text-center font-medium ${
                !showUnclaimedSessions 
                  ? 'text-primary-600 border-b-2 border-primary-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setShowUnclaimedSessions(false)}
            >
              My Sessions
            </button>
            <button
              className={`flex-1 py-2 px-4 text-center font-medium ${
                showUnclaimedSessions 
                  ? 'text-primary-600 border-b-2 border-primary-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setShowUnclaimedSessions(true)}
            >
              Unclaimed Sessions
              {hasUnclaimedSessions && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary-600 rounded-full">
                  !
                </span>
              )}
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                {filteredSessions.length === 0 
                  ? showUnclaimedSessions 
                    ? 'No unclaimed sessions available' 
                    : 'You have no active sessions' 
                  : `${filteredSessions.length} ${showUnclaimedSessions ? 'unclaimed' : 'active'} session${filteredSessions.length !== 1 ? 's' : ''}`}
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
            
            {filteredSessions.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <ClipboardList size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-600 font-medium">
                  {showUnclaimedSessions 
                    ? 'No Unclaimed Sessions' 
                    : 'No Active Sessions'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {showUnclaimedSessions 
                    ? 'There are no unclaimed sessions available for you to take.' 
                    : 'When you start a submission, it will appear here.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSessions.map((session) => (
                  <div 
                    key={session.session_id} 
                    className={`p-2 border rounded-md ${
                      session.is_unclaimed 
                        ? 'bg-gray-50 border-gray-200 hover:bg-gray-100' 
                        : currentSessionId === session.session_id 
                          ? 'bg-primary-50 border-primary-200' 
                          : 'hover:bg-gray-50 border-gray-200'
                    } transition-colors`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-sm truncate">{session.site_name}</div>
                      <div className="flex items-center space-x-1">
                        {session.global_submission_id && (
                          <span className="inline-flex items-center text-xs text-primary-600 mr-1">
                            <Hash size={10} className="mr-0.5" />
                            {session.global_submission_id}
                          </span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          session.session_status === 'Working' 
                            ? 'bg-secondary-100 text-secondary-800'
                            : session.session_status === 'Opened' 
                            ? 'bg-primary-100 text-primary-800'
                            : session.session_status === 'Escalated' 
                            ? 'bg-warning-100 text-warning-800'
                            : session.session_status === 'Shared'
                            ? 'bg-accent-100 text-accent-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {session.session_status}
                        </span>
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-primary-600 h-1.5 rounded-full" 
                          style={{ width: `${session.percentage_complete}%` }}
                        ></div>
                      </div>
                      <span className="text-xs whitespace-nowrap">
                        {session.percentage_complete}%
                      </span>
                    </div>
                    
                    {/* Team Section - Always show the Users icon, but only show names if there are shared users */}
                    {!session.is_unclaimed && (
                      <div className="flex items-center mt-1 text-xs text-gray-500">
                        <Users size={12} className="flex-shrink-0 mr-1" />
                        {session.escalated_to_user_ids && session.escalated_to_user_ids.length > 0 ? (
                          <span className="truncate">
                            {session.escalated_to_user_ids.map(userId => {
                              const userDetails = sharedUsersDetails.get(userId);
                              return userDetails?.full_name?.split(' ')[0] || userDetails?.email?.split('@')[0] || 'User';
                            }).join(', ')}
                          </span>
                        ) : (
                          <span className="text-gray-400">No team members</span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">
                        {session.is_unclaimed 
                          ? `Created ${formatDistanceToNow(new Date(session.session_start_time), { addSuffix: true })}` 
                          : `Updated ${formatDistanceToNow(new Date(session.last_activity_time), { addSuffix: true })}`}
                      </span>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => session.is_unclaimed 
                          ? handleClaimSession(session.session_id)
                          : navigate(`/programs/${session.program_id}/sites/${session.site_id}/submissions/${session.submission_id}/edit`)
                        }
                        className="!py-1 !px-2 text-xs"
                      >
                        {session.is_unclaimed ? 'Claim' : 'Resume'}
                      </Button>
                    </div>
                  </div>
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