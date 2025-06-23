import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { usePilotProgramStore } from '../stores/pilotProgramStore';
import { 
  ArrowLeft, 
  Save, 
  CheckCircle, 
  Share2, 
  AlertTriangle, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  Thermometer, 
  Droplets, 
  Wind, 
  Ruler, 
  Sun, 
  Cloud, 
  CloudRain, 
  FileText, 
  Calendar,  // Added Calendar import
  User
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Button from '../components/common/Button';
import Card, { CardHeader, CardContent } from '../components/common/Card';
import LoadingScreen from '../components/common/LoadingScreen';
import { useAuthStore } from '../stores/authStore';
import PetriForm, { PetriFormRef } from '../components/submissions/PetriForm';
import GasifierForm, { GasifierFormRef } from '../components/submissions/GasifierForm';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import TemplateWarningModal from '../components/submissions/TemplateWarningModal';
import ConfirmSubmissionModal from '../components/submissions/ConfirmSubmissionModal';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import offlineStorage from '../utils/offlineStorage';
import useOfflineSession from '../hooks/useOfflineSession';
import sessionManager from '../lib/sessionManager';
import { useSessionStore } from '../stores/sessionStore';
import useUserRole from '../hooks/useUserRole';
import PermissionModal from '../components/common/PermissionModal';
import SessionShareModal from '../components/submissions/SessionShareModal';
import SubmissionOverviewCard from '../components/submissions/SubmissionOverviewCard';
import { useSubmissions } from '../hooks/useSubmissions';
import { createLogger } from '../../utils/logger';

// Create a component-specific logger
const logger = createLogger('SubmissionEditPage');

const SubmissionEditPage = () => {
  const { programId, siteId, submissionId } = useParams<{ programId: string; siteId: string; submissionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    selectedProgram, 
    selectedSite,
    setSelectedProgram,
    setSelectedSite
  } = usePilotProgramStore();
  const { setCurrentSessionId } = useSessionStore();
  
  // Add the useSubmissions hook to get access to updateSubmission function
  const { updateSubmission, loading: submissionLoading } = useSubmissions(siteId);
  
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<any>(null);
  const [petriObservations, setPetriObservations] = useState<any[]>([]);
  const [gasifierObservations, setGasifierObservations] = useState<any[]>([]);
  
  // Updated type definition to include tempImageKey
  const [petriForms, setPetriForms] = useState<{ 
    id: string; 
    ref: React.RefObject<PetriFormRef>; 
    isValid: boolean; 
    isDirty: boolean; 
    observationId?: string;
    tempImageKey?: string; 
  }[]>([]);
  
  // Updated type definition to include tempImageKey
  const [gasifierForms, setGasifierForms] = useState<{ 
    id: string; 
    ref: React.RefObject<GasifierFormRef>; 
    isValid: boolean; 
    isDirty: boolean; 
    observationId?: string;
    tempImageKey?: string;
  }[]>([]);
  
  // Add state variables to store complete form data objects
  const [petriObservationData, setPetriObservationData] = useState<{[key: string]: any}>({});
  const [gasifierObservationData, setGasifierObservationData] = useState<{[key: string]: any}>({});
  
  const [isPetriAccordionOpen, setIsPetriAccordionOpen] = useState(true);
  const [isGasifierAccordionOpen, setIsGasifierAccordionOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showTemplateWarning, setShowTemplateWarning] = useState<'Petri' | 'Gasifier' | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Session state
  const [session, setSession] = useState<any>(null);
  const [expectedPetriCount, setExpectedPetriCount] = useState(0);
  const [expectedGasifierCount, setExpectedGasifierCount] = useState(0);
  const [completedPetriCount, setCompletedPetriCount] = useState(0);
  const [completedGasifierCount, setCompletedGasifierCount] = useState(0);
  const [isSessionExpiring, setIsSessionExpiring] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Add state for creator information
  const [creatorEmail, setCreatorEmail] = useState<string | undefined>(undefined);
  const [creatorName, setCreatorName] = useState<string | undefined>(undefined);
  
  const { canEditSubmission } = useUserRole({ programId });
  const isOnline = useOnlineStatus();
  
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use the offline session hook to load and manage session data
  const { 
    session: offlineSession, 
    saveSession, 
    isLoading: offlineLoading,
    error: offlineError,
    isOnline: isNetworkOnline
  } = useOfflineSession({
    sessionId: session?.session_id,
    submissionId
  });

  // Load submission, observations, and session data
  useEffect(() => {
    const loadSubmissionData = async () => {
      if (!programId || !siteId || !submissionId) return;
      
      setLoading(true);
      
      try {
        // Fetch submission with session data
        const { submission: submissionData, session: sessionData, creator } = 
          await sessionManager.getSubmissionWithSession(submissionId);
        
        if (!submissionData) {
          toast.error('Submission not found');
          navigate(`/programs/${programId}/sites/${siteId}`);
          return;
        }
        
        setSubmission(submissionData);
        setSession(sessionData);
        
        // Store creator information if available
        if (creator) {
          setCreatorEmail(creator.email);
          setCreatorName(creator.full_name);
        }
        
        // If we have a session, set it in the session store
        if (sessionData) {
          setCurrentSessionId(sessionData.session_id);
        }
        
        // Update title in browser
        document.title = `Submission #${submissionData.global_submission_id || ''} - GRMTek Sporeless`;
        
        // Fetch petri observations
        const { data: petriData, error: petriError } = await supabase
          .from('petri_observations')
          .select('*')
          .eq('submission_id', submissionId);
          
        if (petriError) throw petriError;
        
        // Fetch gasifier observations
        const { data: gasifierData, error: gasifierError } = await supabase
          .from('gasifier_observations')
          .select('*')
          .eq('submission_id', submissionId);
          
        if (gasifierError) throw gasifierError;
        
        setPetriObservations(petriData || []);
        setGasifierObservations(gasifierData || []);
        
        // Get all temporary images from IndexedDB to match with observations
        const tempImageKeys = await offlineStorage.listTempImageKeys();
        const submissionPrefix = sessionData?.session_id || submissionId;
        
        console.log(`Looking for temp images with prefix: ${submissionPrefix}`);
        
        // Initialize petri form refs with temp image keys if available
        const petriFormRefs = (petriData || []).map(obs => {
          // Find any matching temp image key for this observation
          const matchingKey = tempImageKeys.find(key => 
            key.startsWith(submissionPrefix) && key.includes(obs.observation_id)
          );
          
          if (matchingKey) {
            console.log(`Found matching temp image key for petri observation ${obs.observation_id}: ${matchingKey}`);
          }
          
          const formRef = React.createRef<PetriFormRef>();
          return { 
            id: obs.observation_id, 
            ref: formRef, 
            isValid: !!obs.image_url || !!matchingKey,
            isDirty: false,
            observationId: obs.observation_id,
            tempImageKey: matchingKey
          };
        });
        setPetriForms(petriFormRefs);
        setCompletedPetriCount(petriFormRefs.filter(form => form.isValid).length);
        
        // Initialize gasifier form refs with temp image keys if available
        const gasifierFormRefs = (gasifierData || []).map(obs => {
          // Find any matching temp image key for this observation
          const matchingKey = tempImageKeys.find(key => 
            key.startsWith(submissionPrefix) && key.includes(obs.observation_id)
          );
          
          if (matchingKey) {
            console.log(`Found matching temp image key for gasifier observation ${obs.observation_id}: ${matchingKey}`);
          }
          
          const formRef = React.createRef<GasifierFormRef>();
          return { 
            id: obs.observation_id, 
            ref: formRef, 
            isValid: !!obs.image_url || !!matchingKey,
            isDirty: false,
            observationId: obs.observation_id,
            tempImageKey: matchingKey
          };
        });
        setGasifierForms(gasifierFormRefs);
        setCompletedGasifierCount(gasifierFormRefs.filter(form => form.isValid).length);
        
        // Initialize petriObservationData state with temp image keys
        const initialPetriData: {[key: string]: any} = {};
        petriFormRefs.forEach((form, index) => {
          const observation = petriData?.find(obs => obs.observation_id === form.id);
          if (observation) {
            initialPetriData[form.id] = {
              formId: form.id,
              petriCode: observation.petri_code,
              imageFile: null,
              imageUrl: observation.image_url,
              tempImageKey: form.tempImageKey,
              plantType: observation.plant_type,
              fungicideUsed: observation.fungicide_used,
              surroundingWaterSchedule: observation.surrounding_water_schedule,
              notes: observation.notes || '',
              placement: observation.placement,
              placement_dynamics: observation.placement_dynamics,
              observationId: observation.observation_id,
              isValid: !!observation.image_url || !!form.tempImageKey,
              hasData: true,
              hasImage: !!observation.image_url || !!form.tempImageKey,
              isDirty: false,
              outdoor_temperature: observation.outdoor_temperature,
              outdoor_humidity: observation.outdoor_humidity
            };
          }
        });
        setPetriObservationData(initialPetriData);
        
        // Initialize gasifierObservationData state with temp image keys
        const initialGasifierData: {[key: string]: any} = {};
        gasifierFormRefs.forEach((form, index) => {
          const observation = gasifierData?.find(obs => obs.observation_id === form.id);
          if (observation) {
            initialGasifierData[form.id] = {
              formId: form.id,
              gasifierCode: observation.gasifier_code,
              imageFile: null,
              imageUrl: observation.image_url,
              tempImageKey: form.tempImageKey,
              chemicalType: observation.chemical_type,
              measure: observation.measure,
              anomaly: observation.anomaly,
              placementHeight: observation.placement_height,
              directionalPlacement: observation.directional_placement,
              placementStrategy: observation.placement_strategy,
              notes: observation.notes || '',
              observationId: observation.observation_id,
              isValid: !!observation.image_url || !!form.tempImageKey,
              hasData: true,
              hasImage: !!observation.image_url || !!form.tempImageKey,
              isDirty: false,
              outdoor_temperature: observation.outdoor_temperature,
              outdoor_humidity: observation.outdoor_humidity
            };
          }
        });
        setGasifierObservationData(initialGasifierData);
        
        // Get expected counts from site defaults
        if (!selectedSite) {
          // Load site data
          const { data: siteData, error: siteError } = await supabase
            .from('sites')
            .select('*')
            .eq('site_id', siteId)
            .single();
            
          if (siteError) throw siteError;
          
          setSelectedSite(siteData);
          
          setExpectedPetriCount(
            siteData?.petri_defaults 
              ? (Array.isArray(siteData.petri_defaults) ? siteData.petri_defaults.length : 0) 
              : 0
          );
          
          setExpectedGasifierCount(
            siteData?.gasifier_defaults 
              ? (Array.isArray(siteData.gasifier_defaults) ? siteData.gasifier_defaults.length : 0) 
              : 0
          );
        } else {
          setExpectedPetriCount(
            selectedSite.petri_defaults 
              ? (Array.isArray(selectedSite.petri_defaults) ? selectedSite.petri_defaults.length : 0) 
              : 0
          );
          
          setExpectedGasifierCount(
            selectedSite.gasifier_defaults 
              ? (Array.isArray(selectedSite.gasifier_defaults) ? selectedSite.gasifier_defaults.length : 0) 
              : 0
          );
        }
      } catch (error) {
        console.error('Error loading submission data:', error);
        toast.error('Failed to load submission data');
      } finally {
        setLoading(false);
      }
    };

    loadSubmissionData();
  }, [programId, siteId, submissionId, selectedSite, navigate, setCurrentSessionId]);
  
  // Add a petri form
  const addPetriForm = () => {
    const newFormId = uuidv4();
    const formRef = React.createRef<PetriFormRef>();
    setPetriForms([...petriForms, { id: newFormId, ref: formRef, isValid: false, isDirty: true }]);
    
    // If there are petri defaults in the site, show a warning
    if (selectedSite?.petri_defaults && Array.isArray(selectedSite.petri_defaults) && selectedSite.petri_defaults.length > 0) {
      setShowTemplateWarning('Petri');
    }
  };
  
  // Remove a petri form
  const removePetriForm = (id: string) => {
    setPetriForms(petriForms.filter(form => form.id !== id));
    
    // Remove the form data from petriObservationData
    const updatedData = { ...petriObservationData };
    delete updatedData[id];
    setPetriObservationData(updatedData);
  };
  
  // Add a gasifier form
  const addGasifierForm = () => {
    const newFormId = uuidv4();
    const formRef = React.createRef<GasifierFormRef>();
    setGasifierForms([...gasifierForms, { id: newFormId, ref: formRef, isValid: false, isDirty: true }]);
    
    // If there are gasifier defaults in the site, show a warning
    if (selectedSite?.gasifier_defaults && Array.isArray(selectedSite.gasifier_defaults) && selectedSite.gasifier_defaults.length > 0) {
      setShowTemplateWarning('Gasifier');
    }
  };
  
  // Remove a gasifier form
  const removeGasifierForm = (id: string) => {
    setGasifierForms(gasifierForms.filter(form => form.id !== id));
    
    // Remove the form data from gasifierObservationData
    const updatedData = { ...gasifierObservationData };
    delete updatedData[id];
    setGasifierObservationData(updatedData);
  };

// Stabilized callback for PetriForm updates
  const handlePetriFormUpdate = useCallback((formId: string, data: any) => {
    // Store complete data in petriObservationData
    setPetriObservationData(prevData => ({
      ...prevData,
      [formId]: {
        ...data,
        formId: formId
      }
    }));
    
    // Update form validation state
    setPetriForms(prevForms => 
      prevForms.map(f => 
        f.id === formId 
          ? { ...f, isValid: data.isValid, isDirty: data.isDirty || f.isDirty } 
          : f
      )
    );
    
    logger.debug(`Petri form ${formId} updated with data:`, { 
      petriCode: data.petriCode,
      hasImageFile: !!data.imageFile,
      tempImageKey: data.tempImageKey,
      isValid: data.isValid,
      isDirty: data.isDirty,
      hasImage: data.hasImage
    });
  }, [setPetriObservationData, setPetriForms, petriForms]); // Added petriForms to dependencies

  // Stabilized callback for GasifierForm updates
  const handleGasifierFormUpdate = useCallback((formId: string, data: any) => {
    // Store complete data in gasifierObservationData
    setGasifierObservationData(prevData => ({
      ...prevData,
      [formId]: {
        ...data,
        formId: formId
      }
    }));
    
    // Update form validation state
    setGasifierForms(prevForms => 
      prevForms.map(f => 
        f.id === formId 
          ? { ...f, isValid: data.isValid, isDirty: data.isDirty || f.isDirty } 
          : f
      )
    );
    
    logger.debug(`Gasifier form ${formId} updated with data:`, { 
      gasifierCode: data.gasifierCode,
      hasImageFile: !!data.imageFile,
      tempImageKey: data.tempImageKey,
      isValid: data.isValid,
      isDirty: data.isDirty,
      hasImage: data.hasImage
    });
  }, [setGasifierObservationData, setGasifierForms, gasifierForms]); // Added gasifierForms to dependencies
  
  
  /* Updated to preserve tempImageKey
  const handlePetriUpdate = (formId: string, data: any) => {
    console.log(`Petri form ${formId} updated with data:`, { 
      petriCode: data.petriCode, 
      hasImageFile: !!data.imageFile, 
      tempImageKey: data.tempImageKey,
      isValid: data.isValid,
      isDirty: data.isDirty,
      hasImage: data.hasImage
    });
    
    // Store complete data in petriObservationData
    setPetriObservationData(prevData => ({
      ...prevData,
      [formId]: {
        ...data,
        formId
      }
    }));
    
    // Update form validation state and tempImageKey
    setPetriForms(prevForms => 
      prevForms.map(f => 
        f.id === formId 
          ? { 
              ...f, 
              isValid: data.isValid, 
              isDirty: data.isDirty || f.isDirty,
              tempImageKey: data.tempImageKey  // Store tempImageKey in form state
            } 
          : f
      )
    );
  };
  
  // Updated to preserve tempImageKey
  const handleGasifierUpdate = (formId: string, data: any) => {
    console.log(`Gasifier form ${formId} updated with data:`, { 
      gasifierCode: data.gasifierCode, 
      hasImageFile: !!data.imageFile, 
      tempImageKey: data.tempImageKey,
      isValid: data.isValid,
      isDirty: data.isDirty,
      hasImage: data.hasImage
    });
    
    // Store complete data in gasifierObservationData
    setGasifierObservationData(prevData => ({
      ...prevData,
      [formId]: {
        ...data,
        formId
      }
    }));
    
    // Update form validation state and tempImageKey
    setGasifierForms(prevForms => 
      prevForms.map(f => 
        f.id === formId 
          ? { 
              ...f, 
              isValid: data.isValid, 
              isDirty: data.isDirty || f.isDirty,
              tempImageKey: data.tempImageKey  // Store tempImageKey in form state
            } 
          : f
      )
    );
  };
  
  */
  //Handle form submission
  const handleSave = async () => {
    if (!programId || !siteId || !submissionId) return;
    
    setIsSaving(true);
    
    try {
      // Use the observation data from the state variables
      // Get data from petri forms
      const validPetriData = Object.values(petriObservationData)
        .filter(data => data.hasData || data.observationId) // Only include forms with data or existing observations
        .map(data => ({
          petriCode: data.petriCode,
          imageFile: data.imageFile,
          imageUrl: data.imageUrl,
          tempImageKey: data.tempImageKey, // Include tempImageKey
          plantType: data.plantType || 'Other Fresh Perishable',
          fungicideUsed: data.fungicideUsed,
          surroundingWaterSchedule: data.surroundingWaterSchedule,
          notes: data.notes,
          placement: data.placement,
          placement_dynamics: data.placement_dynamics,
          observationId: data.observationId,
          isValid: data.isValid,
          outdoor_temperature: data.outdoor_temperature,
          outdoor_humidity: data.outdoor_humidity,
          formId: data.formId
        }));
      
      // Get data from gasifier forms
      const validGasifierData = Object.values(gasifierObservationData)
        .filter(data => data.hasData || data.observationId) // Only include forms with data or existing observations
        .map(data => ({
          gasifierCode: data.gasifierCode,
          imageFile: data.imageFile,
          imageUrl: data.imageUrl,
          tempImageKey: data.tempImageKey, // Include tempImageKey
          chemicalType: data.chemicalType,
          measure: data.measure,
          anomaly: data.anomaly,
          notes: data.notes,
          placementHeight: data.placementHeight,
          directionalPlacement: data.directionalPlacement,
          placementStrategy: data.placementStrategy,
          observationId: data.observationId,
          isValid: data.isValid,
          outdoor_temperature: data.outdoor_temperature,
          outdoor_humidity: data.outdoor_humidity,
          formId: data.formId
        }));
      
      // If online, update the submission using the hook function
      if (isOnline) {
        const result = await updateSubmission(
          submissionId,
          submission.temperature,
          submission.humidity,
          submission.airflow,
          submission.odor_distance,
          submission.weather,
          submission.notes,
          validPetriData,
          validGasifierData,
          undefined,
          submission.indoor_temperature,
          submission.indoor_humidity
        );
        
        if (!result) {
          throw new Error("Failed to update submission");
        }
        
        // Update the session activity time
        if (session?.session_id) {
          await sessionManager.updateSessionActivity(session.session_id);
        }
        
        // Update observation IDs if they were created/changed during save
        if (result.updatedPetriObservations) {
          const petriIdMap = new Map(result.updatedPetriObservations.map(p => [p.clientId, p.observationId]));
          
          // Update the observation IDs in petriObservationData
          const updatedPetriData = { ...petriObservationData };
          for (const [clientId, observationId] of petriIdMap.entries()) {
            if (updatedPetriData[clientId]) {
              updatedPetriData[clientId] = {
                ...updatedPetriData[clientId],
                observationId,
                isDirty: false
              };
            }
          }
          setPetriObservationData(updatedPetriData);
        }
        
        if (result.updatedGasifierObservations) {
          const gasifierIdMap = new Map(result.updatedGasifierObservations.map(g => [g.clientId, g.observationId]));
          
          // Update the observation IDs in gasifierObservationData
          const updatedGasifierData = { ...gasifierObservationData };
          for (const [clientId, observationId] of gasifierIdMap.entries()) {
            if (updatedGasifierData[clientId]) {
              updatedGasifierData[clientId] = {
                ...updatedGasifierData[clientId],
                observationId,
                isDirty: false
              };
            }
          }
          setGasifierObservationData(updatedGasifierData);
        }
        
        // Reset dirty flags for all forms
        petriForms.forEach(form => {
          if (form.ref.current?.resetDirty) {
            form.ref.current.resetDirty();
          }
        });
        
        gasifierForms.forEach(form => {
          if (form.ref.current?.resetDirty) {
            form.ref.current.resetDirty();
          }
        });
        
        // Update form state to reflect dirty flag reset
        setPetriForms(forms => forms.map(form => ({...form, isDirty: false})));
        setGasifierForms(forms => forms.map(form => ({...form, isDirty: false})));
        
        toast.success('Submission saved successfully');
      } else {
        // If offline, store the changes locally
        await offlineStorage.saveSubmissionOffline(
          submission,
          validPetriData,
          validGasifierData
        );
        
        toast.info('Changes saved locally and will sync when online');
      }
    } catch (error) {
      console.error('Error saving submission:', error);
      toast.error('Failed to save submission');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle form completion (marking as done)
  const handleComplete = async () => {
    // First, check if any forms are dirty and save if needed
    const hasDirtyForms = 
      petriForms.some(form => form.isDirty) ||
      gasifierForms.some(form => form.isDirty);
    
    if (hasDirtyForms) {
      const confirmed = window.confirm('You have unsaved changes. Save them before completing?');
      if (confirmed) {
        await handleSave();
      }
    }
    
    // Now check if we have the expected number of observations
    const validPetriCount = petriForms.filter(f => f.isValid).length;
    const validGasifierCount = gasifierForms.filter(f => f.isValid).length;
    
    const hasMissingObservations = 
      (expectedPetriCount > 0 && validPetriCount < expectedPetriCount) ||
      (expectedGasifierCount > 0 && validGasifierCount < expectedGasifierCount);
    
    if (hasMissingObservations) {
      // Show confirmation modal
      setShowConfirmModal(true);
      return;
    }
    
    // If all observations are present or confirmed, complete the session
    await completeSession();
  };
  
  // Complete the session
  const completeSession = async () => {
    if (!session?.session_id) {
      toast.error('No active session to complete');
      return;
    }
    
    setIsSaving(true);
    
    try {
      const result = await sessionManager.completeSubmissionSession(session.session_id);
      
      if (result.success) {
        toast.success('Submission completed successfully!');
        // Update session data
        setSession(result.session);
        // Navigate back to submissions list
        navigate(`/programs/${programId}/sites/${siteId}`);
      } else {
        throw new Error(result.message || 'Failed to complete session');
      }
    } catch (error) {
      console.error('Error completing session:', error);
      toast.error('Failed to complete submission');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle cancelling the submission
  const handleCancel = async () => {
    if (!session?.session_id) {
      navigate(`/programs/${programId}/sites/${siteId}`);
      return;
    }
    
    const confirmed = window.confirm(
      'Are you sure you want to cancel this submission? All changes will be lost and the submission will be deleted.'
    );
    
    if (!confirmed) return;
    
    setIsSaving(true);
    
    try {
      const { success, message } = await sessionManager.cancelSubmissionSession(session.session_id);
      
      if (success) {
        toast.success('Submission cancelled');
        // Navigate back to submissions list
        navigate(`/programs/${programId}/sites/${siteId}`);
      } else {
        throw new Error(message || 'Failed to cancel session');
      }
    } catch (error) {
      console.error('Error cancelling session:', error);
      toast.error('Failed to cancel submission');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle sharing the submission
  const handleShare = async () => {
    if (!canEditSubmission) {
      setPermissionMessage("You don't have permission to share this submission with others.");
      setShowPermissionModal(true);
      return;
    }
    
    // Show sharing modal
    setShowShareModal(true);
  };
  
  // Update completed petri count
  useEffect(() => {
    const completedCount = petriForms.filter(form => form.isValid).length;
    setCompletedPetriCount(completedCount);
  }, [petriForms]);
  
  // Update completed gasifier count
  useEffect(() => {
    const completedCount = gasifierForms.filter(form => form.isValid).length;
    setCompletedGasifierCount(completedCount);
  }, [gasifierForms]);

  // Handle session expiration checking
  useEffect(() => {
    const checkSessionExpiration = () => {
      if (!session?.session_start_time) return;
      
      const sessionStart = new Date(session.session_start_time);
      const expirationTime = new Date(sessionStart);
      expirationTime.setHours(23, 59, 59, 999);
      
      const now = new Date();
      const hoursRemaining = (expirationTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      setIsSessionExpiring(hoursRemaining <= 1 && hoursRemaining > 0);
      setIsSessionExpired(now > expirationTime);
    };
    
    // Check immediately
    checkSessionExpiration();
    
    // Set up timer to check every minute
    sessionTimerRef.current = setInterval(checkSessionExpiration, 60 * 1000);
    
    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    };
  }, [session]);

  // Log temp images for debugging
  useEffect(() => {
    const logTempImages = async () => {
      if (!submissionId) return;
      
      try {
        console.log('Checking for temp images in IndexedDB...');
        const tempImageKeys = await offlineStorage.listTempImageKeys();
        const submissionPrefix = session?.session_id || submissionId;
        
        const matchingKeys = tempImageKeys.filter(key => 
          key.includes(submissionPrefix)
        );
        
        console.log(`Found ${matchingKeys.length} temp images for submission ${submissionId}:`, matchingKeys);
      } catch (error) {
        console.error('Error checking temp images:', error);
      }
    };
    
    logTempImages();
  }, [submissionId, session]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!submission) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Submission not found</p>
        <Button
          variant="primary"
          className="mt-4"
          onClick={() => navigate(`/programs/${programId}/sites/${siteId}`)}
        >
          Go Back
        </Button>
      </div>
    );
  }

  // Check if session is in a state where editing is not allowed
  const isSessionReadOnly = 
    session && ['Completed', 'Cancelled', 'Expired', 'Expired-Complete', 'Expired-Incomplete'].includes(session.session_status);

  // Helper function to render the weather icon based on the weather value
  const renderWeatherIcon = (weather: string) => {
    switch(weather.toLowerCase()) {
      case 'clear':
        return <Sun className="text-yellow-500 mr-2" size={18} />;
      case 'cloudy':
        return <Cloud className="text-gray-500 mr-2" size={18} />;
      case 'rain':
        return <CloudRain className="text-blue-500 mr-2" size={18} />;
      default:
        return <Sun className="text-yellow-500 mr-2" size={18} />;
    }
  };

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
        <div className="flex-grow">
          <h1 className="text-2xl font-bold text-gray-900">
            {submission.global_submission_id 
              ? `Submission #${submission.global_submission_id}` 
              : 'Edit Submission'}
          </h1>
          <p className="text-gray-600 mt-1">
            {selectedSite?.name} - {format(new Date(submission.created_at), 'PPp')}
          </p>
        </div>
        
        <div className="hidden md:flex space-x-2">
          {!isSessionReadOnly && (
            <>
              <Button
                variant="outline"
                onClick={handleShare}
                icon={<Share2 size={16} />}
                testId="share-submission-button"
              >
                Share
              </Button>
              
              <Button
                variant="outline"
                onClick={handleSave}
                isLoading={isSaving}
                disabled={!canEditSubmission}
                icon={<Save size={16} />}
                testId="save-submission-button"
              >
                Save
              </Button>
              
              <Button
                variant="primary"
                onClick={handleComplete}
                isLoading={isSaving}
                disabled={
                  !canEditSubmission ||
                  completedPetriCount < petriObservations.length ||
                  completedGasifierCount < gasifierObservations.length
                }
                icon={<CheckCircle size={16} />}
                testId="complete-submission-button"
              >
                Complete
              </Button>
            </>
          )}
          
          {isSessionReadOnly && (
            <Button
              variant="outline"
              onClick={() => navigate(`/programs/${programId}/sites/${siteId}`)}
              icon={<ArrowLeft size={16} />}
            >
              Back to Submissions
            </Button>
          )}
        </div>
      </div>
      
      {isSessionExpired && !isSessionReadOnly && (
        <div className="bg-error-50 border-l-4 border-error-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-error-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-error-800">Session Expired</h3>
              <div className="mt-2 text-sm text-error-700">
                <p>
                  This session has expired. You must complete your submission before midnight on the day it was started.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {isSessionExpiring && !isSessionReadOnly && (
        <div className="bg-warning-50 border-l-4 border-warning-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-warning-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-warning-800">Session Expiring Soon</h3>
              <div className="mt-2 text-sm text-warning-700">
                <p>
                  This session will expire at midnight tonight. Please complete your submission before then.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Combined Submission Overview Card - Session details & progress */}
      <SubmissionOverviewCard
        session={session}
        submissionCreatedAt={submission?.created_at}
        openedByUserEmail={creatorEmail}
        openedByUserName={creatorName}
        onShare={handleShare}
        canShare={canEditSubmission && !isSessionReadOnly}
        petrisComplete={completedPetriCount}
        petrisTotal={petriObservations.length}
        gasifiersComplete={completedGasifierCount}
        gasifiersTotal={gasifierObservations.length}
      />

      {/* Two-column layout for Petri and Gasifier observations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Petri Observations */}
        <Card>
          <CardHeader className="flex justify-between items-center cursor-pointer" onClick={() => setIsPetriAccordionOpen(!isPetriAccordionOpen)}>
            <h2 className="font-medium">Petri Observations</h2>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">{completedPetriCount}/{petriObservations.length} Complete</span>
              {isPetriAccordionOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </CardHeader>
          {isPetriAccordionOpen && (
            <CardContent>
              <div className="space-y-4">
                {petriForms.map((form, index) => {
                  // Find the petri observation data
                  const initialData = petriObservations.find(obs => obs.observation_id === form.id) 
                    ? {
                        petriCode: petriObservations.find(obs => obs.observation_id === form.id).petri_code,
                        imageUrl: petriObservations.find(obs => obs.observation_id === form.id).image_url,
                        tempImageKey: form.tempImageKey, // Pass tempImageKey from form state
                        plantType: petriObservations.find(obs => obs.observation_id === form.id).plant_type,
                        fungicideUsed: petriObservations.find(obs => obs.observation_id === form.id).fungicide_used,
                        surroundingWaterSchedule: petriObservations.find(obs => obs.observation_id === form.id).surrounding_water_schedule,
                        notes: petriObservations.find(obs => obs.observation_id === form.id).notes || '',
                        placement: petriObservations.find(obs => obs.observation_id === form.id).placement,
                        placement_dynamics: petriObservations.find(obs => obs.observation_id === form.id).placement_dynamics,
                        observationId: petriObservations.find(obs => obs.observation_id === form.id).observation_id,
                        outdoor_temperature: petriObservations.find(obs => obs.observation_id === form.id).outdoor_temperature,
                        outdoor_humidity: petriObservations.find(obs => obs.observation_id === form.id).outdoor_humidity
                      } 
                    : undefined;
                  
                  console.log(`Rendering PetriForm ${form.id} with tempImageKey: ${form.tempImageKey}`);
                  
                  return (
                    <PetriForm
                      key={form.id}
                      id={`petri-form-${form.id}`}
                      formId={form.id}
                      index={index + 1}
                      siteId={siteId!}
                      submissionSessionId={session?.session_id || submissionId!}
                      ref={form.ref}
                      onUpdate={(data) => handlePetriFormUpdate(form.id, data)}
                      onRemove={() => removePetriForm(form.id)}
                      showRemoveButton={petriForms.length > 1}
                      initialData={initialData}
                      disabled={isSessionReadOnly}
                      observationId={form.observationId}
                    />
                  );
                })}
                
                {!isSessionReadOnly && (
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="outline"
                      onClick={addPetriForm}
                      disabled={isSaving}
                      testId="add-petri-form-button"
                    >
                      Add Petri Sample
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
        
        {/* Gasifier Observations */}
        <Card>
          <CardHeader className="flex justify-between items-center cursor-pointer" onClick={() => setIsGasifierAccordionOpen(!isGasifierAccordionOpen)}>
            <h2 className="font-medium">Gasifier Observations</h2>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">{completedGasifierCount}/{gasifierObservations.length} Complete</span>
              {isGasifierAccordionOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </CardHeader>
          {isGasifierAccordionOpen && (
           <CardContent>
              <div className="space-y-4">
                {gasifierForms.map((form, index) => (
                  <GasifierForm
                    key={form.id}
                    id={`gasifier-form-${form.id}`}
                    formId={form.id}
                    index={index + 1}
                    siteId={siteId!}
                    submissionSessionId={session?.session_id || submissionId!}
                    ref={form.ref}
                    onUpdate={(data) => handleGasifierFormUpdate(form.id, data)}
                    onRemove={() => removeGasifierForm(form.id)}
                    showRemoveButton={gasifierForms.length > 1}
                    initialData={gasifierObservations.find(obs => obs.observation_id === form.id) ? {
                      gasifierCode: gasifierObservations.find(obs => obs.observation_id === form.id).gasifier_code,
                      imageUrl: gasifierObservations.find(obs => obs.observation_id === form.id).image_url,
                      chemicalType: gasifierObservations.find(obs => obs.observation_id === form.id).chemical_type,
                      measure: gasifierObservations.find(obs => obs.observation_id === form.id).measure,
                      anomaly: gasifierObservations.find(obs => obs.observation_id === form.id).anomaly,
                      placementHeight: gasifierObservations.find(obs => obs.observation_id === form.id).placement_height,
                      directionalPlacement: gasifierObservations.find(obs => obs.observation_id === form.id).directional_placement,
                      placementStrategy: gasifierObservations.find(obs => obs.observation_id === form.id).placement_strategy,
                      notes: gasifierObservations.find(obs => obs.observation_id === form.id).notes || '',
                      observationId: gasifierObservations.find(obs => obs.observation_id === form.id).observation_id,
                      outdoor_temperature: gasifierObservations.find(obs => obs.observation_id === form.id).outdoor_temperature,
                      outdoor_humidity: gasifierObservations.find(obs => obs.observation_id === form.id).outdoor_humidity
                    } : undefined}
                    disabled={isSessionReadOnly}
                    observationId={form.observationId}
                  />
                ))}
                
                {!isSessionReadOnly && (
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="outline"
                      onClick={addGasifierForm}
                      disabled={isSaving}
                      testId="add-gasifier-form-button"
                    >
                      Add Gasifier Sample
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
      
      
          /* //This is Old  
          <CardContent>
              <div className="space-y-4">
                {gasifierForms.map((form, index) => {
                  // Find the gasifier observation data
                  const initialData = gasifierObservations.find(obs => obs.observation_id === form.id) 
                    ? {
                        gasifierCode: gasifierObservations.find(obs => obs.observation_id === form.id).gasifier_code,
                        imageUrl: gasifierObservations.find(obs => obs.observation_id === form.id).image_url,
                        tempImageKey: form.tempImageKey, // Pass tempImageKey from form state
                        chemicalType: gasifierObservations.find(obs => obs.observation_id === form.id).chemical_type,
                        measure: gasifierObservations.find(obs => obs.observation_id === form.id).measure,
                        anomaly: gasifierObservations.find(obs => obs.observation_id === form.id).anomaly,
                        placementHeight: gasifierObservations.find(obs => obs.observation_id === form.id).placement_height,
                        directionalPlacement: gasifierObservations.find(obs => obs.observation_id === form.id).directional_placement,
                        placementStrategy: gasifierObservations.find(obs => obs.observation_id === form.id).placement_strategy,
                        notes: gasifierObservations.find(obs => obs.observation_id === form.id).notes || '',
                        observationId: gasifierObservations.find(obs => obs.observation_id === form.id).observation_id,
                        outdoor_temperature: gasifierObservations.find(obs => obs.observation_id === form.id).outdoor_temperature,
                        outdoor_humidity: gasifierObservations.find(obs => obs.observation_id === form.id).outdoor_humidity
                      } 
                    : undefined;
                  
                  console.log(`Rendering GasifierForm ${form.id} with tempImageKey: ${form.tempImageKey}`);
                  
                  return (
                    <GasifierForm
                      key={form.id}
                      id={`gasifier-form-${form.id}`}
                      formId={form.id}
                      index={index + 1}
                      siteId={siteId!}
                      submissionSessionId={session?.session_id || submissionId!}
                      ref={form.ref}
                      onUpdate={(data) => handleGasifierUpdate(form.id, data)}
                      onRemove={() => removeGasifierForm(form.id)}
                      showRemoveButton={gasifierForms.length > 1}
                      initialData={initialData}
                      disabled={isSessionReadOnly}
                      observationId={form.observationId}
                    />
                  );
                })}
                
                {!isSessionReadOnly && (
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="outline"
                      onClick={addGasifierForm}
                      disabled={isSaving}
                      testId="add-gasifier-form-button"
                    >
                      Add Gasifier Sample
                    </Button>
                  </div>
                )}
              </div>
            </CardContent> */
          )}
        </Card>
      </div>

      {/* Submission details - Now moved below the observations with icons */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="font-medium">Submission Details</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Outdoor Environment</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Thermometer className="text-error-500 mr-2" size={18} />
                  <div className="text-sm">
                    <span className="text-gray-500">Outdoor:</span> 
                    <span className="ml-1 font-medium">{submission.temperature}°F</span>
                    <span className="mx-1 text-gray-400">|</span>
                    <span className="text-gray-500">Indoor:</span> 
                    <span className="ml-1 font-medium">
                      {submission.indoor_temperature ? `${submission.indoor_temperature}°F` : 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center">
                  <Droplets className="text-secondary-500 mr-2" size={18} />
                  <div className="text-sm">
                    <span className="text-gray-500">Outdoor:</span> 
                    <span className="ml-1 font-medium">{submission.humidity}%</span>
                    <span className="mx-1 text-gray-400">|</span>
                    <span className="text-gray-500">Indoor:</span> 
                    <span className="ml-1 font-medium">
                      {submission.indoor_humidity ? `${submission.indoor_humidity}%` : 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center">
                  {renderWeatherIcon(submission.weather)}
                  <div className="text-sm">
                    <span className="text-gray-500">Weather:</span> 
                    <span className="ml-1 font-medium">{submission.weather}</span>
                  </div>
                </div>
                <div className="flex items-center">
                  <Wind className="text-primary-500 mr-2" size={18} />
                  <div className="text-sm">
                    <span className="text-gray-500">Airflow:</span> 
                    <span className="ml-1 font-medium">{submission.airflow}</span>
                  </div>
                </div>
                <div className="flex items-center">
                  <Ruler className="text-primary-500 mr-2" size={18} />
                  <div className="text-sm">
                    <span className="text-gray-500">Odor Distance:</span> 
                    <span className="ml-1 font-medium">{submission.odor_distance}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Details</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Calendar className="text-primary-500 mr-2" size={18} />
                  <span className="text-sm">
                    {format(new Date(submission.created_at), 'PPp')}
                  </span>
                </div>
                {submission.created_by && (
                  <div className="flex items-center">
                    <User className="text-primary-500 mr-2" size={18} />
                    <span className="text-sm">
                      {submission.created_by_name || 'User'}
                    </span>
                  </div>
                )}
                {session?.last_activity_time && (
                  <div className="flex items-center">
                    <Calendar className="text-primary-500 mr-2" size={18} />
                    <div className="text-sm">
                      <span className="text-gray-500">Last activity:</span>
                      <span className="ml-1 font-medium">
                        {format(new Date(session.last_activity_time), 'Pp')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Observations Summary */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Observations</h3>
              <div className="space-y-2">
                <div className="p-2 bg-primary-50 rounded-md border border-primary-100">
                  <div className="flex justify-between">
                    <span className="text-sm text-primary-800">Petri Samples:</span>
                    <span className="font-medium">{petriObservations.length}</span>
                  </div>
                </div>
                <div className="p-2 bg-accent-50 rounded-md border border-accent-100">
                  <div className="flex justify-between">
                    <span className="text-sm text-accent-800">Gasifier Samples:</span>
                    <span className="font-medium">{gasifierObservations.length}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {submission.notes && (
              <div className="md:col-span-3">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Notes</h3>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md border border-gray-100">
                  {submission.notes}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Action buttons for mobile (fixed at bottom) */}
      {!isSessionReadOnly && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex space-x-2 z-10">
          <Button
            variant="outline"
            onClick={() => navigate(`/programs/${programId}/sites/${siteId}`)}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            variant="danger"
            onClick={handleCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleSave}
            isLoading={isSaving}
            className="flex-1"
            disabled={!canEditSubmission}
          >
            Save
          </Button>
          <Button
            variant="primary"
            onClick={handleComplete}
            isLoading={isSaving}
            className="flex-1"
            disabled={
              !canEditSubmission ||
              completedPetriCount < petriObservations.length ||
              completedGasifierCount < gasifierObservations.length
            }
          >
            Complete
          </Button>
        </div>
      )}
      
      {/* Template warning modal */}
      <TemplateWarningModal
        isOpen={!!showTemplateWarning}
        onClose={() => setShowTemplateWarning(null)}
        onConfirm={() => {}}
        entityType={showTemplateWarning || 'Petri'}
      />
      
      {/* Confirmation modal for incomplete submissions */}
      <ConfirmSubmissionModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={completeSession}
        currentPetriCount={petriForms.filter(f => f.isValid).length}
        currentGasifierCount={gasifierForms.filter(f => f.isValid).length}
        expectedPetriCount={expectedPetriCount}
        expectedGasifierCount={expectedGasifierCount}
        siteName={selectedSite?.name || ''}
      />
      
      {/* Permission modal */}
      <PermissionModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        message={permissionMessage}
      />
      
      {/* Share modal */}
      {showShareModal && session && (
        <SessionShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          sessionId={session.session_id}
          programId={programId!}
        />
      )}
    </div>
  );
};

export default SubmissionEditPage;