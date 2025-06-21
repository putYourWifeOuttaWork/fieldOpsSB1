import { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Copy, Calendar, Info, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import { PilotProgram } from '../../lib/types';
import { format, addDays } from 'date-fns';
import useProgramCloning from '../../hooks/useProgramCloning';
import { toast } from 'react-toastify';

interface CloneProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  program: PilotProgram;
  onProgramCloned?: (newProgramId: string) => void;
}

const CloneProgramSchema = Yup.object().shape({
  name: Yup.string()
    .required('Program name is required')
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be at most 100 characters'),
  description: Yup.string()
    .required('Description is required')
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be at most 500 characters'),
  startDate: Yup.date()
    .required('Start date is required'),
  endDate: Yup.date()
    .min(
      Yup.ref('startDate'),
      'End date must be after start date'
    )
    .required('End date is required'),
  showAdvancedOptions: Yup.boolean(),
});

const CloneProgramModal = ({ 
  isOpen, 
  onClose, 
  program,
  onProgramCloned
}: CloneProgramModalProps) => {
  const { cloneProgram, getProgramPhases, loading, error } = useProgramCloning();
  const [phases, setPhases] = useState<any[]>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Fetch program phases when modal opens
  useEffect(() => {
    if (isOpen && program) {
      const fetchPhases = async () => {
        const phases = await getProgramPhases(program.program_id);
        if (phases) {
          setPhases(phases);
        }
      };
      
      fetchPhases();
    }
  }, [isOpen, program, getProgramPhases]);
  
  // Calculate suggested dates for the next phase
  const calculateNextPhaseDates = () => {
    const today = new Date();
    const suggestedStartDate = format(today, 'yyyy-MM-dd');
    const suggestedEndDate = format(addDays(today, 14), 'yyyy-MM-dd');
    
    return { suggestedStartDate, suggestedEndDate };
  };
  
  const { suggestedStartDate, suggestedEndDate } = calculateNextPhaseDates();
  
  const formik = useFormik({
    initialValues: {
      name: `${program?.name} - Next Phase`,
      description: program?.description || '',
      startDate: suggestedStartDate,
      endDate: suggestedEndDate,
      showAdvancedOptions: false,
      // Advanced options could be added here
    },
    validationSchema: CloneProgramSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        // Prepare site overrides (if any)
        const siteOverrides = {}; // This would be populated from advanced options
        
        const result = await cloneProgram({
          sourceProgram: program,
          newName: values.name,
          newDescription: values.description,
          newStartDate: values.startDate,
          newEndDate: values.endDate,
          siteOverrides
        });
        
        if (result && result.success) {
          if (onProgramCloned) {
            onProgramCloned(result.program_id);
          }
          onClose();
        }
      } catch (error) {
        console.error('Error cloning program:', error);
        toast.error('Failed to clone program');
      } finally {
        setSubmitting(false);
      }
    },
  });
  
  const toggleAdvancedOptions = () => {
    setShowAdvancedOptions(!showAdvancedOptions);
    formik.setFieldValue('showAdvancedOptions', !showAdvancedOptions);
  };
  
  // Get the next phase number
  const getNextPhaseNumber = () => {
    if (!phases || phases.length === 0) return 1;
    
    const phaseNumbers = phases.map(phase => parseInt(phase.phase_number) || 0);
    return Math.max(...phaseNumbers) + 1;
  };
  
  const nextPhaseNumber = getNextPhaseNumber();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center">
          <Copy className="mr-2 h-5 w-5 text-primary-600" />
          <h2 className="text-xl font-semibold">Clone Program</h2>
        </div>
      }
      maxWidth="2xl"
    >
      <form onSubmit={formik.handleSubmit} className="p-4">
        {/* Source Program Info */}
        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-md font-medium mb-2 flex items-center">
            <Info className="mr-2 h-4 w-4 text-gray-500" />
            Source Program
          </h3>
          <p className="text-sm text-gray-700 mb-2">
            <span className="font-medium">Name:</span> {program?.name}
          </p>
          <p className="text-sm text-gray-700 mb-2">
            <span className="font-medium">Date Range:</span> {program?.start_date && program?.end_date ? 
              `${format(new Date(program.start_date), 'PP')} to ${format(new Date(program.end_date), 'PP')}` : 
              'Not specified'}
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-medium">Sites:</span> {program?.total_sites || 0}
          </p>
        </div>
        
        {/* Phase Information */}
        <div className="mb-6 bg-primary-50 p-4 rounded-lg border border-primary-200">
          <h3 className="text-md font-medium mb-2 flex items-center">
            <Calendar className="mr-2 h-4 w-4 text-primary-600" />
            Creating Phase {nextPhaseNumber}
          </h3>
          <p className="text-sm text-primary-700">
            This will create a new program as Phase {nextPhaseNumber} in the sequence, 
            copying all sites and their templates from {program?.name}.
          </p>
        </div>
        
        {/* New Program Details */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-4">New Program Details</h3>
          
          <Input
            label="Program Name"
            id="name"
            name="name"
            placeholder="Enter program name"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name && formik.errors.name ? formik.errors.name : undefined}
            autoFocus
          />
          
          <div className="mb-4">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter program description"
              value={formik.values.description}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            ></textarea>
            {formik.touched.description && formik.errors.description && (
              <p className="mt-1 text-sm text-error-600">{formik.errors.description}</p>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              id="startDate"
              name="startDate"
              type="date"
              value={formik.values.startDate}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.startDate && formik.errors.startDate ? formik.errors.startDate : undefined}
            />
            
            <Input
              label="End Date"
              id="endDate"
              name="endDate"
              type="date"
              value={formik.values.endDate}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.endDate && formik.errors.endDate ? formik.errors.endDate : undefined}
            />
          </div>
        </div>
        
        {/* Advanced Options Toggle */}
        <div className="mb-6">
          <button
            type="button"
            className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
            onClick={toggleAdvancedOptions}
          >
            {showAdvancedOptions ? (
              <ChevronUp size={16} className="mr-1" />
            ) : (
              <ChevronDown size={16} className="mr-1" />
            )}
            Advanced Options
          </button>
          
          {showAdvancedOptions && (
            <div className="mt-4 p-4 border border-gray-200 rounded-lg animate-fade-in">
              <div className="flex items-center mb-4">
                <AlertTriangle size={16} className="text-warning-500 mr-2" />
                <p className="text-sm text-gray-700">
                  Advanced options are not yet implemented. In the future, you'll be able to override specific site properties here.
                </p>
              </div>
              
              {/* Placeholder for future advanced options */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500 italic">
                  Future options will include:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-500 mt-2">
                  <li>Gasifier density overrides</li>
                  <li>Placement strategy changes</li>
                  <li>Petri observation template adjustments</li>
                  <li>Environmental setting modifications</li>
                </ul>
              </div>
            </div>
          )}
        </div>
        
        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-error-50 border border-error-200 text-error-700 rounded-md">
            {error}
          </div>
        )}
        
        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button 
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            variant="primary"
            isLoading={formik.isSubmitting || loading}
            disabled={!(formik.isValid && formik.dirty)}
            icon={<Copy size={16} />}
          >
            Clone Program
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CloneProgramModal;