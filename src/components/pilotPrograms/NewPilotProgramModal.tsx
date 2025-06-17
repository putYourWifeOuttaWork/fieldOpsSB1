import { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { CheckCircle, XCircle } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import { usePilotProgramStore } from '../../stores/pilotProgramStore';
import usePilotPrograms from '../../hooks/usePilotPrograms';

interface NewPilotProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProgramCreated?: () => void;
}

const NewPilotProgramSchema = Yup.object().shape({
  name: Yup.string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be at most 100 characters')
    .required('Name is required'),
  description: Yup.string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be at most 500 characters')
    .required('Description is required'),
  startDate: Yup.date()
    .required('Start date is required'),
  endDate: Yup.date()
    .min(
      Yup.ref('startDate'),
      'End date must be after start date'
    )
    .required('End date is required'),
});

const NewPilotProgramModal = ({ isOpen, onClose, onProgramCreated }: NewPilotProgramModalProps) => {
  const { createProgram } = usePilotPrograms();
  const [status, setStatus] = useState('active');
  
  const formik = useFormik({
    initialValues: {
      name: '',
      description: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
    validationSchema: NewPilotProgramSchema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        const newProgram = await createProgram({
          name: values.name,
          description: values.description,
          start_date: values.startDate,
          end_date: values.endDate,
        });
        
        if (newProgram) {
          resetForm();
          onClose();
          if (onProgramCreated) {
            onProgramCreated();
          }
        }
      } finally {
        setSubmitting(false);
      }
    },
  });

  // Effect to update status when dates change
  useEffect(() => {
    const today = new Date();
    const startDate = new Date(formik.values.startDate);
    const endDate = new Date(formik.values.endDate);
    
    const newStatus = 
      (today >= startDate && today <= endDate) ? 'active' : 'inactive';
      
    setStatus(newStatus);
  }, [formik.values.startDate, formik.values.endDate]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Pilot Program"
      maxWidth="md"
    >
      <form onSubmit={formik.handleSubmit} className="p-4">
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
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            status === 'active'
              ? 'bg-success-100 text-success-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {status === 'active' ? (
              <>
                <CheckCircle size={16} className="mr-1" />
                Active
              </>
            ) : (
              <>
                <XCircle size={16} className="mr-1" />
                Inactive
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Status is automatically determined based on date range
          </p>
        </div>
        
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
            isLoading={formik.isSubmitting}
            disabled={!(formik.isValid && formik.dirty)}
          >
            Create Program
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default NewPilotProgramModal;