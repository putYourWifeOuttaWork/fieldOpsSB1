import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-toastify';
import { PilotProgram } from '../lib/types';
import { useQueryClient } from '@tanstack/react-query';
import { withRetry } from '../utils/helpers';

interface CloneProgramParams {
  sourceProgram: PilotProgram;
  newName: string;
  newDescription: string;
  newStartDate: string;
  newEndDate: string;
  siteOverrides?: Record<string, any>;
}

interface ProgramPhase {
  phase_number: number;
  phase_type: 'control' | 'experimental';
  label: string;
  start_date: string;
  end_date: string;
  notes?: string;
}

interface ProgramLineageItem {
  program_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  index: number;
}

interface SiteLineageItem {
  site_id: string;
  site_code: number;
  name: string;
  program_id: string;
  program_name: string;
}

export function useProgramCloning() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  /**
   * Clone a program with all its sites
   */
  const cloneProgram = useCallback(async ({
    sourceProgram,
    newName,
    newDescription,
    newStartDate,
    newEndDate,
    siteOverrides = {}
  }: CloneProgramParams) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await withRetry(() => 
        supabase.rpc('clone_program', {
          p_source_program_id: sourceProgram.program_id,
          p_new_name: newName,
          p_new_description: newDescription,
          p_new_start_date: newStartDate,
          p_new_end_date: newEndDate,
          p_site_overrides: siteOverrides
        })
      );
      
      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to clone program');
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['programs']);
      
      toast.success('Program cloned successfully');
      return data;
    } catch (err) {
      console.error('Error cloning program:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast.error(`Failed to clone program: ${errorMessage}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  /**
   * Get program phases including phases from ancestor programs
   */
  const getProgramPhases = useCallback(async (programId: string): Promise<ProgramPhase[] | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await withRetry(() => 
        supabase.rpc('get_program_phases', {
          p_program_id: programId
        })
      );
      
      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to get program phases');
      }
      
      return data.phases;
    } catch (err) {
      console.error('Error getting program phases:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get program lineage (current program and all ancestors)
   */
  const getProgramLineage = useCallback(async (programId: string): Promise<ProgramLineageItem[] | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await withRetry(() => 
        supabase.rpc('get_program_lineage', {
          p_program_id: programId
        })
      );
      
      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to get program lineage');
      }
      
      return data.lineage;
    } catch (err) {
      console.error('Error getting program lineage:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    cloneProgram,
    getProgramPhases,
    getProgramLineage,
    loading,
    error
  };
}

export default useProgramCloning;