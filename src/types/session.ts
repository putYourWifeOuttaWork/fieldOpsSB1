import { Database } from '../lib/supabaseClient';

export type User = {
  id: string;
  email: string;
  user_metadata?: {
    company?: string;
    full_name?: string;
    is_active?: boolean;
  };
};

export type PilotProgram = Database['public']['Tables']['pilot_programs']['Row'];
export type Site = Database['public']['Tables']['sites']['Row'] & {
  interior_working_surface_types?: InteriorWorkingSurfaceType[];
  microbial_risk_zone?: MicrobialRiskZone;
  quantity_deadzones?: number;
  ventilation_strategy?: VentilationStrategy;
  length?: number;
  width?: number;
  height?: number;
  min_efficacious_gasifier_density_sqft_per_bag?: number;
  recommended_placement_density_bags?: number;
  has_dead_zones?: boolean;
  num_regularly_opened_ports?: number;
  ventilation_strategy?: VentilationStrategy;
};

export type Submission = Database['public']['Tables']['submissions']['Row'] & {
  global_submission_id?: number;
};

export type PetriObservation = Database['public']['Tables']['petri_observations']['Row'] & {
  outdoor_temperature?: number;
  outdoor_humidity?: number;
};

export type GasifierObservation = Database['public']['Tables']['gasifier_observations']['Row'] & {
  outdoor_temperature?: number;
  outdoor_humidity?: number;
};

export type UserRole = 'Admin' | 'Edit' | 'Respond' | 'ReadOnly';

export type HistoryEventType = Database['public']['Tables']['pilot_program_history']['Row']['update_type'];
export type AuditLogEntry = Database['public']['Tables']['pilot_program_history']['Row'];

// Session status enum matching the database enum
export type SessionStatus = 'Opened' | 'Working' | 'Completed' | 'Cancelled' | 
                           'Expired' | 'Escalated' | 'Shared' | 
                           'Expired-Complete' | 'Expired-Incomplete';

// Session data structure
export interface SubmissionSession {
  session_id: string;
  submission_id: string;
  site_id: string;
  program_id: string;
  opened_by_user_id: string | null; // Can be null for unclaimed sessions
  session_start_time: string;
  last_activity_time: string;
  session_status: SessionStatus;
  completion_time?: string;
  completed_by_user_id?: string;
  percentage_complete: number;
  valid_petris_logged: number;
  valid_gasifiers_logged: number;
  escalated_to_user_ids?: string[];
}

// Active session with related data
export interface ActiveSession {
  session_id: string;
  submission_id: string;
  site_id: string;
  site_name: string;
  program_id: string;
  program_name: string;
  opened_by_user_id: string | null;
  opened_by_user_email: string | null;
  opened_by_user_name?: string | null;
  session_start_time: string;
  last_activity_time: string;
  session_status: string;
  percentage_complete: number;
  global_submission_id?: number;
  escalated_to_user_ids?: string[];
  is_unclaimed?: boolean; // Flag to indicate unclaimed sessions
}

// Initial submission data for creating a new session
export interface InitialSubmissionData {
  temperature: number;
  humidity: number;
  airflow: 'Open' | 'Closed';
  odor_distance: '5-10ft' | '10-25ft' | '25-50ft' | '50-100ft' | '>100ft';
  weather: 'Clear' | 'Cloudy' | 'Rain';
  notes?: string;
  indoor_temperature?: number;
  indoor_humidity?: number;
  timezone?: string;
}

// Response from creating a new session
export interface CreateSessionResponse {
  success: boolean;
  submission_id?: string;
  session_id?: string;
  session?: SubmissionSession;
  message?: string;
}

// Session progress information
export interface SessionProgress {
  percentage: number;
  validPetris: number;
  validGasifiers: number;
  totalPetris: number;
  totalGasifiers: number;
}

// Session user information
export interface SessionUser {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole | 'Owner' | 'Collaborator';
}

// Session with full context data
export interface SessionWithContext {
  session: SubmissionSession;
  submission: Submission;
  site: Site;
  program: PilotProgram;
  users: SessionUser[];
  progress: SessionProgress;
}

// Types for site template data
export interface SubmissionDefaults {
  temperature: number;
  humidity: number;
  airflow: 'Open' | 'Closed'; // This remains as Open/Closed for submissions
  odor_distance: '5-10ft' | '10-25ft' | '25-50ft' | '50-100ft' | '>100ft';
  weather: 'Clear' | 'Cloudy' | 'Rain';
  notes?: string | null;
  indoor_temperature?: number | null;
  indoor_humidity?: number | null;
}

export interface PetriDefaults {
  petri_code: string;
  plant_type: 'Other Fresh Perishable'; // Hardcoded to 'Other Fresh Perishable'
  fungicide_used: 'Yes' | 'No';
  surrounding_water_schedule: 'Daily' | 'Every Other Day' | 'Every Third Day' | 'Twice Daily' | 'Thrice Daily';
  placement?: PetriPlacement;
  placement_dynamics?: PetriPlacementDynamics;
  notes?: string | null;
}

