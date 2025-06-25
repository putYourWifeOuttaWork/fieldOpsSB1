import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { 
  ArrowLeft,
  ChevronDown, 
  ChevronUp, 
  Save, 
  Plus, 
  Check, 
  X, 
  Share2,
  AlertTriangle,
  ExternalLink,
  History,
  Clock
} from 'lucide-react';
import Button from '../components/common/Button';
import Card, { CardHeader, CardContent, CardFooter } from '../components/common/Card';
import Input from '../components/common/Input';
import LoadingScreen from '../components/common/LoadingScreen';
import PetriForm, { PetriFormRef } from '../components/submissions/PetriForm';
import GasifierForm, { GasifierFormRef } from '../components/submissions/GasifierForm';
import ObservationListManager, { ObservationFormState } from '../components/forms/ObservationListManager';
import { useSubmissions } from '../hooks/useSubmissions';
import { usePilotProgramStore } from '../stores/pilotProgramStore';
import { useSites } from '../hooks/useSites';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import ConfirmSubmissionModal from '../components/submissions/ConfirmSubmissionModal';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import SyncStatus from '../components/common/SyncStatus';
import TemplateWarningModal from '../components/submissions/TemplateWarningModal';
import { useSessionStore } from '../stores/sessionStore';
import PermissionModal from '../components/common/PermissionModal';
import useUserRole from '../hooks/useUserRole';
import useOfflineSession from '../hooks/useOfflineSession';
import sessionManager from '../lib/sessionManager';
import SessionShareModal from '../components/submissions/SessionShareModal';
import SubmissionOverviewCard from '../components/submissions/SubmissionOverviewCard';
import { GasifierObservation, PetriObservation, Submission } from '../lib/types';
import { supabase } from '../lib/supabaseClient';

interface PetriForms extends ObservationFormState {
  petriCode: string;
  formId: string;
  imageFile: File | null;
  imageUrl?: string;
  tempImageKey?: string;
  fungicideUsed: string;
  surroundingWaterSchedule: string;
  placement?: string | null;
  placement_dynamics?: string | null;
  notes: string;
  // Additional fields for environmental data
  outdoor_temperature?: number;
  outdoor_humidity?: number;
  // Reference to the backend observation
  observationId?: string;
}

interface GasifierForms extends ObservationFormState {
  gasifierCode: string;
  formId: string;
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
  // Additional fields for environmental data
  outdoor_temperature?: number;
  outdoor_humidity?: number;
  // Reference to the backend observation
  observationId?: string;
}

