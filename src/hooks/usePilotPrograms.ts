import { useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../stores/authStore';
import { PilotProgram } from '../lib/types';
import { toast } from 'react-toastify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { withRetry } from '../utils/helpers';

interface UsePilotProgramsResult {
  programs: PilotProgram[];
  isLoading: boolean;
  error: string | null;
  refetchPrograms: () => Promise<void>;
  createProgram: (programData: Omit<PilotProgram, 'program_id' | 'total_submissions' | 'total_sites' | 'created_at' | 'updated_at'>) => Promise<PilotProgram | null>;
  updateProgram: (programId: string, programData: Partial<PilotProgram>) => Promise<PilotProgram | null>;
  deleteProgram: (programId: string) => Promise<boolean>;
  fetchPilotProgram: (programId: string) => Promise<PilotProgram | null>;
}

export const usePilotPrograms = (): UsePilotProgramsResult => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Use React Query for fetching programs
  const programsQuery = useQuery({
    queryKey: ['programs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      console.log('Fetching programs for user:', user.id);
      const { data, error } = await withRetry(() => 
        supabase
          .from('pilot_programs')
          .select('*')
          .order('name')
      );
        
      if (error) {
        console.error('Error fetching programs:', error);
        throw error;
      }
      
      console.log(`Successfully fetched ${data?.length || 0} programs`);
      return data || [];
    },
    enabled: !!user,
    staleTime: 0, // Always refetch on window focus
    refetchOnWindowFocus: true,
  });

  // Use React Query for fetching a single program
  const fetchPilotProgram = async (programId: string): Promise<PilotProgram | null> => {
    try {
      console.log(`Fetching program with ID: ${programId}`);
      
      // Check cache first
      const cachedProgram = queryClient.getQueryData<PilotProgram>(['program', programId]);
      if (cachedProgram) {
        console.log('Using cached program data:', cachedProgram.name);
        return cachedProgram;
      }
      
      const { data, error } = await withRetry(() => 
        supabase
          .from('pilot_programs')
          .select('*')
          .eq('program_id', programId)
          .single()
      );
        
      if (error) {
        console.error('Error fetching pilot program:', error);
        return null;
      }
      
      console.log('Successfully fetched program:', data?.name);
      
      // Cache the result
      queryClient.setQueryData(['program', programId], data);
      return data;
    } catch (err) {
      console.error('Error in fetchPilotProgram:', err);
      return null;
    }
  };

  // Create program mutation
  const createProgramMutation = useMutation({
    mutationFn: async (programData: Omit<PilotProgram, 'program_id' | 'total_submissions' | 'total_sites' | 'created_at' | 'updated_at'>) => {
      // Calculate status based on date range
      const today = new Date();
      const startDate = new Date(programData.start_date);
      const endDate = new Date(programData.end_date);
      
      const calculatedStatus = 
        (today >= startDate && today <= endDate) ? 'active' : 'inactive';
      
      const { data, error } = await withRetry(() => 
        supabase
          .from('pilot_programs')
          .insert({
            ...programData,
            status: calculatedStatus,
            total_submissions: 0,
            total_sites: 0
          })
          .select()
          .single()
      );
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate and refetch programs query
      queryClient.invalidateQueries({queryKey: ['programs']});
      
      // Add the new program to the cache
      queryClient.setQueryData(['program', data.program_id], data);
      
      toast.success('Program created successfully');
    },
    onError: (error) => {
      console.error('Error creating program:', error);
      toast.error(`Failed to create program: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Update program mutation
  const updateProgramMutation = useMutation({
    mutationFn: async ({ programId, programData }: { programId: string, programData: Partial<PilotProgram> }) => {
      const { data, error } = await withRetry(() => 
        supabase
          .from('pilot_programs')
          .update(programData)
          .eq('program_id', programId)
          .select()
          .single()
      );
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Update the cache for this program
      queryClient.setQueryData(['program', data.program_id], data);
      
      // Update the program in the programs list
      queryClient.setQueryData<PilotProgram[]>(['programs', user?.id], (oldData) => {
        if (!oldData) return [data];
        return oldData.map(p => 
          p.program_id === data.program_id ? data : p
        );
      });
      
      toast.success('Program updated successfully');
    },
    onError: (error) => {
      console.error('Error updating program:', error);
      toast.error(`Failed to update program: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Delete program mutation
  const deleteProgramMutation = useMutation({
    mutationFn: async (programId: string) => {
      const { error } = await withRetry(() => 
        supabase
          .from('pilot_programs')
          .delete()
          .eq('program_id', programId)
      );
      
      if (error) throw error;
      return programId;
    },
    onSuccess: (programId) => {
      // Remove the program from the cache
      queryClient.removeQueries({queryKey: ['program', programId]});
      
      // Remove the program from the programs list
      queryClient.setQueryData<PilotProgram[]>(['programs', user?.id], (oldData) => {
        if (!oldData) return [];
        return oldData.filter(p => p.program_id !== programId);
      });
      
      toast.success('Program deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting program:', error);
      toast.error(`Failed to delete program: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Wrapper for createProgram
  const createProgram = async (programData: Omit<PilotProgram, 'program_id' | 'total_submissions' | 'total_sites' | 'created_at' | 'updated_at'>): Promise<PilotProgram | null> => {
    try {
      return await createProgramMutation.mutateAsync(programData);
    } catch (error) {
      return null;
    }
  };

  // Wrapper for updateProgram
  const updateProgram = async (programId: string, programData: Partial<PilotProgram>): Promise<PilotProgram | null> => {
    try {
      return await updateProgramMutation.mutateAsync({ programId, programData });
    } catch (error) {
      return null;
    }
  };

  // Wrapper for deleteProgram
  const deleteProgram = async (programId: string): Promise<boolean> => {
    try {
      await deleteProgramMutation.mutateAsync(programId);
      return true;
    } catch (error) {
      return false;
    }
  };

  // Force refetch programs
  const refetchPrograms = useCallback(async () => {
    console.log("Forcing program refetch");
    await queryClient.invalidateQueries({queryKey: ['programs']});
  }, [queryClient]);

  return {
    programs: programsQuery.data || [],
    isLoading: programsQuery.isLoading,
    error: programsQuery.error ? String(programsQuery.error) : null,
    refetchPrograms,
    createProgram,
    updateProgram,
    deleteProgram,
    fetchPilotProgram
  };
};

export default usePilotPrograms;