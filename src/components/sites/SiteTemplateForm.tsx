import { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import Button from '../common/Button';
import Input from '../common/Input';
import NewSitePetriTemplateForm from './NewSitePetriTemplateForm';
import NewSiteGasifierTemplateForm from './NewSiteGasifierTemplateForm';
import { PetriDefaults, GasifierDefaults, SubmissionDefaults } from '../../lib/types';
import { v4 as uuidv4 } from 'uuid';

interface SiteTemplateFormProps {
  siteId: string;
  initialValues: {
    submissionDefaults?: SubmissionDefaults;
    petriDefaults?: PetriDefaults[];
    gasifierDefaults?: GasifierDefaults[];
    // Static site properties
    squareFootage?: number;
    cubicFootage?: number;
    numVents?: number;
    ventPlacements?: string[];
    primaryFunction?: string;
    constructionMaterial?: string;
    insulationType?: string;
    hvacSystemPresent?: boolean;
    hvacSystemType?: string;
    irrigationSystemType?: string;
    lightingSystem?: string;
    // Dimensions
    length?: number;
    width?: number;
    height?: number;
    // Density
    minEfficaciousGasifierDensity?: number;
    // Airflow dynamics
    hasDeadZones?: boolean;
    numRegularlyOpenedPorts?: number;
    // Environment
    interiorWorkingSurfaceTypes?: string[];
    microbialRiskZone?: string;
    quantityDeadzones?: number;
    ventilationStrategy?: string;
  };
  initialSiteName: string;
  onSubmit: (
    siteName: string, 
    submissionDefaults: SubmissionDefaults, 
    petriDefaults: PetriDefaults[], 
    gasifierDefaults: GasifierDefaults[],
    siteProperties?: any
  ) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

// Define facility property options
const primaryFunctionOptions = ['Growing', 'Drying', 'Packaging', 'Storage', 'Research', 'Retail'];
const constructionMaterialOptions = ['Glass', 'Polycarbonate', 'Metal', 'Concrete', 'Wood'];
const insulationTypeOptions = ['None', 'Basic', 'Moderate', 'High'];
const hvacSystemTypeOptions = ['Centralized', 'Distributed', 'Evaporative Cooling', 'None'];
const irrigationSystemTypeOptions = ['Drip', 'Sprinkler', 'Hydroponic', 'Manual'];
const lightingSystemOptions = ['Natural Light Only', 'LED', 'HPS', 'Fluorescent'];
const ventPlacementOptions = ['Ceiling-Center', 'Ceiling-Perimeter', 'Upper-Walls', 'Lower-Walls', 'Floor-Level'];
const interiorWorkingSurfaceOptions = ['Stainless Steel', 'Unfinished Concrete', 'Wood', 'Plastic', 'Granite', 'Other Non-Absorbative'];
const microbialRiskZoneOptions = ['Low', 'Medium', 'High'];
const ventilationStrategyOptions = ['Cross-Ventilation', 'Positive Pressure', 'Negative Pressure', 'Neutral Sealed'];

// Define the form validation schema
const SiteTemplateFormSchema = Yup.object().shape({
  siteName: Yup.string()
    .required('Site name is required')
    .max(100, 'Site name must be at most 100 characters'),
  
  // Submission defaults validation
  temperature: Yup.number()
    .required('Temperature is required')
    .min(-30, 'Temperature is too low')
    .max(120, 'Temperature is too high'),
  
  humidity: Yup.number()
    .required('Humidity is required')
    .min(0, 'Humidity cannot be negative')
    .max(100, 'Humidity cannot exceed 100%'),
  
  indoor_temperature: Yup.number()
    .nullable()
    .min(32, 'Indoor temperature must be at least 32°F')
    .max(120, 'Indoor temperature cannot exceed 120°F'),
  
  indoor_humidity: Yup.number()
    .nullable()
    .min(1, 'Indoor humidity must be at least 1%')
    .max(100, 'Indoor humidity cannot exceed 100%'),
  
  airflow: Yup.string()
    .required('Airflow is required')
    .oneOf(['Open', 'Closed'], 'Please select a valid airflow option'),
  
  odorDistance: Yup.string()
    .required('Odor distance is required')
    .oneOf(['5-10ft', '10-25ft', '25-50ft', '50-100ft', '>100ft'], 'Please select a valid odor distance'),
  
  weather: Yup.string()
    .required('Weather is required')
    .oneOf(['Clear', 'Cloudy', 'Rain'], 'Please select a valid weather condition'),
  
  // Site dimensions validation
  squareFootage: Yup.number()
    .nullable()
    .min(100, 'Square footage must be at least 100 sq ft')
    .max(1000000000, 'Square footage is too large'),
  
  cubicFootage: Yup.number()
    .nullable()
    .min(25, 'Cubic footage must be at least 25 cu ft')
    .max(1000000, 'Cubic footage is too large'),
  
  length: Yup.number()
    .nullable()
    .min(1, 'Length must be greater than 0'),
  
  width: Yup.number()
    .nullable()
    .min(1, 'Width must be greater than 0'),
  
  height: Yup.number()
    .nullable()
    .min(1, 'Height must be greater than 0'),
  
  // Gasifier density validation
  minEfficaciousGasifierDensity: Yup.number()
    .nullable()
    .min(100, 'Gasifier density must be at least 100 sq ft per bag')
    .max(10000, 'Gasifier density is too large'),
  
  // Facility details validation
  numVents: Yup.number()
    .nullable()
    .min(1, 'Number of vents must be at least 1')
    .max(10000, 'Number of vents cannot exceed 10,000'),

  // Fix: Define siteType explicitly as string with required validation
  siteType: Yup.string()
    .required('Site type is required'),
  
  // Fix: Define hvacSystemPresent explicitly as boolean with default value
  hvacSystemPresent: Yup.boolean()
    .default(false),
  
  // Conditionally validate hvacSystemType based on hvacSystemPresent
  hvacSystemType: Yup.string()
    .nullable()
    // Fix: Use .when() with proper null handling
    .when('hvacSystemPresent', {
      is: true,  // Only validate when hvacSystemPresent is true
      then: (schema) => schema.required('HVAC system type is required when HVAC is present'),
      otherwise: (schema) => schema.nullable() // Otherwise, allow null
    }),
  
  // Fix: Define hasDeadZones explicitly as boolean with default value
  hasDeadZones: Yup.boolean()
    .default(false),
  
  // Conditionally validate quantityDeadzones based on hasDeadZones
  quantityDeadzones: Yup.number()
    .nullable()
    // Fix: Use .when() with proper null handling
    .when('hasDeadZones', {
      is: true,  // Only validate when hasDeadZones is true
      then: (schema) => 
        schema
          .required('Number of dead zones is required when dead zones are present')
          .min(1, 'Number of dead zones must be at least 1')
          .max(25, 'Number of dead zones cannot exceed 25'),
      otherwise: (schema) => schema.nullable() // Otherwise, allow null
    }),

  // New validation rules for additional fields
  interiorWorkingSurfaceTypes: Yup.array().of(Yup.string()).nullable(),
  
  microbialRiskZone: Yup.string()
    .nullable()
    .oneOf([...microbialRiskZoneOptions, null], 'Please select a valid microbial risk zone'),
    
  ventilationStrategy: Yup.string()
    .nullable()
    .oneOf([...ventilationStrategyOptions, null], 'Please select a valid ventilation strategy'),
    
  length: Yup.number()
    .nullable()
    .min(1, 'Length must be greater than 0'),
    
  width: Yup.number()
    .nullable()
    .min(1, 'Width must be greater than 0'),
    
  height: Yup.number()
    .nullable()
    .min(1, 'Height must be greater than 0'),
    
  minEfficaciousGasifierDensity: Yup.number()
    .nullable()
    .min(100, 'Gasifier density must be at least 100 sq ft per bag')
    .max(10000, 'Gasifier density is too large')
});

const SiteTemplateForm: React.FC<SiteTemplateFormProps> = ({
  siteId,
  initialValues,
  initialSiteName,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  // State for petri and gasifier template forms
  const [petriTemplates, setPetriTemplates] = useState<PetriDefaults[]>(
    initialValues.petriDefaults || []
  );
  const [gasifierTemplates, setGasifierTemplates] = useState<GasifierDefaults[]>(
    initialValues.gasifierDefaults || []
  );
  
  const [isSectionExpanded, setIsSectionExpanded] = useState({
    siteInfo: true,
    environment: false,
    petri: true,
    gasifier: true,
    recommendations: false
  });
  
  // Initialize form values from props
  const formik = useFormik({
    initialValues: {
      siteName: initialSiteName,
      // Submission defaults
      temperature: initialValues.submissionDefaults?.temperature || 70,
      humidity: initialValues.submissionDefaults?.humidity || 50,
      indoor_temperature: initialValues.submissionDefaults?.indoor_temperature || '',
      indoor_humidity: initialValues.submissionDefaults?.indoor_humidity || '',
      airflow: initialValues.submissionDefaults?.airflow || 'Open',
      odorDistance: initialValues.submissionDefaults?.odor_distance || '5-10ft',
      weather: initialValues.submissionDefaults?.weather || 'Clear',
      notes: initialValues.submissionDefaults?.notes || '',
      
      // Site physical properties - properly default these values to avoid type issues
      squareFootage: initialValues.squareFootage || null,
      cubicFootage: initialValues.cubicFootage || null,
      numVents: initialValues.numVents || null,
      ventPlacements: initialValues.ventPlacements || [],
      // Fix: Ensure siteType is a string, never undefined or null
      siteType: initialValues.siteType || 'Greenhouse',
      primaryFunction: initialValues.primaryFunction || null,
      constructionMaterial: initialValues.constructionMaterial || null,
      insulationType: initialValues.insulationType || null,
      // Fix: Ensure boolean values are explicitly boolean
      hvacSystemPresent: initialValues.hvacSystemPresent !== undefined ? !!initialValues.hvacSystemPresent : false,
      hvacSystemType: initialValues.hvacSystemType || null,
      irrigationSystemType: initialValues.irrigationSystemType || null,
      lightingSystem: initialValues.lightingSystem || null,
      
      // Dimensions
      length: initialValues.length || null,
      width: initialValues.width || null,
      height: initialValues.height || null,
      
      // Gasifier density
      minEfficaciousGasifierDensity: initialValues.minEfficaciousGasifierDensity || 2000,
      
      // Airflow dynamics
      hasDeadZones: initialValues.hasDeadZones !== undefined ? !!initialValues.hasDeadZones : false,
      numRegularlyOpenedPorts: initialValues.numRegularlyOpenedPorts || null,
      
      // Environmental properties
      interiorWorkingSurfaceTypes: initialValues.interiorWorkingSurfaceTypes || [],
      microbialRiskZone: initialValues.microbialRiskZone || 'Medium',
      quantityDeadzones: initialValues.quantityDeadzones || null,
      ventilationStrategy: initialValues.ventilationStrategy || null,
      
      // Dimensions
      length: initialValues.length || null,
      width: initialValues.width || null,
      height: initialValues.height || null,
      
      // Gasifier density
      minEfficaciousGasifierDensity: initialValues.minEfficaciousGasifierDensity || 2000,
      
      // Airflow dynamics
      hasDeadZones: initialValues.hasDeadZones !== undefined ? !!initialValues.hasDeadZones : false,
      numRegularlyOpenedPorts: initialValues.numRegularlyOpenedPorts || null,
      
      // Environmental properties
      interiorWorkingSurfaceTypes: initialValues.interiorWorkingSurfaceTypes || [],
      microbialRiskZone: initialValues.microbialRiskZone || 'Medium',
      quantityDeadzones: initialValues.quantityDeadzones || null,
      ventilationStrategy: initialValues.ventilationStrategy || null,
    },
    validationSchema: SiteTemplateFormSchema,
    onSubmit: async (values) => {
      // Create submission defaults object
      const submissionDefaults: SubmissionDefaults = {
        temperature: Number(values.temperature),
        humidity: Number(values.humidity),
        airflow: values.airflow as 'Open' | 'Closed',
        odor_distance: values.odorDistance as '5-10ft' | '10-25ft' | '25-50ft' | '50-100ft' | '>100ft',
        weather: values.weather as 'Clear' | 'Cloudy' | 'Rain',
        notes: values.notes || null,
        indoor_temperature: values.indoor_temperature ? Number(values.indoor_temperature) : null,
        indoor_humidity: values.indoor_humidity ? Number(values.indoor_humidity) : null,
      };
      
      // Collect site properties
      const siteProperties = {
        squareFootage: values.squareFootage,
        cubicFootage: values.cubicFootage,
        numVents: values.numVents,
        ventPlacements: values.ventPlacements,
        primaryFunction: values.primaryFunction,
        constructionMaterial: values.constructionMaterial,
        insulationType: values.insulationType,
        hvacSystemPresent: values.hvacSystemPresent,
        hvacSystemType: values.hvacSystemType,
        irrigationSystemType: values.irrigationSystemType,
        lightingSystem: values.lightingSystem,
        length: values.length,
        width: values.width,
        height: values.height,
        minEfficaciousGasifierDensity: values.minEfficaciousGasifierDensity,
        hasDeadZones: values.hasDeadZones,
        numRegularlyOpenedPorts: values.numRegularlyOpenedPorts,
        interiorWorkingSurfaceTypes: values.interiorWorkingSurfaceTypes,
        microbialRiskZone: values.microbialRiskZone,
        quantityDeadzones: values.quantityDeadzones,
        ventilationStrategy: values.ventilationStrategy,
      };
      
      await onSubmit(values.siteName, submissionDefaults, petriTemplates, gasifierTemplates, siteProperties);
    },
  });
  
  // Handle adding a new petri template
  const handleAddPetriTemplate = () => {
    // Create a unique ID for the new template
    const newTemplateId = `petri-${uuidv4()}`;
    const newTemplate: PetriDefaults & { id?: string } = {
      id: newTemplateId,
      petri_code: `PETRI-${Math.floor(Math.random() * 1000)}`,
      plant_type: 'Other Fresh Perishable',
      fungicide_used: 'No',
      surrounding_water_schedule: 'Daily',
      notes: '',
    };
    setPetriTemplates([...petriTemplates, newTemplate]);
    
    // Scroll to the new template after it's rendered
    setTimeout(() => {
      const newTemplateElement = document.getElementById(`petri-template-${petriTemplates.length}`);
      if (newTemplateElement) {
        newTemplateElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };
  
  // Handle removing a petri template
  const handleRemovePetriTemplate = (index: number) => {
    const updatedTemplates = [...petriTemplates];
    updatedTemplates.splice(index, 1);
    setPetriTemplates(updatedTemplates);
  };
  
  // Handle updating a petri template
  const handleUpdatePetriTemplate = (index: number, updatedTemplate: PetriDefaults) => {
    const updatedTemplates = [...petriTemplates];
    updatedTemplates[index] = updatedTemplate;
    setPetriTemplates(updatedTemplates);
  };
  
  // Handle adding a new gasifier template
  const handleAddGasifierTemplate = () => {
    // Create a unique ID for the new template
    const newTemplateId = `gasifier-${uuidv4()}`;
    const newTemplate: GasifierDefaults & { id?: string } = {
      id: newTemplateId,
      gasifier_code: `GAS-${Math.floor(Math.random() * 1000)}`,
      chemical_type: 'CLO2',
      placement_height: 'Medium',
      directional_placement: 'Center-Center',
      placement_strategy: 'Centralized Coverage',
      notes: '',
    };
    setGasifierTemplates([...gasifierTemplates, newTemplate]);
    
    // Scroll to the new template after it's rendered
    setTimeout(() => {
      const newTemplateElement = document.getElementById(`gasifier-template-${gasifierTemplates.length}`);
      if (newTemplateElement) {
        newTemplateElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };
  
  // Handle removing a gasifier template
  const handleRemoveGasifierTemplate = (index: number) => {
    const updatedTemplates = [...gasifierTemplates];
    updatedTemplates.splice(index, 1);
    setGasifierTemplates(updatedTemplates);
  };
  
  // Handle updating a gasifier template
  const handleUpdateGasifierTemplate = (index: number, updatedTemplate: GasifierDefaults) => {
    const updatedTemplates = [...gasifierTemplates];
    updatedTemplates[index] = updatedTemplate;
    setGasifierTemplates(updatedTemplates);
  };
  
  // Calculate square footage and cubic footage when dimensions change
  useEffect(() => {
    const { length, width, height } = formik.values;
    
    if (length && width) {
      // Calculate square footage
      const calculatedSquareFootage = length * width;
      // Only update if different from current value
      if (formik.values.squareFootage !== calculatedSquareFootage) {
        formik.setFieldValue('squareFootage', calculatedSquareFootage);
      }
      
      // Calculate cubic footage if height is provided
      if (height) {
        const calculatedCubicFootage = calculatedSquareFootage * height;
        // Only update if different from current value
        if (formik.values.cubicFootage !== calculatedCubicFootage) {
          formik.setFieldValue('cubicFootage', calculatedCubicFootage);
        }
      }
    }
  }, [formik.values.length, formik.values.width, formik.values.height]);
  
  // Toggle a section's expanded state
  const toggleSection = (section: 'siteInfo' | 'environment' | 'petri' | 'gasifier') => {
    setIsSectionExpanded({
      ...isSectionExpanded,
      [section]: !isSectionExpanded[section],
    });
  };

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-6">
      {/* Site Information Section */}
      <div className="border rounded-lg overflow-hidden">
        <button
          type="button"
          className="w-full p-4 bg-gray-50 flex justify-between items-center text-left"
          onClick={() => toggleSection('siteInfo')}
        >
          <span className="font-medium">Site Information</span>
          {isSectionExpanded.siteInfo ? (
            <span className="text-gray-500">▼</span>
          ) : (
            <span className="text-gray-500">▶</span>
          )}
        </button>
        
        {isSectionExpanded.siteInfo && (
          <div className="p-4 space-y-4 animate-fade-in">
            <Input
              label="Site Name"
              id="siteName"
              name="siteName"
              placeholder="Enter site name"
              value={formik.values.siteName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.siteName && formik.errors.siteName ? formik.errors.siteName : undefined}
            />
            
            <h3 className="font-medium mt-4">Site Dimensions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Length (feet)"
                id="length"
                name="length"
                type="number"
                placeholder="Enter length"
                value={formik.values.length || ''}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.length && formik.errors.length ? formik.errors.length : undefined}
              />
              
              <Input
                label="Width (feet)"
                id="width"
                name="width"
                type="number"
                placeholder="Enter width"
                value={formik.values.width || ''}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.width && formik.errors.width ? formik.errors.width : undefined}
              />
              
              <Input
                label="Height (feet)"
                id="height"
                name="height"
                type="number"
                placeholder="Enter height"
                value={formik.values.height || ''}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.height && formik.errors.height ? formik.errors.height : undefined}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Square Footage"
                id="squareFootage"
                name="squareFootage"
                type="number"
                placeholder="Calculated from length and width"
                value={formik.values.squareFootage || ''}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.squareFootage && formik.errors.squareFootage ? formik.errors.squareFootage : undefined}
                disabled={!!(formik.values.length && formik.values.width)}
              />
              
              <Input
                label="Cubic Footage"
                id="cubicFootage"
                name="cubicFootage"
                type="number"
                placeholder="Calculated from length, width, and height"
                value={formik.values.cubicFootage || ''}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.cubicFootage && formik.errors.cubicFootage ? formik.errors.cubicFootage : undefined}
                disabled={!!(formik.values.length && formik.values.width && formik.values.height)}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Recommendations Summary Section */}
      <div className="border rounded-lg overflow-hidden mb-6">
        <button
          type="button"
          className="w-full p-4 bg-gray-50 flex justify-between items-center text-left"
          onClick={() => toggleSection('recommendations')}
        >
          <span className="font-medium">Recommendations Summary</span>
          {isSectionExpanded.recommendations ? (
            <span className="text-gray-500">▼</span>
          ) : (
            <span className="text-gray-500">▶</span>
          )}
        </button>
        
        {isSectionExpanded.recommendations && (
          <div className="p-4 space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Min. Efficacious Gasifier Density (sq ft per bag)"
                id="minEfficaciousGasifierDensity"
                name="minEfficaciousGasifierDensity"
                type="number"
                placeholder="Default: 2000"
                value={formik.values.minEfficaciousGasifierDensity || ''}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.minEfficaciousGasifierDensity && formik.errors.minEfficaciousGasifierDensity ? formik.errors.minEfficaciousGasifierDensity : undefined}
              />
              
              {formik.values.squareFootage && formik.values.minEfficaciousGasifierDensity && (
                <div className="border rounded-md p-3 bg-gray-50">
                  <p className="text-sm text-gray-500">Recommended Gasifier Bags</p>
                  <p className="font-medium">
                    {Math.ceil(formik.values.squareFootage / formik.values.minEfficaciousGasifierDensity)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Based on {formik.values.squareFootage} sq ft ÷ {formik.values.minEfficaciousGasifierDensity} sq ft per bag
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Environmental Settings Section */}
      <div className="border rounded-lg overflow-hidden">
        <button
          type="button"
          className="w-full p-4 bg-gray-50 flex justify-between items-center text-left"
          onClick={() => toggleSection('environment')}
        >
          <span className="font-medium">Environmental Settings</span>
          {isSectionExpanded.environment ? (
            <span className="text-gray-500">▼</span>
          ) : (
            <span className="text-gray-500">▶</span>
          )}
        </button>
        
        {isSectionExpanded.environment && (
          <div className="p-4 space-y-4 animate-fade-in">
            <h3 className="font-medium">Facility Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="primaryFunction" className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Function
                </label>
                <select
                  id="primaryFunction"
                  name="primaryFunction"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formik.values.primaryFunction || ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                >
                  <option value="">Select primary function</option>
                  {primaryFunctionOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="constructionMaterial" className="block text-sm font-medium text-gray-700 mb-1">
                  Construction Material
                </label>
                <select
                  id="constructionMaterial"
                  name="constructionMaterial"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formik.values.constructionMaterial || ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                >
                  <option value="">Select construction material</option>
                  {constructionMaterialOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="insulationType" className="block text-sm font-medium text-gray-700 mb-1">
                  Insulation Type
                </label>
                <select
                  id="insulationType"
                  name="insulationType"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formik.values.insulationType || ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                >
                  <option value="">Select insulation type</option>
                  {insulationTypeOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="ventilationStrategy" className="block text-sm font-medium text-gray-700 mb-1">
                  Ventilation Strategy
                </label>
                <select
                  id="ventilationStrategy"
                  name="ventilationStrategy"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formik.values.ventilationStrategy || ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                >
                  <option value="">Select ventilation strategy</option>
                  {ventilationStrategyOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Interior Working Surface Types
              </label>
              <div className="space-y-2 border border-gray-300 rounded-md p-3">
                {interiorWorkingSurfaceOptions.map(option => (
                  <div key={option} className="flex items-center">
                    <input
                      id={`surface-${option}`}
                      name="interiorWorkingSurfaceTypes"
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      value={option}
                      checked={formik.values.interiorWorkingSurfaceTypes?.includes(option) || false}
                      onChange={(e) => {
                        const currentValues = formik.values.interiorWorkingSurfaceTypes || [];
                        if (e.target.checked) {
                          formik.setFieldValue('interiorWorkingSurfaceTypes', [...currentValues, option]);
                        } else {
                          formik.setFieldValue(
                            'interiorWorkingSurfaceTypes',
                            currentValues.filter(val => val !== option)
                          );
                        }
                      }}
                    />
                    <label htmlFor={`surface-${option}`} className="ml-2 text-sm text-gray-700">
                      {option}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <label htmlFor="microbialRiskZone" className="block text-sm font-medium text-gray-700 mb-1">
                Microbial Risk Zone
              </label>
              <select
                id="microbialRiskZone"
                name="microbialRiskZone"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={formik.values.microbialRiskZone || ''}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              >
                <option value="">Select risk zone</option>
                {microbialRiskZoneOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center mb-2">
                <input
                  id="hvacSystemPresent"
                  name="hvacSystemPresent"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={formik.values.hvacSystemPresent}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                <label htmlFor="hvacSystemPresent" className="ml-2 block text-sm text-gray-900">
                  HVAC System Present
                </label>
              </div>
              
              {formik.values.hvacSystemPresent && (
                <div>
                  <label htmlFor="hvacSystemType" className="block text-sm font-medium text-gray-700 mb-1">
                    HVAC System Type
                  </label>
                  <select
                    id="hvacSystemType"
                    name="hvacSystemType"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    value={formik.values.hvacSystemType || ''}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  >
                    <option value="">Select HVAC system type</option>
                    {hvacSystemTypeOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  {formik.touched.hvacSystemType && formik.errors.hvacSystemType ? (
                    <div className="text-error-600 text-sm mt-1">{formik.errors.hvacSystemType}</div>
                  ) : null}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center mb-2">
                <input
                  id="hasDeadZones"
                  name="hasDeadZones"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={formik.values.hasDeadZones}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                <label htmlFor="hasDeadZones" className="ml-2 block text-sm text-gray-900">
                  Has Dead Zones (areas with poor air circulation)
                </label>
              </div>
              
              {/* Add conditional rendering for quantityDeadzones */}
              {formik.values.hasDeadZones && (
                <div>
                  <Input
                    label="Quantity of Dead Zones"
                    id="quantityDeadzones"
                    name="quantityDeadzones"
                    type="number"
                    placeholder="Enter quantity (1-25)"
                    value={formik.values.quantityDeadzones || ''}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.quantityDeadzones && formik.errors.quantityDeadzones ? formik.errors.quantityDeadzones : undefined}
                  />
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Number of Regularly Opened Ports/Doors"
                id="numRegularlyOpenedPorts"
                name="numRegularlyOpenedPorts"
                type="number"
                placeholder="Enter number"
                value={formik.values.numRegularlyOpenedPorts || ''}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.numRegularlyOpenedPorts && formik.errors.numRegularlyOpenedPorts ? formik.errors.numRegularlyOpenedPorts : undefined}
              />
              
              <div>
                <label htmlFor="numVents" className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Ventilation Points
                </label>
                <input
                  id="numVents"
                  name="numVents"
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter number of vents"
                  value={formik.values.numVents || ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                {formik.touched.numVents && formik.errors.numVents && (
                  <p className="mt-1 text-sm text-error-600">{formik.errors.numVents}</p>
                )}
              </div>
            </div>
            
            <h3 className="font-medium mt-4">Default Environmental Values</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Default Temperature (°F)"
                id="temperature"
                name="temperature"
                type="number"
                value={formik.values.temperature}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.temperature && formik.errors.temperature ? formik.errors.temperature : undefined}
              />
              
              <Input
                label="Default Humidity (%)"
                id="humidity"
                name="humidity"
                type="number"
                value={formik.values.humidity}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.humidity && formik.errors.humidity ? formik.errors.humidity : undefined}
              />
              
              <Input
                label="Default Indoor Temperature (°F)"
                id="indoor_temperature"
                name="indoor_temperature"
                type="number"
                placeholder="32-120°F"
                value={formik.values.indoor_temperature}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.indoor_temperature && formik.errors.indoor_temperature ? formik.errors.indoor_temperature : undefined}
              />
              
              <Input
                label="Default Indoor Humidity (%)"
                id="indoor_humidity"
                name="indoor_humidity"
                type="number"
                placeholder="1-100%"
                value={formik.values.indoor_humidity}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.indoor_humidity && formik.errors.indoor_humidity ? formik.errors.indoor_humidity : undefined}
              />
              
              <div>
                <label htmlFor="airflow" className="block text-sm font-medium text-gray-700 mb-1">
                  Default Airflow
                </label>
                <select
                  id="airflow"
                  name="airflow"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formik.values.airflow}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                >
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                </select>
                {formik.touched.airflow && formik.errors.airflow ? (
                  <div className="text-error-600 text-sm mt-1">{formik.errors.airflow}</div>
                ) : null}
              </div>
              
              <div>
                <label htmlFor="odorDistance" className="block text-sm font-medium text-gray-700 mb-1">
                  Default Odor Distance
                </label>
                <select
                  id="odorDistance"
                  name="odorDistance"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formik.values.odorDistance}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                >
                  <option value="5-10ft">5-10 ft</option>
                  <option value="10-25ft">10-25 ft</option>
                  <option value="25-50ft">25-50 ft</option>
                  <option value="50-100ft">50-100 ft</option>
                  <option value=">100ft">More than 100 ft</option>
                </select>
                {formik.touched.odorDistance && formik.errors.odorDistance ? (
                  <div className="text-error-600 text-sm mt-1">{formik.errors.odorDistance}</div>
                ) : null}
              </div>
              
              <div>
                <label htmlFor="weather" className="block text-sm font-medium text-gray-700 mb-1">
                  Default Weather
                </label>
                <select
                  id="weather"
                  name="weather"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formik.values.weather}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                >
                  <option value="Clear">Clear</option>
                  <option value="Cloudy">Cloudy</option>
                  <option value="Rain">Rain</option>
                </select>
                {formik.touched.weather && formik.errors.weather ? (
                  <div className="text-error-600 text-sm mt-1">{formik.errors.weather}</div>
                ) : null}
              </div>
              
              <div className="md:col-span-2">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Default Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter default notes for submissions at this site"
                  value={formik.values.notes}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Petri Template Section */}
      <div className="border rounded-lg overflow-hidden">
        <button
          type="button"
          className="w-full p-4 bg-gray-50 flex justify-between items-center text-left"
          onClick={() => toggleSection('petri')}
        >
          <span className="font-medium">Petri Sample Defaults</span>
          {isSectionExpanded.petri ? (
            <span className="text-gray-500">▼</span>
          ) : (
            <span className="text-gray-500">▶</span>
          )}
        </button>
        
        {isSectionExpanded.petri && (
          <div className="p-4 space-y-4 animate-fade-in">
            {petriTemplates.map((template, index) => (
              <div
                key={index}
                id={`petri-template-${index}`}
              >
                <NewSitePetriTemplateForm
                  index={index}
                  template={template}
                  onUpdate={(data) => handleUpdatePetriTemplate(index, data)}
                  onRemove={() => handleRemovePetriTemplate(index)}
                  testId={`petri-template-${index}`}
                />
              </div>
            ))}
            
            <div className="flex justify-center mt-6">
              <Button
                type="button"
                variant="primary"
                onClick={handleAddPetriTemplate}
                testId="add-petri-template-button"
              >
                Add Petri Template
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Gasifier Template Section */}
      <div className="border rounded-lg overflow-hidden">
        <button
          type="button"
          className="w-full p-4 bg-gray-50 flex justify-between items-center text-left"
          onClick={() => toggleSection('gasifier')}
        >
          <span className="font-medium">Gasifier Sample Defaults</span>
          {isSectionExpanded.gasifier ? (
            <span className="text-gray-500">▼</span>
          ) : (
            <span className="text-gray-500">▶</span>
          )}
        </button>
        
        {isSectionExpanded.gasifier && (
          <div className="p-4 space-y-4 animate-fade-in">
            {gasifierTemplates.map((template, index) => (
              <div
                key={index}
                id={`gasifier-template-${index}`}
              >
                <NewSiteGasifierTemplateForm
                  index={index}
                  template={template}
                  onUpdate={(data) => handleUpdateGasifierTemplate(index, data)}
                  onRemove={() => handleRemoveGasifierTemplate(index)}
                  testId={`gasifier-template-${index}`}
                />
              </div>
            ))}
            
            <div className="flex justify-center mt-6">
              <Button
                type="button"
                variant="primary"
                onClick={handleAddGasifierTemplate}
                testId="add-gasifier-template-button"
              >
                Add Gasifier Template
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Form Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
         // Debug logging to see why the button might be disabled
         onClick={() => {
           console.log('Form submission attempted');
           console.log('isLoading:', isLoading);
           console.log('formik.isValid:', formik.isValid);
           console.log('formik.dirty:', formik.dirty);
           console.log('formik.errors:', formik.errors);
           console.log('formik.touched:', formik.touched);
         }}
        >
          Save Template
        </Button>
      </div>
    </form>
  );
};

export default SiteTemplateForm;