import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePilotProgramStore } from '../stores/pilotProgramStore';
import { useSites } from '../hooks/useSites';
import { 
  Save, 
  X, 
  Plus, 
  Check, 
  AlertTriangle, 
  XCircle,
  CheckCircle,
  Share2,
  Clock,
  Users,
  Upload,
  ScanLine,
  ArrowLeft
} from 'lucide-react';
import Button from '../common/Button';
import Card, { CardHeader, CardContent } from '../common/Card';
import LoadingScreen from '../common/LoadingScreen';
import { useAuthStore } from '../stores/authStore';
import PetriForm, { PetriFormRef } from './PetriForm';
import GasifierForm, { GasifierFormRef } from './GasifierForm';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import TemplateWarningModal from './TemplateWarningModal';
import ConfirmSubmissionModal from './ConfirmSubmissionModal';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import offlineStorage from '../utils/offlineStorage';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import sessionManager from '../lib/sessionManager';
import { useSessionStore } from '../stores/sessionStore';
import useUserRole from '../hooks/useUserRole';
import PermissionModal from '../common/PermissionModal';
import SessionShareModal from './SessionShareModal';
import SubmissionOverviewCard from './SubmissionOverviewCard';
import { useSubmissions } from '../hooks/useSubmissions';
import { createLogger } from '../utils/logger';

// Create a logger for this component
const logger = createLogger('SubmissionEditPage');

interface PetriFormData {
  petriCode: string;
  imageFile: File | null;
  imageUrl?: string;
  tempImageKey?: string;
  plantType: string;
  fungicideUsed: 'Yes' | 'No';
  surroundingWaterSchedule: string;
  notes: string;
  placement?: string | null;
  placement_dynamics?: string | null;
  outdoor_temperature?: number;
  outdoor_humidity?: number;
  observationId?: string;
  isValid: boolean;
  hasData: boolean;
  hasImage: boolean;
  isDirty: boolean;
  formId: string;
}

interface GasifierFormData {
  gasifierCode: string;
  imageFile: File | null;
  imageUrl?: string;
  tempImageKey?: string;
  chemicalType: string;
  measure: number | null;
  anomaly: boolean;
  placementHeight?: string;
  directionalPlacement?: string;
  placementStrategy?: string;
  notes: string;
  outdoor_temperature?: number;
  outdoor_humidity?: number;
  observationId?: string;
  isValid: boolean;
  hasData: boolean;
  hasImage: boolean;
  isDirty: boolean;
  formId: string;
}

