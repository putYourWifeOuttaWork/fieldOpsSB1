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
          p_new_en
        }
        )
      )
    }
  }
  )
}

<boltArtifact id="update-pilot-program-card" title="Add Clone Button to PilotProgramCard">