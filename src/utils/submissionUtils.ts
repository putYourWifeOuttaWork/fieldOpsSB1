import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-toastify';
import { PetriObservation, GasifierObservation } from '../lib/types';

// Types for observation data
export interface PetriFormData {
  formId: string;
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
}

export interface GasifierFormData {
  formId: string;
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
}

// Function to upload an image to Supabase storage
export const uploadImage = async (
  file: File, 
  siteId: string, 
  submissionId: string, 
  observationId: string,
  type: 'petri' | 'gasifier'
): Promise<string | null> => {
  try {
    console.log(`[uploadImage] Starting upload for ${type} observation: ${observationId}`, {
      fileSize: file.size,
      fileType: file.type,
      fileName: file.name
    });
    
    const fileName = `${siteId}/${submissionId}/${type}-${observationId}-${Date.now()}`;
    
    const { data: fileData, error: fileError } = await supabase.storage
      .from('petri-images')
      .upload(fileName, file);
      
    if (fileError) {
      console.error(`Error uploading ${type} image:`, fileError);
      throw fileError;
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('petri-images')
      .getPublicUrl(fileData.path);
    
    console.log(`[uploadImage] Successfully uploaded image, got URL:`, 
      publicUrlData.publicUrl.substring(0, 50) + '...');
    
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(`Error in uploadImage for ${type}:`, error);
    return null;
  }
};

// Function to create or update a petri observation
export const updatePetriObservation = async (
  formData: PetriFormData, 
  submissionId: string,
  siteId: string
): Promise<{ success: boolean; observationId?: string; message?: string }> => {
  try {
    console.log('[updatePetriObservation] Starting with form data:', { 
      hasFormData: !!formData,
      petriCode: formData.petriCode,
      hasImageFile: !!formData.imageFile,
      imageFileDetails: formData.imageFile ? {
        name: formData.imageFile.name,
        size: formData.imageFile.size,
        type: formData.imageFile.type
      } : null,
      hasExistingUrl: !!formData.imageUrl,
      hasTempKey: !!formData.tempImageKey,
      observationId: formData.observationId
    });
    
    // If we have an existing observation
    if (formData.observationId) {
      // If there's a new image file, upload it
      let imageUrl = formData.imageUrl;
      
      if (formData.imageFile) {
        console.log('[updatePetriObservation] Uploading new image for existing observation');
        imageUrl = await uploadImage(formData.imageFile, siteId, submissionId, formData.formId, 'petri');
        
        if (!imageUrl) {
          console.error('[updatePetriObservation] Failed to upload image');
          return { success: false, message: 'Failed to upload image' };
        }
      }

      console.log('[updatePetriObservation] Updating existing observation with new data');
      
      // Update the observation
      const { error } = await supabase
        .from('petri_observations')
        .update({
          petri_code: formData.petriCode,
          image_url: imageUrl,
          plant_type: formData.plantType,
          fungicide_used: formData.fungicideUsed,
          surrounding_water_schedule: formData.surroundingWaterSchedule,
          placement: formData.placement || null,
          placement_dynamics: formData.placement_dynamics || null,
          notes: formData.notes || null,
          last_updated_by_user_id: (await supabase.auth.getUser()).data.user?.id,
          outdoor_temperature: formData.outdoor_temperature,
          outdoor_humidity: formData.outdoor_humidity
        })
        .eq('observation_id', formData.observationId);
        
      if (error) {
        console.error('Error updating petri observation:', error);
        return { success: false, message: error.message };
      }
      
      return { success: true, observationId: formData.observationId };
    } 
    // Create a new observation
    else {
      // If there's an image file, upload it
      let imageUrl = null;
      
      if (formData.imageFile) {
        console.log('[updatePetriObservation] Uploading new image for new observation');
        imageUrl = await uploadImage(formData.imageFile, siteId, submissionId, formData.formId, 'petri');
        
        if (!imageUrl) {
          console.error('[updatePetriObservation] Failed to upload image');
          return { success: false, message: 'Failed to upload image' };
        }
      }

      console.log('[updatePetriObservation] Creating new petri observation');
      
      // Insert new observation
      const { data, error } = await supabase
        .from('petri_observations')
        .insert({
          submission_id: submissionId,
          site_id: siteId,
          petri_code: formData.petriCode,
          image_url: imageUrl,
          plant_type: formData.plantType,
          fungicide_used: formData.fungicideUsed,
          surrounding_water_schedule: formData.surroundingWaterSchedule,
          placement: formData.placement || null,
          placement_dynamics: formData.placement_dynamics || null,
          notes: formData.notes || null,
          last_updated_by_user_id: (await supabase.auth.getUser()).data.user?.id,
          outdoor_temperature: formData.outdoor_temperature,
          outdoor_humidity: formData.outdoor_humidity
        })
        .select('observation_id')
        .single();
        
      if (error) {
        console.error('Error creating petri observation:', error);
        return { success: false, message: error.message };
      }
      
      console.log('[updatePetriObservation] Created new observation with ID:', data.observation_id);
      
      return { success: true, observationId: data.observation_id };
    }
  } catch (error) {
    console.error('Error in updatePetriObservation:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Function to create or update a gasifier observation
export const updateGasifierObservation = async (
  formData: GasifierFormData, 
  submissionId: string,
  siteId: string
): Promise<{ success: boolean; observationId?: string; message?: string }> => {
  try {
    console.log('[updateGasifierObservation] Starting with form data:', { 
      hasFormData: !!formData,
      gasifierCode: formData.gasifierCode,
      hasImageFile: !!formData.imageFile,
      imageFileDetails: formData.imageFile ? {
        name: formData.imageFile.name,
        size: formData.imageFile.size,
        type: formData.imageFile.type
      } : null,
      hasExistingUrl: !!formData.imageUrl,
      hasTempKey: !!formData.tempImageKey,
      observationId: formData.observationId
    });
    
    // If we have an existing observation
    if (formData.observationId) {
      // If there's a new image file, upload it
      let imageUrl = formData.imageUrl;
      
      if (formData.imageFile) {
        console.log('[updateGasifierObservation] Uploading new image for existing observation');
        imageUrl = await uploadImage(formData.imageFile, siteId, submissionId, formData.formId, 'gasifier');
        
        if (!imageUrl) {
          console.error('[updateGasifierObservation] Failed to upload image');
          return { success: false, message: 'Failed to upload image' };
        }
      }

      console.log('[updateGasifierObservation] Updating existing observation with new data');
      
      // Update the observation
      const { error } = await supabase
        .from('gasifier_observations')
        .update({
          gasifier_code: formData.gasifierCode,
          image_url: imageUrl,
          chemical_type: formData.chemicalType,
          measure: formData.measure,
          anomaly: formData.anomaly,
          placement_height: formData.placementHeight || null,
          directional_placement: formData.directionalPlacement || null,
          placement_strategy: formData.placementStrategy || null,
          notes: formData.notes || null,
          last_updated_by_user_id: (await supabase.auth.getUser()).data.user?.id,
          outdoor_temperature: formData.outdoor_temperature,
          outdoor_humidity: formData.outdoor_humidity
        })
        .eq('observation_id', formData.observationId);
        
      if (error) {
        console.error('Error updating gasifier observation:', error);
        return { success: false, message: error.message };
      }
      
      return { success: true, observationId: formData.observationId };
    } 
    // Create a new observation
    else {
      // If there's an image file, upload it
      let imageUrl = null;
      
      if (formData.imageFile) {
        console.log('[updateGasifierObservation] Uploading new image for new observation');
        imageUrl = await uploadImage(formData.imageFile, siteId, submissionId, formData.formId, 'gasifier');
        
        if (!imageUrl) {
          console.error('[updateGasifierObservation] Failed to upload image');
          return { success: false, message: 'Failed to upload image' };
        }
      }

      console.log('[updateGasifierObservation] Creating new gasifier observation');
      
      // Insert new observation
      const { data, error } = await supabase
        .from('gasifier_observations')
        .insert({
          submission_id: submissionId,
          site_id: siteId,
          gasifier_code: formData.gasifierCode,
          image_url: imageUrl,
          chemical_type: formData.chemicalType,
          measure: formData.measure,
          anomaly: formData.anomaly,
          placement_height: formData.placementHeight || null,
          directional_placement: formData.directionalPlacement || null,
          placement_strategy: formData.placementStrategy || null,
          notes: formData.notes || null,
          last_updated_by_user_id: (await supabase.auth.getUser()).data.user?.id,
          outdoor_temperature: formData.outdoor_temperature,
          outdoor_humidity: formData.outdoor_humidity
        })
        .select('observation_id')
        .single();
        
      if (error) {
        console.error('Error creating gasifier observation:', error);
        return { success: false, message: error.message };
      }
      
      console.log('[updateGasifierObservation] Created new observation with ID:', data.observation_id);
      
      return { success: true, observationId: data.observation_id };
    }
  } catch (error) {
    console.error('Error in updateGasifierObservation:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Function to process and update multiple petri observations
export const updatePetriObservations = async (
  petriObservations: PetriFormData[],
  submissionId: string,
  siteId: string
): Promise<{ success: boolean; updatedObservations: { clientId: string; observationId: string }[] }> => {
  console.log(`[updatePetriObservations] Processing ${petriObservations.length} petri observations`, 
    petriObservations.map(p => ({
      formId: p.formId,
      petriCode: p.petriCode,
      hasImage: p.hasImage,
      hasImageFile: !!p.imageFile,
      hasImageUrl: !!p.imageUrl,
      hasTempKey: !!p.tempImageKey,
      observationId: p.observationId
    }))
  );
  
  const updatedObservations: { clientId: string; observationId: string }[] = [];
  let success = true;
  
  // Process each observation in sequence (to avoid race conditions)
  for (const observation of petriObservations) {
    const result = await updatePetriObservation(observation, submissionId, siteId);
    
    if (result.success && result.observationId) {
      updatedObservations.push({
        clientId: observation.formId,
        observationId: result.observationId
      });
    } else {
      success = false;
      console.error(`Failed to update petri observation ${observation.formId}:`, result.message);
      toast.error(`Failed to update petri observation: ${result.message}`);
      break;
    }
  }
  
  return { success, updatedObservations };
};

// Function to process and update multiple gasifier observations
export const updateGasifierObservations = async (
  gasifierObservations: GasifierFormData[],
  submissionId: string,
  siteId: string
): Promise<{ success: boolean; updatedObservations: { clientId: string; observationId: string }[] }> => {
  console.log(`[updateGasifierObservations] Processing ${gasifierObservations.length} gasifier observations`,
    gasifierObservations.map(g => ({
      formId: g.formId,
      gasifierCode: g.gasifierCode,
      hasImage: g.hasImage,
      hasImageFile: !!g.imageFile,
      hasImageUrl: !!g.imageUrl,
      hasTempKey: !!g.tempImageKey,
      observationId: g.observationId
    }))
  );
  
  const updatedObservations: { clientId: string; observationId: string }[] = [];
  let success = true;
  
  // Process each observation in sequence (to avoid race conditions)
  for (const observation of gasifierObservations) {
    const result = await updateGasifierObservation(observation, submissionId, siteId);
    
    if (result.success && result.observationId) {
      updatedObservations.push({
        clientId: observation.formId,
        observationId: result.observationId
      });
    } else {
      success = false;
      console.error(`Failed to update gasifier observation ${observation.formId}:`, result.message);
      toast.error(`Failed to update gasifier observation: ${result.message}`);
      break;
    }
  }
  
  return { success, updatedObservations };
};