const SubmissionEditPage = () => {
  const navigate = useNavigate();
  const { programId, siteId, submissionId } = useParams();
  const { user } = useAuthStore();
  const { selectedSite, setSelectedSite } = usePilotProgramStore();
  const { fetchSite } = useSites(programId);
  const { updateSubmission, deleteSubmission, fetchSubmissionPetriObservations, fetchSubmissionGasifierObservations } = useSubmissions(siteId);
  const isOnline = useOnlineStatus();
  const { canEditSubmission } = useUserRole({ programId });
  const { setCurrentSessionId } = useSessionStore();
  
  // Submission state
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionIdLocal] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  
  // Form state
  const [petriObservations, setPetriObservations] = useState<any[]>([]);
  const [gasifierObservations, setGasifierObservations] = useState<any[]>([]);
  const [environmentalValues, setEnvironmentalValues] = useState<{
    temperature: number;
    humidity: number;
    airflow: 'Open' | 'Closed';
    odorDistance: string;
    weather: 'Clear' | 'Cloudy' | 'Rain';
    notes: string;
    indoor_temperature?: number;
    indoor_humidity?: number;
  }>({
    temperature: 70,
    humidity: 50,
    airflow: 'Open',
    odorDistance: '5-10ft',
    weather: 'Clear',
    notes: ''
  });
  
  // Template warning state
  const [showTemplateWarning, setShowTemplateWarning] = useState(false);
  const [templateWarningType, setTemplateWarningType] = useState<'Petri' | 'Gasifier'>('Petri');
  
  // Permission modal state
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState("");
  
  // Share modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  // Form reference arrays for validating and accessing forms
  const [petriForms, setPetriForms] = useState<{ id: string; ref: React.RefObject<PetriFormRef>; isValid: boolean; isDirty: boolean; observationId?: string; }[]>([]);
  const [gasifierForms, setGasifierForms] = useState<{ id: string; ref: React.RefObject<GasifierFormRef>; isValid: boolean; isDirty: boolean; observationId?: string; }[]>([]);
  
  // Add state variables to store complete form data objects
  const [petriObservationData, setPetriObservationData] = useState<{[key: string]: PetriFormData}>({});
  const [gasifierObservationData, setGasifierObservationData] = useState<{[key: string]: GasifierFormData}>({});
  
  // Track if petris and gasifiers are loaded from templates
  const [loadedFromTemplate, setLoadedFromTemplate] = useState<{petri: boolean; gasifier: boolean}>({ petri: false, gasifier: false });
  
  // Track if all data is saved
  const [isAllSaved, setIsAllSaved] = useState(true);
  
  // Detect if session is read-only
  const isSessionReadOnly = session && ['Completed', 'Cancelled', 'Expired', 'Expired-Complete', 'Expired-Incomplete'].includes(session.session_status);
  
  // Check for petri and gasifier default templates
  const hasPetriTemplates = selectedSite?.petri_defaults && selectedSite.petri_defaults.length > 0;
  const hasGasifierTemplates = selectedSite?.gasifier_defaults && selectedSite.gasifier_defaults.length > 0;
  
  // Auto-save timer reference
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Shared users details for team members display
  const [sharedUsersDetails, setSharedUsersDetails] = useState<Map<string, { full_name: string | null; email: string }>>(new Map());
  
  // Fetch shared users details when the session's escalated_to_user_ids changes
  useEffect(() => {
    const fetchSharedUserDetails = async () => {
      if (!session?.escalated_to_user_ids || session.escalated_to_user_ids.length === 0) {
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', session.escalated_to_user_ids);
          
        if (error) throw error;
        
        if (data) {
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
  }, [session?.escalated_to_user_ids]);
  
  // Load submission, observations, and session data
  useEffect(() => {
    const loadData = async () => {
      if (!submissionId || !programId || !siteId) {
        navigate('/home');
        return;
      }
      
      setLoading(true);
      try {
        // First, fetch the site if not already selected
        if (!selectedSite || selectedSite.site_id !== siteId) {
          const site = await fetchSite(siteId);
          if (site) {
            setSelectedSite(site);
          }
        }
        
        // Get the submission with its session data
        const { data, error } = await supabase.rpc('get_submission_with_creator', {
          submission_id_param: submissionId
        });
        
        if (error) throw error;
        
        // If submission doesn't exist, navigate back to site page
        if (!data) {
          navigate(`/programs/${programId}/sites/${siteId}`);
          return;
        }
        
        setSubmission(data);
        
        // Set document title with submission ID
        document.title = `Submission #${data.global_submission_id || ''} - GRMTek Sporeless`;
        
        // Fetch petri observations
        const petriData = await fetchSubmissionPetriObservations(submissionId);
        setPetriObservations(petriData || []);
        
        // Fetch gasifier observations
        const gasifierData = await fetchSubmissionGasifierObservations(submissionId);
        setGasifierObservations(gasifierData || []);
        
        // Get the submission session
        const { data: sessionData, error: sessionError } = await supabase
          .from('submission_sessions')
          .select('*')
          .eq('submission_id', submissionId)
          .maybeSingle();
          
        if (sessionError && !sessionError.message.includes('No rows found')) {
          throw sessionError;
        }
        
        if (sessionData) {
          setSession(sessionData);
          setCurrentSessionIdLocal(sessionData.session_id);
          setCurrentSessionId(sessionData.session_id);
        }
        
        // Create form refs for each petri observation
        const petriFormRefs = (petriData || []).map(obs => {
          const formRef = React.createRef<PetriFormRef>();
          return { 
            id: obs.observation_id, 
            ref: formRef, 
            isValid: !!obs.image_url,
            isDirty: false,
            observationId: obs.observation_id
          };
        });
        
        // Create form refs for each gasifier observation
        const gasifierFormRefs = (gasifierData || []).map(obs => {
          const formRef = React.createRef<GasifierFormRef>();
          return { 
            id: obs.observation_id, 
            ref: formRef, 
            isValid: !!obs.image_url,
            isDirty: false,
            observationId: obs.observation_id
          };
        });
        
        // Store form refs in state
        setPetriForms(petriFormRefs);
        setGasifierForms(gasifierFormRefs);
        
        // Set environmental values from submission
        setEnvironmentalValues({
          temperature: data.temperature,
          humidity: data.humidity,
          airflow: data.airflow,
          odorDistance: data.odor_distance,
          weather: data.weather,
          notes: data.notes || '',
          indoor_temperature: data.indoor_temperature,
          indoor_humidity: data.indoor_humidity
        });
        
        // Create initial data objects for petri and gasifier forms
        const initialPetriData: {[key: string]: any} = {};
        petriData?.forEach(observation => {
          initialPetriData[observation.observation_id] = {
            formId: observation.observation_id,
            petriCode: observation.petri_code,
            imageFile: null,
            imageUrl: observation.image_url,
            plantType: observation.plant_type,
            fungicideUsed: observation.fungicide_used,
            surroundingWaterSchedule: observation.surrounding_water_schedule,
            notes: observation.notes || '',
            placement: observation.placement,
            placement_dynamics: observation.placement_dynamics,
            observationId: observation.observation_id,
            isValid: !!observation.image_url,
            hasData: true,
            hasImage: !!observation.image_url,
            isDirty: false,
            outdoor_temperature: observation.outdoor_temperature,
            outdoor_humidity: observation.outdoor_humidity
          };
        });
        setPetriObservationData(initialPetriData);
        
        const initialGasifierData: {[key: string]: any} = {};
        gasifierData?.forEach(observation => {
          initialGasifierData[observation.observation_id] = {
            formId: observation.observation_id,
            gasifierCode: observation.gasifier_code,
            imageFile: null,
            imageUrl: observation.image_url,
            chemicalType: observation.chemical_type,
            measure: observation.measure,
            anomaly: observation.anomaly,
            placementHeight: observation.placement_height,
            directionalPlacement: observation.directional_placement,
            placementStrategy: observation.placement_strategy,
            notes: observation.notes || '',
            observationId: observation.observation_id,
            isValid: !!observation.image_url,
            hasData: true,
            hasImage: !!observation.image_url,
            isDirty: false,
            outdoor_temperature: observation.outdoor_temperature,
            outdoor_humidity: observation.outdoor_humidity
          };
        });
        setGasifierObservationData(initialGasifierData);
        
        // If there are no petri or gasifier observations, check if there are templates to load
        if (petriData.length === 0 && hasPetriTemplates && !loadedFromTemplate.petri) {
          // Create petri forms from template
          const petriTemplateRefs = selectedSite?.petri_defaults.map((template: any, index: number) => {
            const formId = uuidv4();
            const formRef = React.createRef<PetriFormRef>();
            
            // Add to petriObservationData
            setPetriObservationData(prevData => ({
              ...prevData,
              [formId]: {
                formId,
                petriCode: template.petri_code,
                imageFile: null,
                plantType: template.plant_type || 'Other Fresh Perishable',
                fungicideUsed: template.fungicide_used || 'No',
                surroundingWaterSchedule: template.surrounding_water_schedule || 'Daily',
                notes: template.notes || '',
                placement: template.placement || null,
                placement_dynamics: template.placement_dynamics || null,
                isValid: false,
                hasData: true,
                hasImage: false,
                isDirty: false
              }
            }));
            
            return {
              id: formId,
              ref: formRef,
              isValid: false,
              isDirty: false
            };
          });
          
          setPetriForms(petriTemplateRefs);
          setLoadedFromTemplate(prev => ({ ...prev, petri: true }));
        }
        
        // Similarly for gasifier templates
        if (gasifierData.length === 0 && hasGasifierTemplates && !loadedFromTemplate.gasifier) {
          // Create gasifier forms from template
          const gasifierTemplateRefs = selectedSite?.gasifier_defaults.map((template: any, index: number) => {
            const formId = uuidv4();
            const formRef = React.createRef<GasifierFormRef>();
            
            // Add to gasifierObservationData
            setGasifierObservationData(prevData => ({
              ...prevData,
              [formId]: {
                formId,
                gasifierCode: template.gasifier_code,
                imageFile: null,
                chemicalType: template.chemical_type || 'CLO2',
                measure: null,
                anomaly: template.anomaly || false,
                placementHeight: template.placement_height || null,
                directionalPlacement: template.directional_placement || null,
                placementStrategy: template.placement_strategy || null,
                notes: template.notes || '',
                isValid: false,
                hasData: true,
                hasImage: false,
                isDirty: false
              }
            }));
            
            return {
              id: formId,
              ref: formRef,
              isValid: false,
              isDirty: false
            };
          });
          
          setGasifierForms(gasifierTemplateRefs);
          setLoadedFromTemplate(prev => ({ ...prev, gasifier: true }));
        }
        
        // If both observations and templates are empty, create an empty petri form
        if (petriData.length === 0 && !hasPetriTemplates) {
          addPetriForm();
        }
      } catch (error) {
        console.error('Error loading submission data:', error);
        setError('Failed to load submission data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [submissionId, programId, siteId, navigate, selectedSite, fetchSite, setSelectedSite, hasPetriTemplates, hasGasifierTemplates, loadedFromTemplate, fetchSubmissionPetriObservations, fetchSubmissionGasifierObservations, setCurrentSessionId]);

  // Set up auto-save timer
  useEffect(() => {
    // Clear any existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set up a new timer only if session is active and we have unsaved changes
    if (session && !isSessionReadOnly && !isAllSaved) {
      autoSaveTimerRef.current = setTimeout(() => {
        logger.debug('Auto-save timer triggered');
        handleSave();
      }, 30000); // Auto-save after 30 seconds of inactivity
    }
    
    // Clear the timer on component unmount
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [isAllSaved, session, isSessionReadOnly]);
  
  // Add a petri form
  const addPetriForm = () => {
    const formId = uuidv4();
    const formRef = React.createRef<PetriFormRef>();
    setPetriForms(prev => [...prev, { id: formId, ref: formRef, isValid: false, isDirty: false }]);
    
    // Check if we should show template warning
    if (hasPetriTemplates && !loadedFromTemplate.petri) {
      setTemplateWarningType('Petri');
      setShowTemplateWarning(true);
    }
    
    // Update unsaved state
    setIsAllSaved(false);
  };
  
  // Remove a petri form
  const removePetriForm = (id: string) => {
    setPetriForms(prev => prev.filter(form => form.id !== id));
    
    // Also remove from petriObservationData
    setPetriObservationData(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    
    // Update unsaved state
    setIsAllSaved(false);
  };
  
  // Add a gasifier form
  const addGasifierForm = () => {
    const formId = uuidv4();
    const formRef = React.createRef<GasifierFormRef>();
    setGasifierForms(prev => [...prev, { id: formId, ref: formRef, isValid: false, isDirty: false }]);
    
    // Check if we should show template warning
    if (hasGasifierTemplates && !loadedFromTemplate.gasifier) {
      setTemplateWarningType('Gasifier');
      setShowTemplateWarning(true);
    }
    
    // Update unsaved state
    setIsAllSaved(false);
  };
  
  // Remove a gasifier form
  const removeGasifierForm = (id: string) => {
    setGasifierForms(prev => prev.filter(form => form.id !== id));
    
    // Also remove from gasifierObservationData
    setGasifierObservationData(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    
    // Update unsaved state
    setIsAllSaved(false);
  };
  
  // Handle environmental values change
  const handleEnvironmentalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEnvironmentalValues(prev => ({ ...prev, [name]: value }));
    
    // Update unsaved state
    setIsAllSaved(false);
  };
  
  // Save submission data
  const handleSave = async () => {
    // Reset auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Check if we have permission to edit
    if (!canEditSubmission) {
      setPermissionMessage("You don't have permission to edit this submission. Please contact your program administrator.");
      setShowPermissionModal(true);
      return;
    }
    
    // Don't allow saving if session is read-only
    if (isSessionReadOnly) {
      toast.warning('This submission cannot be edited');
      return;
    }
    
    // Don't save if there are no changes
    const hasDirtyPetriForms = petriForms.some(form => form.isDirty);
    const hasDirtyGasifierForms = gasifierForms.some(form => form.isDirty);
    
    if (!hasDirtyPetriForms && !hasDirtyGasifierForms) {
      logger.debug('No changes to save');
      return;
    }
    
    setIsSaving(true);
    try {
      // Update session activity timestamp
      if (currentSessionId) {
        await sessionManager.updateSessionActivity(currentSessionId);
      }
      
      // Prepare submission data
      const submissionData = {
        temperature: parseFloat(environmentalValues.temperature.toString()),
        humidity: parseFloat(environmentalValues.humidity.toString()),
        airflow: environmentalValues.airflow,
        odorDistance: environmentalValues.odorDistance as '5-10ft' | '10-25ft' | '25-50ft' | '50-100ft' | '>100ft',
        weather: environmentalValues.weather as 'Clear' | 'Cloudy' | 'Rain',
        notes: environmentalValues.notes || null,
        indoor_temperature: environmentalValues.indoor_temperature ? parseFloat(environmentalValues.indoor_temperature.toString()) : null,
        indoor_humidity: environmentalValues.indoor_humidity ? parseFloat(environmentalValues.indoor_humidity.toString()) : null
      };
      
      // Get all petri observations that need to be saved (have observationId or are dirty)
      const petriObservationsToSave = Object.values(petriObservationData).filter(data => 
        data.observationId || data.isDirty
      );
      
      // Get all gasifier observations that need to be saved (have observationId or are dirty)
      const gasifierObservationsToSave = Object.values(gasifierObservationData).filter(data => 
        data.observationId || data.isDirty
      );
      
      logger.debug(`Saving submission with ${petriObservationsToSave.length} petri and ${gasifierObservationsToSave.length} gasifier observations`, {
        submissionId,
        petriFormIds: petriObservationsToSave.map(p => p.formId),
        gasifierFormIds: gasifierObservationsToSave.map(g => g.formId)
      });
      
      // Update the submission
      const result = await updateSubmission(
        submissionId!,
        submissionData.temperature,
        submissionData.humidity,
        submissionData.airflow,
        submissionData.odorDistance,
        submissionData.weather,
        submissionData.notes,
        petriObservationsToSave,
        gasifierObservationsToSave,
        submissionData.indoor_temperature,
        submissionData.indoor_humidity
      );
      
      if (result) {
        logger.debug('Submission updated successfully');
        
        // Update form data with the new observation IDs
        if (result.updatedPetriObservations) {
          result.updatedPetriObservations.forEach(update => {
            // Find the form in our forms array
            const formIndex = petriForms.findIndex(form => form.id === update.clientId);
            if (formIndex !== -1) {
              // Update the observationId in the form
              setPetriForms(prev => {
                const updated = [...prev];
                updated[formIndex] = {
                  ...updated[formIndex],
                  observationId: update.observationId,
                  isDirty: false // Reset dirty flag
                };
                return updated;
              });
              
              // Update the observationId in the form data
              setPetriObservationData(prev => {
                const updated = { ...prev };
                if (updated[update.clientId]) {
                  updated[update.clientId] = {
                    ...updated[update.clientId],
                    observationId: update.observationId,
                    isDirty: false // Reset dirty flag
                  };
                }
                return updated;
              });
              
              // Reset the dirty flag on the form ref
              petriForms[formIndex].ref.current?.resetDirty();
            }
          });
        }
        
        if (result.updatedGasifierObservations) {
          result.updatedGasifierObservations.forEach(update => {
            // Find the form in our forms array
            const formIndex = gasifierForms.findIndex(form => form.id === update.clientId);
            if (formIndex !== -1) {
              // Update the observationId in the form
              setGasifierForms(prev => {
                const updated = [...prev];
                updated[formIndex] = {
                  ...updated[formIndex],
                  observationId: update.observationId,
                  isDirty: false // Reset dirty flag
                };
                return updated;
              });
              
              // Update the observationId in the form data
              setGasifierObservationData(prev => {
                const updated = { ...prev };
                if (updated[update.clientId]) {
                  updated[update.clientId] = {
                    ...updated[update.clientId],
                    observationId: update.observationId,
                    isDirty: false // Reset dirty flag
                  };
                }
                return updated;
              });
              
              // Reset the dirty flag on the form ref
              gasifierForms[formIndex].ref.current?.resetDirty();
            }
          });
        }
        
        // Set all saved flag
        setIsAllSaved(true);
        
        toast.success('Submission saved successfully');
      } else {
        toast.error('Error saving submission');
      }
    } catch (error) {
      console.error('Error saving submission:', error);
      toast.error('Error saving submission');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Complete submission
  const handleComplete = async () => {
    // Validate all forms first
    const allPetrisValid = await validateAllPetriForms();
    const allGasifiersValid = await validateAllGasifierForms();
    
    // Check template coverage if relevant
    let shouldShowConfirmModal = false;
    
    if (hasPetriTemplates && petriForms.length < selectedSite?.petri_defaults.length) {
      shouldShowConfirmModal = true;
    }
    
    if (hasGasifierTemplates && gasifierForms.length < selectedSite?.gasifier_defaults.length) {
      shouldShowConfirmModal = true;
    }
    
    // If any forms are invalid, don't proceed
    if (!allPetrisValid || !allGasifiersValid) {
      toast.error('Please complete all required fields and add images for all observations');
      return;
    }
    
    // If we need confirmation for incomplete submission, show the modal
    if (shouldShowConfirmModal) {
      setIsConfirmModalOpen(true);
      return;
    }
    
    // Otherwise, proceed with completion
    completeSubmission();
  };
  
  // Actually complete the submission
  const completeSubmission = async () => {
    if (!currentSessionId) {
      toast.error('No active session found');
      return;
    }
    
    // Save first to ensure all changes are persisted
    await handleSave();
    
    setIsCompleting(true);
    try {
      // Call RPC to complete the session
      const result = await sessionManager.completeSubmissionSession(currentSessionId);
      
      if (result.success) {
        toast.success('Submission completed successfully');
        
        // Update the session state
        setSession({
          ...session,
          session_status: 'Completed',
          completion_time: new Date().toISOString(),
          completed_by_user_id: user?.id
        });
        
        // Clear current session ID in the session store
        setCurrentSessionId(null);
      } else {
        toast.error(result.message || 'Error completing submission');
      }
    } catch (error) {
      console.error('Error completing submission:', error);
      toast.error('Error completing submission');
    } finally {
      setIsCompleting(false);
      setIsConfirmModalOpen(false);
    }
  };
  
  // Cancel submission
  const handleCancel = async () => {
    if (!currentSessionId) {
      toast.error('No active session found');
      return;
    }
    
    if (window.confirm('Are you sure you want to cancel this submission? Any unsaved changes will be lost.')) {
      try {
        // Call RPC to cancel the session
        const success = await sessionManager.cancelSubmissionSession(currentSessionId);
        
        if (success) {
          toast.success('Submission cancelled successfully');
          
          // Update the session state
          setSession({
            ...session,
            session_status: 'Cancelled'
          });
          
          // Clear current session ID in the session store
          setCurrentSessionId(null);
          
          // Navigate back to the site page
          navigate(`/programs/${programId}/sites/${siteId}`);
        } else {
          toast.error('Error cancelling submission');
        }
      } catch (error) {
        console.error('Error cancelling submission:', error);
        toast.error('Error cancelling submission');
      }
    }
  };
  
  // Share session
  const handleShare = async () => {
    if (!currentSessionId) {
      toast.error('No active session found');
      return;
    }
    
    setIsShareModalOpen(true);
  };
  
  // Validate all petri forms
  const validateAllPetriForms = async () => {
    const validationResults = await Promise.all(
      petriForms.map(async form => {
        if (form.ref.current) {
          return form.ref.current.validate();
        }
        return false;
      })
    );
    
    return validationResults.every(result => result);
  };
  
  // Validate all gasifier forms
  const validateAllGasifierForms = async () => {
    const validationResults = await Promise.all(
      gasifierForms.map(async form => {
        if (form.ref.current) {
          return form.ref.current.validate();
        }
        return false;
      })
    );
    
    return validationResults.every(result => result);
  };
  
  // Calculate form completion percentages
  const getFormCompletionCounts = () => {
    const totalPetriForms = petriForms.length;
    const validPetriForms = petriForms.filter(form => form.isValid).length;
    
    const totalGasifierForms = gasifierForms.length;
    const validGasifierForms = gasifierForms.filter(form => form.isValid).length;
    
    return {
      petrisComplete: validPetriForms,
      petrisTotal: totalPetriForms,
      gasifiersComplete: validGasifierForms,
      gasifiersTotal: totalGasifierForms
    };
  };

  // Handle petri form data updates
  const handlePetriFormUpdate = (formId: string, data: PetriFormData) => {
    // Store complete data in petriObservationData
    setPetriObservationData(prevData => ({
      ...prevData,
      [formId]: data
    }));
    
    // Update form validation state
    setPetriForms(prevForms => 
      prevForms.map(f => 
        f.id === formId 
          ? { 
              ...f, 
              isValid: data.isValid, 
              isDirty: data.isDirty || f.isDirty,
              observationId: data.observationId
            } 
          : f
      )
    );
    
    // Update all saved state
    if (data.isDirty) {
      setIsAllSaved(false);
    }
  };

  // Handle gasifier form data updates
  const handleGasifierFormUpdate = (formId: string, data: GasifierFormData) => {
    // Store complete data in gasifierObservationData
    setGasifierObservationData(prevData => ({
      ...prevData,
      [formId]: data
    }));
    
    // Update form validation state
    setGasifierForms(prevForms => 
      prevForms.map(f => 
        f.id === formId 
          ? { 
              ...f, 
              isValid: data.isValid, 
              isDirty: data.isDirty || f.isDirty,
              observationId: data.observationId
            } 
          : f
      )
    );
    
    // Update all saved state
    if (data.isDirty) {
      setIsAllSaved(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-error-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Submission</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <Button
          variant="primary"
          onClick={() => navigate(`/programs/${programId}/sites/${siteId}`)}
        >
          Return to Site
        </Button>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Submission not found.</p>
        <Button
          variant="primary"
          className="mt-4"
          onClick={() => navigate(`/programs/${programId}/sites/${siteId}`)}
        >
          Return to Site
        </Button>
      </div>
    );
  }

  const { petrisComplete, petrisTotal, gasifiersComplete, gasifiersTotal } = getFormCompletionCounts();

  return (
    <div className="animate-fade-in">
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate(`/programs/${programId}/sites/${siteId}`)}
          className="mr-4 p-2 rounded-full hover:bg-gray-100"
          aria-label="Go back"
        >
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {submission.global_submission_id 
              ? `Submission #${submission.global_submission_id}` 
              : 'Edit Submission'}
          </h1>
          <p className="text-gray-600 mt-1">
            {selectedSite?.name || 'Loading...'} - {format(new Date(submission.created_at), 'MMMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Action bar */}
      {!isSessionReadOnly && (
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm mb-6 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              {isAllSaved ? (
                <span className="flex items-center text-success-600 text-sm">
                  <CheckCircle size={16} className="mr-1" />
                  All changes saved
                </span>
              ) : (
                <span className="flex items-center text-warning-600 text-sm">
                  <Clock size={16} className="mr-1" />
                  Unsaved changes
                </span>
              )}
            </div>
            <div className="flex space-x-3">
              {!isSessionReadOnly && (
                <>
                  <Button
                    variant="danger"
                    onClick={handleCancel}
                    isLoading={isSaving}
                    disabled={!canEditSubmission}
                    icon={<XCircle size={16} />}
                    testId="cancel-submission-button"
                  >
                    Cancel
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleShare}
                    isLoading={isSaving}
                    disabled={!canEditSubmission}
                    icon={<Share2 size={16} />}
                    testId="share-submission-button"
                  >
                    Share
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleSave}
                    isLoading={isSaving}
                    disabled={!canEditSubmission || isAllSaved}
                    icon={<Save size={16} />}
                    testId="save-submission-button"
                  >
                    Save
                  </Button>
                  
                  <Button
                    variant="primary"
                    onClick={handleComplete}
                    isLoading={isCompleting}
                    disabled={!canEditSubmission}
                    icon={<Check size={16} />}
                    testId="complete-submission-button"
                  >
                    Complete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Session overview card */}
      <SubmissionOverviewCard
        session={session}
        submissionCreatedAt={submission?.created_at}
        openedByUserEmail={submission?.creator?.email}
        openedByUserName={submission?.creator?.full_name}
        onShare={handleShare}
        canShare={!isSessionReadOnly && canEditSubmission}
        petrisComplete={petrisComplete}
        petrisTotal={petrisTotal}
        gasifiersComplete={gasifiersComplete}
        gasifiersTotal={gasifiersTotal}
        sharedUsersDetails={sharedUsersDetails}
      />

      {/* Environmental data card */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="font-medium">Environmental Data</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Outdoor environment */}
            <div>
              <h3 className="text-md font-medium mb-3 text-gray-700">Outdoor Environment</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Temperature */}
                <div className="mb-4">
                  <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-1">
                    Temperature (°F)
                  </label>
                  <input
                    type="number"
                    id="temperature"
                    name="temperature"
                    value={environmentalValues.temperature}
                    onChange={handleEnvironmentalChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                    disabled={isSessionReadOnly}
                    data-testid="temperature-input"
                  />
                </div>
                
                {/* Humidity */}
                <div className="mb-4">
                  <label htmlFor="humidity" className="block text-sm font-medium text-gray-700 mb-1">
                    Humidity (%)
                  </label>
                  <input
                    type="number"
                    id="humidity"
                    name="humidity"
                    value={environmentalValues.humidity}
                    onChange={handleEnvironmentalChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                    disabled={isSessionReadOnly}
                    data-testid="humidity-input"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Airflow */}
                <div className="mb-4">
                  <label htmlFor="airflow" className="block text-sm font-medium text-gray-700 mb-1">
                    Airflow
                  </label>
                  <select
                    id="airflow"
                    name="airflow"
                    value={environmentalValues.airflow}
                    onChange={handleEnvironmentalChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                    disabled={isSessionReadOnly}
                    data-testid="airflow-select"
                  >
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
                
                {/* Odor Distance */}
                <div className="mb-4">
                  <label htmlFor="odorDistance" className="block text-sm font-medium text-gray-700 mb-1">
                    Odor Distance
                  </label>
                  <select
                    id="odorDistance"
                    name="odorDistance"
                    value={environmentalValues.odorDistance}
                    onChange={handleEnvironmentalChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                    disabled={isSessionReadOnly}
                    data-testid="odor-distance-select"
                  >
                    <option value="5-10ft">5-10 ft</option>
                    <option value="10-25ft">10-25 ft</option>
                    <option value="25-50ft">25-50 ft</option>
                    <option value="50-100ft">50-100 ft</option>
                    <option value=">100ft">More than 100 ft</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Indoor environment */}
            <div>
              <h3 className="text-md font-medium mb-3 text-gray-700">Indoor Environment</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Indoor Temperature */}
                <div className="mb-4">
                  <label htmlFor="indoor_temperature" className="block text-sm font-medium text-gray-700 mb-1">
                    Indoor Temperature (°F)
                  </label>
                  <input
                    type="number"
                    id="indoor_temperature"
                    name="indoor_temperature"
                    value={environmentalValues.indoor_temperature || ''}
                    onChange={handleEnvironmentalChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder="Optional"
                    disabled={isSessionReadOnly}
                    data-testid="indoor-temperature-input"
                  />
                </div>
                
                {/* Indoor Humidity */}
                <div className="mb-4">
                  <label htmlFor="indoor_humidity" className="block text-sm font-medium text-gray-700 mb-1">
                    Indoor Humidity (%)
                  </label>
                  <input
                    type="number"
                    id="indoor_humidity"
                    name="indoor_humidity"
                    value={environmentalValues.indoor_humidity || ''}
                    onChange={handleEnvironmentalChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder="Optional"
                    disabled={isSessionReadOnly}
                    data-testid="indoor-humidity-input"
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label htmlFor="weather" className="block text-sm font-medium text-gray-700 mb-1">
                  Weather
                </label>
                <select
                  id="weather"
                  name="weather"
                  value={environmentalValues.weather}
                  onChange={handleEnvironmentalChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                  disabled={isSessionReadOnly}
                  data-testid="weather-select"
                >
                  <option value="Clear">Clear</option>
                  <option value="Cloudy">Cloudy</option>
                  <option value="Rain">Rain</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="mb-4">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              value={environmentalValues.notes}
              onChange={handleEnvironmentalChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="Enter any notes about this submission"
              disabled={isSessionReadOnly}
              data-testid="notes-textarea"
            ></textarea>
          </div>
        </CardContent>
      </Card>

      {/* Petri Observations */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="font-medium">Petri Observations</h2>
            {!isSessionReadOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={addPetriForm}
                icon={<Plus size={16} />}
                testId="add-petri-button"
              >
                Add Petri
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {petriForms.map((form, index) => {
              const observation = petriObservations.find(obs => obs.observation_id === form.id);
              
              return (
                <PetriForm
                  key={form.id}
                  id={`petri-form-${form.id}`}
                  formId={form.id}
                  index={index + 1}
                  siteId={siteId!}
                  submissionSessionId={session?.session_id || submissionId!}
                  ref={form.ref}
                  onUpdate={(formId, data) => handlePetriFormUpdate(formId, data)}
                  onRemove={() => removePetriForm(form.id)}
                  showRemoveButton={petriForms.length > 1}
                  initialData={observation ? {
                    petriCode: observation.petri_code,
                    imageUrl: observation.image_url,
                    plantType: observation.plant_type,
                    fungicideUsed: observation.fungicide_used,
                    surroundingWaterSchedule: observation.surrounding_water_schedule,
                    notes: observation.notes || '',
                    placement: observation.placement,
                    placement_dynamics: observation.placement_dynamics,
                    observationId: observation.observation_id,
                    outdoor_temperature: observation.outdoor_temperature,
                    outdoor_humidity: observation.outdoor_humidity
                  } : undefined}
                  disabled={isSessionReadOnly}
                  observationId={form.observationId}
                  submissionOutdoorTemperature={submission.temperature}
                  submissionOutdoorHumidity={submission.humidity}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Gasifier Observations */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="font-medium">Gasifier Observations</h2>
            {!isSessionReadOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={addGasifierForm}
                icon={<Plus size={16} />}
                testId="add-gasifier-button"
              >
                Add Gasifier
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {gasifierForms.map((form, index) => {
              const observation = gasifierObservations.find(obs => obs.observation_id === form.id);
              
              return (
                <GasifierForm
                  key={form.id}
                  id={`gasifier-form-${form.id}`}
                  formId={form.id}
                  index={index + 1}
                  siteId={siteId!}
                  submissionSessionId={session?.session_id || submissionId!}
                  ref={form.ref}
                  onUpdate={(formId, data) => handleGasifierFormUpdate(formId, data)}
                  onRemove={() => removeGasifierForm(form.id)}
                  showRemoveButton={gasifierForms.length > 1}
                  initialData={observation ? {
                    gasifierCode: observation.gasifier_code,
                    imageUrl: observation.image_url,
                    chemicalType: observation.chemical_type,
                    measure: observation.measure,
                    anomaly: observation.anomaly,
                    placementHeight: observation.placement_height,
                    directionalPlacement: observation.directional_placement,
                    placementStrategy: observation.placement_strategy,
                    notes: observation.notes || '',
                    observationId: observation.observation_id,
                    outdoor_temperature: observation.outdoor_temperature,
                    outdoor_humidity: observation.outdoor_humidity
                  } : undefined}
                  disabled={isSessionReadOnly}
                  observationId={form.observationId}
                  submissionOutdoorTemperature={submission.temperature}
                  submissionOutdoorHumidity={submission.humidity}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Buttons for the bottom of the page */}
      {!isSessionReadOnly && (
        <div className="flex justify-end space-x-3 mb-20 sm:mb-0">
          <Button
            variant="outline"
            onClick={() => navigate(`/programs/${programId}/sites/${siteId}`)}
            icon={<ArrowLeft size={16} />}
            testId="back-to-site-button"
          >
            Back to Site
          </Button>
          
          <Button
            variant="outline"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={!canEditSubmission || isAllSaved}
            icon={<Save size={16} />}
            testId="save-button"
          >
            Save
          </Button>
          
          <Button
            variant="primary"
            onClick={handleComplete}
            isLoading={isCompleting}
            disabled={!canEditSubmission}
            icon={<Check size={16} />}
            testId="complete-button"
          >
            Complete
          </Button>
        </div>
      )}

      {/* Template warning modal */}
      <TemplateWarningModal
        isOpen={showTemplateWarning}
        onClose={() => setShowTemplateWarning(false)}
        onConfirm={() => setShowTemplateWarning(false)}
        entityType={templateWarningType}
      />

      {/* Confirm submission modal */}
      <ConfirmSubmissionModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={completeSubmission}
        currentPetriCount={petriForms.length}
        currentGasifierCount={gasifierForms.length}
        expectedPetriCount={selectedSite?.petri_defaults?.length || 0}
        expectedGasifierCount={selectedSite?.gasifier_defaults?.length || 0}
        siteName={selectedSite?.name || ''}
      />

      {/* Permission modal */}
      <PermissionModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        message={permissionMessage}
      />

      {/* Share modal */}
      <SessionShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        sessionId={currentSessionId!}
        programId={programId!}
      />
    </div>
  );
};

export default SubmissionEditPage;