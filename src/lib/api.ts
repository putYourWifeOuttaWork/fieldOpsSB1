import { supabase } from './supabaseClient';
import { toast } from 'react-toastify';
import { AuthError, NetworkError } from './errors';

// Constants for retry logic
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 300; // milliseconds

/**
 * Wrapper for Supabase API calls with retry logic and auth error detection
 * @param apiCall Function that makes the actual Supabase call
 * @param retryCount Current retry count
 * @param maxRetries Maximum number of retries
 * @returns Promise with the API result
 */
export async function withRetry<T>(
  apiCall: () => Promise<{ data: T | null; error: any }>,
  retryCount = 0,
  maxRetries = MAX_RETRIES
): Promise<{ data: T | null; error: any }> {
  try {
    console.log(`Making API call (attempt ${retryCount + 1}/${maxRetries + 1})`);
    const result = await apiCall();
    
    // Check for authentication errors (don't retry these)
    if (result.error) {
      console.error('API call returned an error:', result.error);
      
      // Check for specific auth error codes and messages
      const isAuthError = 
        // PostgreSQL auth errors
        result.error.code === 'PGRST301' || // Unauthorized
        result.error.code === '42501' ||    // Insufficient privilege
        result.error.code === '3D000' ||    // Invalid schema
        // HTTP status-based auth errors
        result.error.status === 401 ||      // Unauthorized
        result.error.status === 403 ||      // Forbidden
        // Message-based detection as fallback
        result.error.message?.toLowerCase().includes('jwt') ||
        result.error.message?.toLowerCase().includes('auth') ||
        result.error.message?.toLowerCase().includes('token') ||
        result.error.message?.toLowerCase().includes('unauthorized') ||
        result.error.message?.toLowerCase().includes('permission') ||
        result.error.message?.toLowerCase().includes('forbidden');

      if (isAuthError) {
        console.error('Authentication error detected:', result.error);
        throw new AuthError(result.error.message || 'Authentication failed');
      }
      
      // Network/connectivity errors
      const isNetworkError = 
        result.error.code === 'PGRST100' || // Internal server error
        result.error.message?.toLowerCase().includes('network') ||
        result.error.message?.toLowerCase().includes('timeout') ||
        result.error.message?.toLowerCase().includes('connection');
        
      if (isNetworkError) {
        console.error('Network error detected:', result.error);
        if (!navigator.onLine) {
          throw new NetworkError('You are currently offline');
        }
      }

      // If we have an error that might be resolved by retrying (network errors, timeouts, etc.)
      if (retryCount < maxRetries) {
        // These error codes generally indicate transient errors that may resolve with a retry
        const isRetryableError = 
          result.error.code === 'PGRST116' || // Postgres REST timeout
          result.error.code === '23505' ||    // Unique violation (might resolve with retry after conflict resolves)
          result.error.code === '503' ||      // Service unavailable
          isNetworkError;
          
        if (isRetryableError) {
          console.warn(`API call failed (attempt ${retryCount + 1}/${maxRetries + 1}), retrying...`, result.error);
          
          // Calculate delay with exponential backoff
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Retry with incremented counter
          return withRetry(apiCall, retryCount + 1, maxRetries);
        }
      }
    }
    
    return result;
  } catch (error) {
    // If error is already an AuthError, just rethrow it
    if (error instanceof AuthError) {
      throw error;
    }
    
    // Handle unexpected errors (non-Supabase errors)
    console.error('Unexpected error in API call:', error);
    
    // If we haven't exceeded max retries, try again
    if (retryCount < maxRetries) {
      console.warn(`API call failed with unexpected error (attempt ${retryCount + 1}/${maxRetries + 1}), retrying...`);
      
      // Calculate delay with exponential backoff
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry with incremented counter
      return withRetry(apiCall, retryCount + 1, maxRetries);
    }
    
    // If we've exhausted retries, return a formatted error
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        originalError: error
      }
    };
  }
}

/**
 * Enhanced version of fetchSitesByProgramId with retry logic
 */
export const fetchSitesByProgramId = async (programId: string) => {
  if (!programId) return { data: [], error: null };
  
  console.log(`Fetching sites for program ${programId}`);
  return withRetry(() => 
    supabase
      .from('sites')
      .select('*')
      .eq('program_id', programId)
      .order('name', { ascending: true })
  );
};

/**
 * Enhanced version of fetchSubmissionsBySiteId with retry logic
 */
export const fetchSubmissionsBySiteId = async (siteId: string) => {
  if (!siteId) return { data: [], error: null };
  
  console.log(`Fetching submissions for site ${siteId}`);
  return withRetry(() => 
    supabase
      .rpc('fetch_submissions_for_site', { p_site_id: siteId })
  );
};

/**
 * Enhanced version of fetchSiteById with retry logic
 */
export const fetchSiteById = async (siteId: string) => {
  if (!siteId) return { data: null, error: null };
  
  console.log(`Fetching site ${siteId}`);
  return withRetry(() => 
    supabase
      .from('sites')
      .select('*')
      .eq('site_id', siteId)
      .single()
  );
};