const SubmissionEditPage = () => {
  const { programId, siteId, submissionId } = useParams<{ programId: string; siteId: string; submissionId: string }>();
  const navigate = useNavigate();
  const { 
    fetchSubmissionPetriObservations, 
    fetchSubmissionGasifierObservations, 
    updateSubmission,
    deleteSubmission
  } = useSubmissions(siteId);
  const { setSelectedSite } = usePilotProgramStore();
  const { fetchSite, loading: siteLoading } = useSites(programId);
  const isOnline = useOnlineStatus();
  const { canEditSubmission, canDeleteSubmission } = useUserRole({ programId });
  const { currentSessionId, setCurrentSessionId } = useSessionStore();
  
  // State for submission data
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [petriObservations, setPetriObservations] = useState<PetriObservation[]>([]);
  const [gasifierObservations, setGasifierObservations] = useState<GasifierObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteData, setSiteData] = useState<any | null>(null);
  const [templateExists, setTemplateExists] = useState(false);
  const [expectedPetriCount, setExpectedPetriCount] = useState(0);
  const [expectedGasifierCount, setExpectedGasifierCount] = useState(0);

  // State for session management
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [openedByUserEmail, setOpenedByUserEmail] = useState<string | undefined>(undefined);
  const [openedByUserName, setOpenedByUserName] = useState<string | undefined>(undefined);

  // State for form components
  const [isPetriAccordionOpen, setIsPetriAccordionOpen] = useState(true);
  const [isGasifierAccordionOpen, setIsGasifierAccordionOpen] = useState(true);
  const [petriForms, setPetriForms] = useState<PetriForms[]>([]);
  const [gasifierForms, setGasifierForms] = useState<GasifierForms[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  
  // Template warning modal state
  const [showTemplateWarning, setShowTemplateWarning] = useState(false);
  const [templateWarningType, setTemplateWarningType] = useState<'Petri' | 'Gasifier'>('Petri');
  
  // Permission modal state
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState('');
  
  // Sharing session modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  // Form field values
  const [temperature, setTemperature] = useState<number | ''>('');
  const [humidity, setHumidity] = useState<number | ''>('');
  const [airflow, setAirflow] = useState<'Open' | 'Closed'>('Open');
  const [odorDistance, setOdorDistance] = useState<'5-10ft' | '10-25ft' | '25-50ft' | '50-100ft' | '>100ft'>('5-10ft');
  const [weather, setWeather] = useState<'Clear' | 'Cloudy' | 'Rain'>('Clear');
  const [notes, setNotes] = useState('');
  const [indoorTemperature, setIndoorTemperature] = useState<number | ''>('');
  const [indoorHumidity, setIndoorHumidity] = useState<number | ''>('');
  
  // Refs for form elements
  const petriFormRefs = useRef<{ [key: string]: PetriFormRef | null }>({});
  const gasifierFormRefs = useRef<{ [key: string]: GasifierFormRef | null }>({});
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use offline session hook to manage session data
  const offlineSession = useOfflineSession({ 
    submissionId: submissionId, 
    sessionId: currentSessionId || undefined
  });

  // Load submission, session and observations data
  const loadSubmissionData = useCallback(async () => {
    if (!submissionId || !siteId || !programId) {
      navigate('/programs');
      return;
    }

    setLoading(true);
    try {
      // Load site data first to get template information
      const site = await fetchSite(siteId);
      if (!site) {
        throw new Error('Site not found');
      }
      setSiteData(site);
      setSelectedSite(site);

      // Determine if there's a template and how many observations we expect
      const petriTemplate = site.petri_defaults;
      const gasifierTemplate = site.gasifier_defaults;
      setTemplateExists(!!(petriTemplate || gasifierTemplate));
      setExpectedPetriCount(petriTemplate?.length || 0);
      setExpectedGasifierCount(gasifierTemplate?.length || 0);

      // Load observation data from Supabase
      const petriObs = await fetchSubmissionPetriObservations(submissionId);
      const gasifierObs = await fetchSubmissionGasifierObservations(submissionId);
      setPetriObservations(petriObs);
      setGasifierObservations(gasifierObs);

      // If we have an offline session, load the form data from it
      if (offlineSession.session) {
        // Set current session ID
        setCurrentSessionId(offlineSession.session.session_id);
        setSessionLoaded(true);

        // Get creator email from the session if available
        // Note: Need to implement logic to get this from the server or cache
        
        // Set form fields from submission
        if (offlineSession.session) {
          // Load submission form data from the server
          const { data: submissionData, error: submissionError } = await supabase
            .from('submissions')
            .select('*, created_by')
            .eq('submission_id', submissionId)
            .single();
            
          if (submissionError) throw submissionError;
          setSubmission(submissionData);

          // Get creator info if available
          if (submissionData.created_by) {
            try {
              const { data: userData, error: userError } = await supabase
                .from('users')
                .select('email, full_name')
                .eq('id', submissionData.created_by)
                .single();
                
              if (!userError && userData) {
                setOpenedByUserEmail(userData.email);
                setOpenedByUserName(userData.full_name);
              }
            } catch (err) {
              console.error('Error fetching user info:', err);
            }
          }
          
          // Set form values from submission
          setTemperature(submissionData.temperature);
          setHumidity(submissionData.humidity);
          setIndoorTemperature(submissionData.indoor_temperature || '');
          setIndoorHumidity(submissionData.indoor_humidity || '');
          setAirflow(submissionData.airflow as 'Open' | 'Closed');
          setOdorDistance(submissionData.odor_distance as '5-10ft' | '10-25ft' | '25-50ft' | '50-100ft' | '>100ft');
          setWeather(submissionData.weather as 'Clear' | 'Cloudy' | 'Rain');
          setNotes(submissionData.notes || '');
        }

        // Initialize form state from cached data if available, otherwise from server data
        let initialPetriForms: PetriForms[] = [];
        let initialGasifierForms: GasifierForms[] = [];
        
        // First try to load from cached session observations data
        if (offlineSession.session.petriObservationsData && offlineSession.session.petriObservationsData.length > 0) {
          console.log('Loading petri forms from cached session data', offlineSession.session.petriObservationsData);
          initialPetriForms = offlineSession.session.petriObservationsData.map(data => ({
            ...data,
            id: `petri-form-${data.formId}`,
            isValid: !!data.petriCode && !!data.surroundingWaterSchedule && !!data.fungicideUsed && data.hasImage,
            hasData: !!data.observationId || !!data.petriCode || !!data.surroundingWaterSchedule || data.fungicideUsed !== 'No' || !!data.notes,
            isDirty: data.isDirty
          }));
        } else if (petriObs.length > 0) {
          // If no cached data, load from server data
          initialPetriForms = petriObs.map(obs => {
            const formId = uuidv4();
            return {
              id: `petri-form-${formId}`,
              formId,
              petriCode: obs.petri_code,
              imageFile: null,
              imageUrl: obs.image_url || undefined,
              fungicideUsed: obs.fungicide_used || 'No',
              surroundingWaterSchedule: obs.surrounding_water_schedule || '',
              placement: obs.placement || null,
              placement_dynamics: obs.placement_dynamics || null,
              notes: obs.notes || '',
              outdoor_temperature: obs.outdoor_temperature || undefined,
              outdoor_humidity: obs.outdoor_humidity || undefined,
              observationId: obs.observation_id,
              isValid: true,
              hasData: true,
              hasImage: !!obs.image_url,
              isDirty: false
            };
          });
        }

        // Do the same for gasifier forms
        if (offlineSession.session.gasifierObservationsData && offlineSession.session.gasifierObservationsData.length > 0) {
          console.log('Loading gasifier forms from cached session data', offlineSession.session.gasifierObservationsData);
          initialGasifierForms = offlineSession.session.gasifierObservationsData.map(data => ({
            ...data,
            id: `gasifier-form-${data.formId}`,
            isValid: !!data.gasifierCode && !!data.chemicalType && data.hasImage,
            hasData: !!data.observationId || !!data.gasifierCode || !!data.chemicalType || data.anomaly || !!data.notes,
            isDirty: data.isDirty
          }));
        } else if (gasifierObs.length > 0) {
          // If no cached data, load from server data
          initialGasifierForms = gasifierObs.map(obs => {
            const formId = uuidv4();
            return {
              id: `gasifier-form-${formId}`,
              formId,
              gasifierCode: obs.gasifier_code,
              imageFile: null,
              imageUrl: obs.image_url || undefined,
              chemicalType: obs.chemical_type || 'CLO2',
              measure: obs.measure,
              anomaly: obs.anomaly || false,
              placementHeight: obs.placement_height || undefined,
              directionalPlacement: obs.directional_placement || undefined,
              placementStrategy: obs.placement_strategy || undefined,
              notes: obs.notes || '',
              outdoor_temperature: obs.outdoor_temperature || undefined,
              outdoor_humidity: obs.outdoor_humidity || undefined,
              observationId: obs.observation_id,
              isValid: true,
              hasData: true,
              hasImage: !!obs.image_url,
              isDirty: false
            };
          });
        }

        // Set form states
        setPetriForms(initialPetriForms);
        setGasifierForms(initialGasifierForms);
      } else {
        // If no session, create a new one or redirect back
        toast.error('No active session for this submission');
        navigate(`/programs/${programId}/sites/${siteId}`);
        return;
      }
    } catch (error) {
      console.error('Error loading submission data:', error);
      toast.error('Failed to load submission data');
      navigate(`/programs/${programId}/sites/${siteId}`);
      return;
    } finally {
      setLoading(false);
    }
  }, [submissionId, siteId, programId, fetchSite, setSelectedSite, fetchSubmissionPetriObservations, fetchSubmissionGasifierObservations, navigate, offlineSession.session]);

  // Load data on component mount
  useEffect(() => {
    loadSubmissionData();
  }, [loadSubmissionData]);

  // Auto-save when form becomes dirty
  useEffect(() => {
    if (formDirty && submission) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        handleSave(false); // Auto-save without UI feedback
      }, 30000); // Auto-save after 30 seconds of inactivity
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formDirty, submission, petriForms, gasifierForms]);
  
  // Save any changes to the session when it changes or form data changes
  useEffect(() => {
    if (sessionLoaded && offlineSession.session && (petriForms.length > 0 || gasifierForms.length > 0)) {
      console.log('Saving session with form data to IndexedDB');
      
      offlineSession.saveSession(
        {}, // No changes to session properties
        petriForms, // Current petri forms data
        gasifierForms // Current gasifier forms data
      );
    }
  }, [sessionLoaded, offlineSession.session, petriForms, gasifierForms]);
  
  // Create default form initializer
  const createEmptyPetriForm = useCallback((): PetriForms => {
    const formId = uuidv4();
    return {
      id: `petri-form-${formId}`,
      formId,
      petriCode: '',
      imageFile: null,
      fungicideUsed: 'No',
      surroundingWaterSchedule: '',
      notes: '',
      isValid: false,
      hasData: false,
      hasImage: false,
      isDirty: true
    };
  }, []);
  
  const createEmptyGasifierForm = useCallback((): GasifierForms => {
    const formId = uuidv4();
    return {
      id: `gasifier-form-${formId}`,
      formId,
      gasifierCode: '',
      imageFile: null,
      chemicalType: 'CLO2',
      measure: null,
      anomaly: false,
      notes: '',
      isValid: false,
      hasData: false,
      hasImage: false,
      isDirty: true
    };
  }, []);
  
  // Handle showing template warning
  const handleShowTemplateWarning = (type: 'Petri' | 'Gasifier') => {
    if (templateExists) {
      setTemplateWarningType(type);
      setShowTemplateWarning(true);
    }
  };
  
  // Handle petri form updates
  const handlePetriUpdate = useCallback((formId: string, data: any) => {
    setPetriForms(prevForms => {
      const formIndex = prevForms.findIndex(form => form.formId === formId);
      if (formIndex === -1) return prevForms;
      
      const updatedForms = [...prevForms];
      updatedForms[formIndex] = { ...updatedForms[formIndex], ...data };
      return updatedForms;
    });
    
    // Mark form as dirty if any data has changed
    if (data.isDirty) {
      setFormDirty(true);
    }
  }, []);
  
  // Handle gasifier form updates
  const handleGasifierUpdate = useCallback((formId: string, data: any) => {
    setGasifierForms(prevForms => {
      const formIndex = prevForms.findIndex(form => form.formId === formId);
      if (formIndex === -1) return prevForms;
      
      const updatedForms = [...prevForms];
      updatedForms[formIndex] = { ...updatedForms[formIndex], ...data };
      return updatedForms;
    });
    
    // Mark form as dirty if any data has changed
    if (data.isDirty) {
      setFormDirty(true);
    }
  }, []);
  
  // Update the form dirty state on field changes
  const handleFieldChange = (field: string, value: any) => {
    switch (field) {
      case 'temperature':
        setTemperature(value);
        break;
      case 'humidity':
        setHumidity(value);
        break;
      case 'airflow':
        setAirflow(value as 'Open' | 'Closed');
        break;
      case 'odorDistance':
        setOdorDistance(value as '5-10ft' | '10-25ft' | '25-50ft' | '50-100ft' | '>100ft');
        break;
      case 'weather':
        setWeather(value as 'Clear' | 'Cloudy' | 'Rain');
        break;
      case 'notes':
        setNotes(value);
        break;
      case 'indoorTemperature':
        setIndoorTemperature(value);
        break;
      case 'indoorHumidity':
        setIndoorHumidity(value);
        break;
    }
    setFormDirty(true);
  };
  
  // Handle submission save
  const handleSave = async (showToast = true) => {
    if (!submissionId || !canEditSubmission) {
      if (!canEditSubmission) {
        setPermissionMessage("You don't have permission to edit submissions. Please contact your program administrator.");
        setShowPermissionModal(true);
      }
      return;
    }
    
    if (isUpdating) return; // Prevent duplicate requests
    
    setIsUpdating(true);
    setIsSaving(true);
    
    try {
      // Validate all petri forms
      for (const formId in petriFormRefs.current) {
        const formRef = petriFormRefs.current[formId];
        if (formRef && formRef.hasData) {
          const isValid = await formRef.validate();
          if (!isValid) {
            // Focus the first invalid form
            const element = document.getElementById(formRef.petriCode ? `petri-form-${formId}` : formId);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            throw new Error(`Please complete the required fields for Petri ${formRef.petriCode || formId}`);
          }
        }
      }
      
      // Validate all gasifier forms
      for (const formId in gasifierFormRefs.current) {
        const formRef = gasifierFormRefs.current[formId];
        if (formRef && formRef.hasData) {
          const isValid = await formRef.validate();
          if (!isValid) {
            // Focus the first invalid form
            const element = document.getElementById(formRef.gasifierCode ? `gasifier-form-${formId}` : formId);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            throw new Error(`Please complete the required fields for Gasifier ${formRef.gasifierCode || formId}`);
          }
        }
      }
      
      // Filter forms to those that have data and are either dirty or have an observationId
      const petriFormsToUpdate = petriForms.filter(form => 
        form.hasData && (form.isDirty || form.observationId)
      );
      
      const gasifierFormsToUpdate = gasifierForms.filter(form => 
        form.hasData && (form.isDirty || form.observationId)
      );
      
      // Update submission
      const updatedSubmission = await updateSubmission(
        submissionId,
        Number(temperature),
        Number(humidity),
        airflow,
        odorDistance,
        weather,
        notes || null,
        petriFormsToUpdate,
        gasifierFormsToUpdate,
        indoorTemperature === '' ? null : Number(indoorTemperature),
        indoorHumidity === '' ? null : Number(indoorHumidity)
      );
      
      if (updatedSubmission) {
        // Reset dirty state
        setFormDirty(false);
        
        // Update form states with new observation IDs
        if (updatedSubmission.updatedPetriObservations) {
          setPetriForms(prevForms => {
            return prevForms.map(form => {
              const updatedObs = updatedSubmission.updatedPetriObservations.find(
                obs => obs.clientId === form.formId
              );
              
              if (updatedObs) {
                // Reset isDirty flag for saved forms
                if (petriFormRefs.current[form.formId]) {
                  petriFormRefs.current[form.formId]?.resetDirty();
                }
                
                return {
                  ...form,
                  observationId: updatedObs.observationId,
                  isDirty: false
                };
              }
              return form;
            });
          });
        }
        
        if (updatedSubmission.updatedGasifierObservations) {
          setGasifierForms(prevForms => {
            return prevForms.map(form => {
              const updatedObs = updatedSubmission.updatedGasifierObservations.find(
                obs => obs.clientId === form.formId
              );
              
              if (updatedObs) {
                // Reset isDirty flag for saved forms
                if (gasifierFormRefs.current[form.formId]) {
                  gasifierFormRefs.current[form.formId]?.resetDirty();
                }
                
                return {
                  ...form,
                  observationId: updatedObs.observationId,
                  isDirty: false
                };
              }
              return form;
            });
          });
        }
        
        // Update session
        if (offlineSession.session) {
          // Save current forms to session
          await offlineSession.saveSession({}, petriForms, gasifierForms);
        }
        
        if (showToast) {
          toast.success('Submission saved successfully');
        }
      }
    } catch (error) {
      console.error('Error saving submission:', error);
      
      if (showToast) {
        toast.error(`Error saving submission: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsUpdating(false);
      setIsSaving(false);
    }
  };
  
  // Handle submission completion
  const handleComplete = async () => {
    if (!submissionId || !canEditSubmission) {
      if (!canEditSubmission) {
        setPermissionMessage("You don't have permission to edit submissions. Please contact your program administrator.");
        setShowPermissionModal(true);
      }
      return;
    }
    
    // Count completed observations
    const completedPetriCount = petriForms.filter(form => form.isValid).length;
    const completedGasifierCount = gasifierForms.filter(form => form.isValid).length;
    
    // If we're expecting a certain number of observations and don't have them all,
    // show a confirmation dialog
    if (templateExists && 
        (completedPetriCount < expectedPetriCount || 
         completedGasifierCount < expectedGasifierCount)) {
      setShowConfirmModal(true);
      return;
    }
    
    // Proceed with completion
    await proceedWithCompletion();
  };
  
  // Handle submission completion confirmation
  const proceedWithCompletion = async () => {
    if (!submissionId || !offlineSession.session || !canEditSubmission) return;
    
    setIsUpdating(true);
    try {
      // First save the submission
      await handleSave(false);
      
      // Then complete the session
      const result = await sessionManager.completeSubmissionSession(offlineSession.session.session_id);
      
      if (result.success) {
        toast.success('Submission completed successfully');
        
        // Navigate back to the site
        navigate(`/programs/${programId}/sites/${siteId}`);
      } else {
        toast.error(`Failed to complete submission: ${result.message}`);
      }
    } catch (error) {
      console.error('Error completing submission:', error);
      toast.error(`Error completing submission: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
      setShowConfirmModal(false);
    }
  };
  
  // Handle submission cancellation
  const handleCancel = async () => {
    if (!submissionId || !offlineSession.session) return;
    
    setIsUpdating(true);
    try {
      // Cancel the session
      const success = await sessionManager.cancelSubmissionSession(offlineSession.session.session_id);
      
      if (success) {
        // Clear session ID
        setCurrentSessionId(null);
        
        toast.success('Submission cancelled');
        
        // Navigate back to the site
        navigate(`/programs/${programId}/sites/${siteId}`);
      } else {
        toast.error('Failed to cancel submission');
      }
    } catch (error) {
      console.error('Error cancelling submission:', error);
      toast.error(`Error cancelling submission: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
      setShowCancelModal(false);
    }
  };
  
  // Handle submission deletion
  const handleDelete = async () => {
    if (!submissionId || !canDeleteSubmission) {
      if (!canDeleteSubmission) {
        setPermissionMessage("You don't have permission to delete submissions. Please contact your program administrator.");
        setShowPermissionModal(true);
      }
      return;
    }
    
    setIsUpdating(true);
    try {
      // Delete the submission
      const success = await deleteSubmission(submissionId);
      
      if (success) {
        toast.success('Submission deleted successfully');
        
        // Clear session ID
        setCurrentSessionId(null);
        
        // Navigate back to the site
        navigate(`/programs/${programId}/sites/${siteId}`);
      } else {
        toast.error('Failed to delete submission');
      }
    } catch (error) {
      console.error('Error deleting submission:', error);
      toast.error(`Error deleting submission: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
      setShowDeleteModal(false);
    }
  };
  
  // Handle sharing the session
  const handleShareSession = () => {
    setIsShareModalOpen(true);
  };
  
  // Render function for petri form
  const renderPetriForm = (
    observation: PetriForms,
    index: number,
    onUpdate: (data: any) => void,
    onRemove: () => void,
    showRemoveButton: boolean,
    disabled: boolean
  ) => {
    // Create a new ref if it doesn't exist
    if (!petriFormRefs.current[observation.formId]) {
      petriFormRefs.current[observation.formId] = null;
    }
    
    return (
      <PetriForm
        id={`petri-form-${observation.formId}`}
        formId={observation.formId}
        index={index}
        siteId={siteId!}
        submissionSessionId={offlineSession.session?.session_id || ''}
        onUpdate={onUpdate}
        onRemove={onRemove}
        showRemoveButton={showRemoveButton}
        initialData={{
          petriCode: observation.petriCode,
          imageUrl: observation.imageUrl,
          tempImageKey: observation.tempImageKey,
          plantType: 'Other Fresh Perishable',
          fungicideUsed: observation.fungicideUsed as 'Yes' | 'No',
          surroundingWaterSchedule: observation.surroundingWaterSchedule,
          placement: observation.placement,
          placement_dynamics: observation.placement_dynamics,
          notes: observation.notes,
          outdoor_temperature: observation.outdoor_temperature,
          outdoor_humidity: observation.outdoor_humidity,
          observationId: observation.observationId
        }}
        ref={ref => petriFormRefs.current[observation.formId] = ref}
        disabled={!canEditSubmission || disabled}
        submissionOutdoorTemperature={submission?.temperature}
        submissionOutdoorHumidity={submission?.humidity}
        onSaveTrigger={handleSave} // Pass the save handler
      />
    );
  };
  
  // Render function for gasifier form
  const renderGasifierForm = (
    observation: GasifierForms,
    index: number,
    onUpdate: (data: any) => void,
    onRemove: () => void,
    showRemoveButton: boolean,
    disabled: boolean
  ) => {
    // Create a new ref if it doesn't exist
    if (!gasifierFormRefs.current[observation.formId]) {
      gasifierFormRefs.current[observation.formId] = null;
    }
    
    return (
      <GasifierForm
        id={`gasifier-form-${observation.formId}`}
        formId={observation.formId}
        index={index}
        siteId={siteId!}
        submissionSessionId={offlineSession.session?.session_id || ''}
        onUpdate={onUpdate}
        onRemove={onRemove}
        showRemoveButton={showRemoveButton}
        initialData={{
          gasifierCode: observation.gasifierCode,
          imageUrl: observation.imageUrl,
          tempImageKey: observation.tempImageKey,
          chemicalType: observation.chemicalType,
          measure: observation.measure,
          anomaly: observation.anomaly,
          placementHeight: observation.placementHeight,
          directionalPlacement: observation.directionalPlacement,
          placementStrategy: observation.placementStrategy,
          notes: observation.notes,
          outdoor_temperature: observation.outdoor_temperature,
          outdoor_humidity: observation.outdoor_humidity,
          observationId: observation.observationId
        }}
        ref={ref => gasifierFormRefs.current[observation.formId] = ref}
        disabled={!canEditSubmission || disabled}
        submissionOutdoorTemperature={submission?.temperature}
        submissionOutdoorHumidity={submission?.humidity}
        onSaveTrigger={handleSave} // Pass the save handler
      />
    );
  };

  // Return to submission list
  const handleBack = () => {
    // If form is dirty, show a confirmation dialog
    if (formDirty) {
      // Implement a confirmation dialog here
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        navigate(`/programs/${programId}/sites/${siteId}`);
      }
    } else {
      navigate(`/programs/${programId}/sites/${siteId}`);
    }
  };
  
  // Determine if session is in a state where form editing is allowed
  const isSessionEditable = offlineSession.session && 
    ['Opened', 'Working', 'Shared', 'Escalated'].includes(offlineSession.session.session_status);
  
  // Calculate progress percentages
  const validPetris = petriForms.filter(form => form.isValid).length;
  const validGasifiers = gasifierForms.filter(form => form.isValid).length;
  const totalObservations = expectedPetriCount + expectedGasifierCount;
  const validObservations = validPetris + validGasifiers;
  const progressPercentage = totalObservations > 0 
    ? Math.round((validObservations / totalObservations) * 100)
    : 0;
  
  if (loading || offlineSession.isLoading) {
    return <LoadingScreen />;
  }
  
  if (!offlineSession.session) {
    return (
      <div className="text-center py-12">
        <div className="bg-warning-50 border border-warning-200 p-4 rounded-md inline-block max-w-lg mx-auto">
          <h2 className="font-medium text-warning-800 text-lg mb-2">No Active Session Found</h2>
          <p className="text-warning-700 mb-4">
            There is no active session for this submission. It may have been completed, cancelled, or expired.
          </p>
          <Button
            variant="primary"
            onClick={() => navigate(`/programs/${programId}/sites/${siteId}`)}
          >
            Return to Site
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-0">
      {/* Sync status indicator */}
      {!isOnline && (
        <SyncStatus 
          status="offline" 
          message="Working offline. Your changes will be saved locally and synced when you're back online."
        />
      )}
      
      {/* Back button and title */}
      <div className="flex items-center mb-6">
        <button
          onClick={handleBack}
          className="mr-4 p-2 rounded-full hover:bg-gray-100"
          aria-label="Go back"
        >
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <div className="flex-grow">
          <h1 className="text-2xl font-bold text-gray-900">Edit Submission</h1>
          <p className="text-gray-600 mt-1">
            {siteData?.name} - {submission && format(new Date(submission.created_at), 'PPpp')}
          </p>
        </div>
        
        {/* Action buttons */}
        <div className="flex space-x-2">
          {canEditSubmission && isSessionEditable && (
            <>
              <Button
                variant="primary"
                onClick={() => handleSave(true)}
                icon={<Save size={16} />}
                isLoading={isSaving}
                disabled={isUpdating || !formDirty}
                testId="save-submission-button"
              >
                Save
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setShowCancelModal(true)}
                disabled={isUpdating}
                testId="cancel-submission-button"
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Session overview */}
      <SubmissionOverviewCard
        session={offlineSession.session}
        submissionCreatedAt={submission?.created_at}
        openedByUserEmail={openedByUserEmail}
        openedByUserName={openedByUserName}
        onShare={handleShareSession}
        canShare={canEditSubmission}
        petrisComplete={validPetris}
        petrisTotal={expectedPetriCount}
        gasifiersComplete={validGasifiers}
        gasifiersTotal={expectedGasifierCount}
      />
      
      {/* Submission Form */}
      {isSessionEditable ? (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">Submission Details</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Environmental Readings */}
              <div>
                <h3 className="text-md font-medium text-gray-700 mb-4">Environmental Readings</h3>
                <div className="space-y-4">
                  {/* Temperature */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-1">
                        Outdoor Temperature (°F)
                      </label>
                      <input
                        type="number"
                        id="temperature"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={temperature}
                        onChange={(e) => handleFieldChange('temperature', e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={!canEditSubmission || !isSessionEditable}
                        data-testid="temperature-input"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="humidity" className="block text-sm font-medium text-gray-700 mb-1">
                        Outdoor Humidity (%)
                      </label>
                      <input
                        type="number"
                        id="humidity"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={humidity}
                        onChange={(e) => handleFieldChange('humidity', e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={!canEditSubmission || !isSessionEditable}
                        data-testid="humidity-input"
                      />
                    </div>
                  </div>
                  
                  {/* Indoor Temperature and Humidity */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="indoorTemperature" className="block text-sm font-medium text-gray-700 mb-1">
                        Indoor Temperature (°F)
                      </label>
                      <input
                        type="number"
                        id="indoorTemperature"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={indoorTemperature}
                        onChange={(e) => handleFieldChange('indoorTemperature', e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={!canEditSubmission || !isSessionEditable}
                        data-testid="indoor-temperature-input"
                      />
                      <p className="mt-1 text-xs text-gray-500">Valid range: 32-120°F (optional)</p>
                    </div>
                    
                    <div>
                      <label htmlFor="indoorHumidity" className="block text-sm font-medium text-gray-700 mb-1">
                        Indoor Humidity (%)
                      </label>
                      <input
                        type="number"
                        id="indoorHumidity"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={indoorHumidity}
                        onChange={(e) => handleFieldChange('indoorHumidity', e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={!canEditSubmission || !isSessionEditable}
                        data-testid="indoor-humidity-input"
                      />
                      <p className="mt-1 text-xs text-gray-500">Valid range: 1-100% (optional)</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right Column - Conditions */}
              <div>
                <h3 className="text-md font-medium text-gray-700 mb-4">Conditions</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Airflow */}
                    <div>
                      <label htmlFor="airflow" className="block text-sm font-medium text-gray-700 mb-1">
                        Airflow
                      </label>
                      <select
                        id="airflow"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={airflow}
                        onChange={(e) => handleFieldChange('airflow', e.target.value as 'Open' | 'Closed')}
                        disabled={!canEditSubmission || !isSessionEditable}
                        data-testid="airflow-select"
                      >
                        <option value="Open">Open</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                    
                    {/* Odor Distance */}
                    <div>
                      <label htmlFor="odorDistance" className="block text-sm font-medium text-gray-700 mb-1">
                        Odor Distance
                      </label>
                      <select
                        id="odorDistance"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={odorDistance}
                        onChange={(e) => handleFieldChange('odorDistance', e.target.value as '5-10ft' | '10-25ft' | '25-50ft' | '50-100ft' | '>100ft')}
                        disabled={!canEditSubmission || !isSessionEditable}
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
                  
                  {/* Weather */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Weather
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleFieldChange('weather', 'Clear')}
                        className={`flex flex-col items-center p-3 rounded-md transition-colors ${
                          weather === 'Clear'
                            ? 'bg-yellow-100 border border-yellow-300 text-yellow-800'
                            : 'bg-gray-50 hover:bg-gray-100 border border-gray-300'
                        } ${!canEditSubmission || !isSessionEditable ? 'opacity-60 cursor-not-allowed' : ''}`}
                        disabled={!canEditSubmission || !isSessionEditable}
                        data-testid="weather-clear-button"
                      >
                        <span className="text-sm font-medium">Clear</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => handleFieldChange('weather', 'Cloudy')}
                        className={`flex flex-col items-center p-3 rounded-md transition-colors ${
                          weather === 'Cloudy'
                            ? 'bg-gray-700 border border-gray-800 text-white'
                            : 'bg-gray-50 hover:bg-gray-100 border border-gray-300'
                        } ${!canEditSubmission || !isSessionEditable ? 'opacity-60 cursor-not-allowed' : ''}`}
                        disabled={!canEditSubmission || !isSessionEditable}
                        data-testid="weather-cloudy-button"
                      >
                        <span className="text-sm font-medium">Cloudy</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => handleFieldChange('weather', 'Rain')}
                        className={`flex flex-col items-center p-3 rounded-md transition-colors ${
                          weather === 'Rain'
                            ? 'bg-blue-100 border border-blue-300 text-blue-800'
                            : 'bg-gray-50 hover:bg-gray-100 border border-gray-300'
                        } ${!canEditSubmission || !isSessionEditable ? 'opacity-60 cursor-not-allowed' : ''}`}
                        disabled={!canEditSubmission || !isSessionEditable}
                        data-testid="weather-rain-button"
                      >
                        <span className="text-sm font-medium">Rain</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Notes */}
            <div className="mt-6">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={2}
                value={notes}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                disabled={!canEditSubmission || !isSessionEditable}
                data-testid="notes-textarea"
              ></textarea>
              <p className="mt-1 text-xs text-gray-500 text-right">
                {notes.length}/255 characters
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">Submission Details</h2>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-md font-medium text-gray-700 mb-2">Environmental Readings</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Outdoor Temperature:</span>
                      <span className="font-medium">{temperature}°F</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Outdoor Humidity:</span>
                      <span className="font-medium">{humidity}%</span>
                    </div>
                    {indoorTemperature && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Indoor Temperature:</span>
                        <span className="font-medium">{indoorTemperature}°F</span>
                      </div>
                    )}
                    {indoorHumidity && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Indoor Humidity:</span>
                        <span className="font-medium">{indoorHumidity}%</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-md font-medium text-gray-700 mb-2">Conditions</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Airflow:</span>
                      <span className="font-medium">{airflow}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Odor Distance:</span>
                      <span className="font-medium">{odorDistance}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Weather:</span>
                      <span className="font-medium">{weather}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {notes && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-md font-medium text-gray-700 mb-2">Notes</h3>
                  <p className="text-gray-600">{notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Petri Observations */}
      <Card className="mb-6">
        <CardHeader 
          className="cursor-pointer"
          onClick={() => setIsPetriAccordionOpen(!isPetriAccordionOpen)}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold">Petri Observations</h2>
              <span className="pill bg-primary-100 text-primary-800">
                {validPetris}/{petriForms.length} complete
              </span>
            </div>
            {isPetriAccordionOpen ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ObservationListManager
            observations={petriForms}
            setObservations={setPetriForms}
            isAccordionOpen={isPetriAccordionOpen}
            setIsAccordionOpen={setIsPetriAccordionOpen}
            addButtonText="Add Petri Observation"
            templateWarningEntityType="Petri"
            onShowTemplateWarning={handleShowTemplateWarning}
            disabled={!canEditSubmission || !isSessionEditable}
            createEmptyObservation={createEmptyPetriForm}
            renderFormComponent={renderPetriForm}
            testId="petri-observations-manager"
          />
        </CardContent>
      </Card>

      {/* Gasifier Observations */}
      <Card className="mb-6">
        <CardHeader 
          className="cursor-pointer"
          onClick={() => setIsGasifierAccordionOpen(!isGasifierAccordionOpen)}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold">Gasifier Observations</h2>
              <span className="pill bg-accent-100 text-accent-800">
                {validGasifiers}/{gasifierForms.length} complete
              </span>
            </div>
            {isGasifierAccordionOpen ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ObservationListManager
            observations={gasifierForms}
            setObservations={setGasifierForms}
            isAccordionOpen={isGasifierAccordionOpen}
            setIsAccordionOpen={setIsGasifierAccordionOpen}
            addButtonText="Add Gasifier Observation"
            templateWarningEntityType="Gasifier"
            onShowTemplateWarning={handleShowTemplateWarning}
            disabled={!canEditSubmission || !isSessionEditable}
            createEmptyObservation={createEmptyGasifierForm}
            renderFormComponent={renderGasifierForm}
            testId="gasifier-observations-manager"
          />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {isSessionEditable && canEditSubmission && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-20 md:relative md:bg-transparent md:border-0 md:p-0 md:z-0">
          <div className="flex justify-between space-x-3 max-w-3xl mx-auto md:max-w-full">
            <Button 
              variant="outline"
              onClick={handleBack}
              icon={<X size={16} />}
              disabled={isUpdating}
              testId="back-button"
            >
              Back
            </Button>
            
            <div className="flex space-x-3">
              {offlineSession.session && offlineSession.session.session_status !== 'Completed' && (
                <>
                  <Button
                    variant={formDirty ? "primary" : "outline"}
                    onClick={() => handleSave(true)}
                    icon={<Save size={16} />}
                    isLoading={isSaving}
                    disabled={isUpdating || !formDirty}
                    testId="save-button"
                  >
                    Save
                  </Button>
                  
                  <Button
                    variant="primary"
                    onClick={handleComplete}
                    icon={<Check size={16} />}
                    isLoading={isUpdating && !isSaving}
                    disabled={isUpdating}
                    testId="complete-button"
                  >
                    Complete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal for Incomplete Submission */}
      <ConfirmSubmissionModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={proceedWithCompletion}
        currentPetriCount={petriForms.filter(form => form.isValid).length}
        currentGasifierCount={gasifierForms.filter(form => form.isValid).length}
        expectedPetriCount={expectedPetriCount}
        expectedGasifierCount={expectedGasifierCount}
        siteName={siteData?.name || ''}
      />
      
      {/* Cancel Modal */}
      <DeleteConfirmModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancel}
        title="Cancel Submission"
        message="Are you sure you want to cancel this submission? Any unsaved changes will be lost, and you will be returned to the site view."
        confirmText="Yes, Cancel"
        isLoading={isUpdating}
      />
      
      {/* Delete Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Submission"
        message={`Are you sure you want to delete this submission? This action cannot be undone and will permanently delete all observation data.`}
        confirmText="Delete Submission"
        isLoading={isUpdating}
      />
      
      {/* Template Warning Modal */}
      <TemplateWarningModal
        isOpen={showTemplateWarning}
        onClose={() => setShowTemplateWarning(false)}
        onConfirm={() => setShowTemplateWarning(false)}
        entityType={templateWarningType}
      />
      
      {/* Permission Modal */}
      <PermissionModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        message={permissionMessage}
      />
      
      {/* Session Share Modal */}
      {isShareModalOpen && offlineSession.session && (
        <SessionShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          sessionId={offlineSession.session.session_id}
          programId={programId!}
        />
      )}
      
      {/* Danger Zone: Delete Button */}
      {submission && canDeleteSubmission && (
        <Card className="mt-12">
          <CardHeader>
            <h2 className="text-lg font-semibold text-error-700">Danger Zone</h2>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-700">
              Permanently delete this submission and all associated observations. This action cannot be undone.
            </p>
            <Button
              variant="danger"
              onClick={() => setShowDeleteModal(true)}
              disabled={isUpdating}
              testId="delete-submission-button"
            >
              Delete Submission
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SubmissionEditPage;