// New types for gasifier functionality
export type ChemicalType = 'Geraniol' | 'CLO2' | 'Acetic Acid' | 'Citronella Blend' | 'Essential Oils Blend' | '1-MCP' | 'Other';
export type PlacementHeight = 'High' | 'Medium' | 'Low';
export type DirectionalPlacement = 'Front-Center' | 'Front-Left' | 'Front-Right' | 'Center-Center' | 'Center-Left' | 'Center-Right' | 'Back-Center' | 'Back-Left' | 'Back-Right';
export type PlacementStrategy = 'Perimeter Coverage' | 'Centralized Coverage' | 'Centralized and Perimeter Coverage' | 'Targeted Coverage' | 'Spot Placement Coverage';
export type PetriPlacement = DirectionalPlacement;
export type PetriPlacementDynamics = 'Near Port' | 'Near Door' | 'Near Ventillation Out' | 'Near Airflow In';

export interface GasifierDefaults {
  gasifier_code: string;
  chemical_type: ChemicalType;
  placement_height: PlacementHeight;
  directional_placement: DirectionalPlacement;
  placement_strategy: PlacementStrategy;
  notes?: string | null;
}

// New types for site properties
export type PrimaryFunction = 'Growing' | 'Drying' | 'Packaging' | 'Storage' | 'Research' | 'Retail';
export type ConstructionMaterial = 'Glass' | 'Polycarbonate' | 'Metal' | 'Concrete' | 'Wood';
export type InsulationType = 'None' | 'Basic' | 'Moderate' | 'High';
export type HVACSystemType = 'Centralized' | 'Distributed' | 'Evaporative Cooling' | 'None';
export type IrrigationSystemType = 'Drip' | 'Sprinkler' | 'Hydroponic' | 'Manual';
export type LightingSystem = 'Natural Light Only' | 'LED' | 'HPS' | 'Fluorescent';
export type VentPlacement = 'Ceiling-Center' | 'Ceiling-Perimeter' | 'Upper-Walls' | 'Lower-Walls' | 'Floor-Level';
export type InteriorWorkingSurfaceType = 'Stainless Steel' | 'Unfinished Concrete' | 'Wood' | 'Plastic' | 'Granite' | 'Other Non-Absorbative';
export type MicrobialRiskZone = 'Low' | 'Medium' | 'High';
export type VentilationStrategy = 'Cross-Ventilation' | 'Positive Pressure' | 'Negative Pressure' | 'Neutral Sealed';

// New types for site environmental fields
export type InteriorWorkingSurfaceType = 'Stainless Steel' | 'Unfinished Concrete' | 'Wood' | 'Plastic' | 'Granite' | 'Other Non-Absorbative';
export type MicrobialRiskZone = 'Low' | 'Medium' | 'High';
export type VentilationStrategy = 'Cross-Ventilation' | 'Positive Pressure' | 'Negative Pressure' | 'Neutral Sealed';

// Interface for site properties in forms
export interface SitePropertiesForm {
  squareFootage?: number | null;
  cubicFootage?: number | null;
  numVents?: number | null;
  ventPlacements?: string[];
  primaryFunction?: PrimaryFunction;
  constructionMaterial?: ConstructionMaterial;
  insulationType?: InsulationType;
  hvacSystemPresent?: boolean;
  hvacSystemType?: HVACSystemType;
  irrigationSystemType?: IrrigationSystemType;
  lightingSystem?: LightingSystem;
  
  // New dimension fields
  length?: number | null;
  width?: number | null;
  height?: number | null;
  
  // New gasifier density fields
  minEfficaciousGasifierDensity?: number | null;
  recommendedPlacementDensity?: number | null;
  
  // New airflow dynamics fields
  hasDeadZones?: boolean | null;
  numRegularlyOpenedPorts?: number | null;
  
  // New environmental fields
  interiorWorkingSurfaceTypes?: string[];
  microbialRiskZone?: MicrobialRiskZone;
  quantityDeadzones?: number | null;
  ventilationStrategy?: VentilationStrategy;
}

// Analytics response types
export interface EnvironmentalTrend {
  interval_start: string;
  avg_temperature: number;
  avg_humidity: number;
  avg_indoor_temperature: number;
  avg_indoor_humidity: number;
  submission_count: number;
}

export interface WeatherConditionCounts {
  interval_start: string;
  clear_count: number;
  cloudy_count: number;
  rain_count: number;
  total_count: number;
}

// Granularity type for analytics
export type AnalyticsGranularity = '12hour' | 'day' | 'week';

// Outdoor environmental data types
export interface OutdoorEnvironmentalData {
  outdoor_temperature?: number;
  outdoor_humidity?: number;
}