import { Database } from './supabaseClient';

export type User = {
  id: string;
  email: string;
  user_metadata?: {
    company?: string;
    full_name?: string;
    is_active?: boolean;
  };
};

export type PilotProgram = Database['public']['Tables']['pilot_programs']['Row'] & {
  phases?: ProgramPhase[];
};

export type ProgramPhase = {
  phase_number: number;
  phase_type: 'control' | 'experimental';
  label: string;
  start_date: string;
  end_date: string;
  notes?: string;
};

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