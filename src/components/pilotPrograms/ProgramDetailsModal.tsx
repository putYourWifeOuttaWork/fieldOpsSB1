import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Calendar, FileText, Building, Users, Edit, Trash2, History, Clock, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import { PilotProgram } from '../../lib/types';
import { format } from 'date-fns';
import useUserRole from '../../hooks/useUserRole';
import { toast } from 'react-toastify';
import ProgramUsersModal from '../users/ProgramUsersModal';
import usePilotPrograms from '../../hooks/usePilotPrograms';
import useProgramCloning from '../../hooks/useProgramCloning';

interface ProgramDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  program: PilotProgram;
  onDelete?: () => void;
}

const ProgramSchema = Yup.object().shape({
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

const ProgramDetailsModal = ({ 
  isOpen, 
  onClose, 
  program,
  onDelete
}: ProgramDetailsModalProps) => {
  const navigate = useNavigate();
  const { updateProgram, deleteProgram } = usePilotPrograms();
  const { isAdmin, canManageUsers, canViewAuditLog } = useUserRole({ programId: program.program_id });
  const { getProgramLineage, getProgramPhases, loading: cloningLoading } = useProgramCloning();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [programPhases, setProgramPhases] = useState<any[] | null>(null);
  const [programLineage, setProgramLineage] = useState<any[] | null>(null);
  const [showPhases, setShowPhases] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Fetch program phases and lineage when modal is opened
  const fetchProgramMetadata = async () => {
    if (!program || !isOpen) return;
    
    setLoading(true);
    try {
      // Fetch phases
      const phases = await getProgramPhases(program.program_id);
      setProgramPhases(phases);
      
      // Fetch lineage
      const lineage = await getProgramLineage(program.program_id);
      setProgramLineage(lineage);
    } catch (error) {
      console.error('Error fetching program metadata:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Call fetchProgramMetadata when the modal is opened
  useState(() => {
    if (isOpen && program) {
      fetchProgramMetadata();
    }
  });
  
  const formik = useFormik({
    initialValues: {
      name: program.name,
      description: program.description,
      startDate: program.start_date,
      endDate: program.end_date,
    },
    validationSchema: ProgramSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        const updated = await updateProgram(program.program_id, {
          name: values.name,
          description: values.description,
          start_date: values.startDate,
          end_date: values.endDate,
        });
        
        if (updated) {
          toast.success('Program updated successfully');
          setIsEditing(false);
        }
      } catch (error) {
        console.error('Error updating program:', error);
        toast.error('Failed to update program');
      } finally {
        setSubmitting(false);
      }
    },
  });
  
  const handleDelete = async () => {
    try {
      const deleted = await deleteProgram(program.program_id);
      
      if (deleted) {
        toast.success('Program deleted successfully');
        onClose();
        if (onDelete) onDelete();
      }
    } catch (error) {
      console.error('Error deleting program:', error);
      toast.error('Failed to delete program');
    }
  };

  const viewAuditLog = () => {
    onClose();
    navigate(`/programs/${program.program_id}/audit-log`);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Program Details"
        maxWidth="2xl"
      >
        <div className="p-4">
          {isEditing ? (
            <form onSubmit={formik.handleSubmit}>
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
              
              <div className="flex justify-end space-x-3 mt-6">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  variant="primary"
                  isLoading={formik.isSubmitting}
                  disabled={!(formik.isValid && formik.dirty)}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <div className="flex justify-between mb-4">
                <h3 className="text-xl font-semibold">{program.name}</h3>
                {isAdmin && (
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Edit size={14} />}
                      onClick={() => setIsEditing(true)}
                      testId="edit-program-button"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Copy size={14} />}
                      onClick={() => {
                        onClose();
                        // Delay to allow this modal to close before opening the clone modal
                        setTimeout(() => {
                          navigate(`/programs`);
                          // This would ideally trigger the clone modal directly
                          // but we'll let the PilotProgramsPage handle it
                        }, 100);
                      }}
                      testId="clone-program-button"
                    >
                      Clone
                    </Button>
                    {canManageUsers && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Users size={14} />}
                        onClick={() => setIsUsersModalOpen(true)}
                        testId="manage-users-button"
                      >
                        Manage Users
                      </Button>
                    )}
                    {canViewAuditLog && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<History size={14} />}
                        onClick={viewAuditLog}
                        testId="view-audit-log-button"
                      >
                        Audit Log
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 whitespace-pre-line">{program.description}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="flex items-center">
                  <Calendar className="text-primary-500 mr-2" size={18} />
                  <div>
                    <p className="text-sm text-gray-500">Start Date</p>
                    <p className="font-medium">{format(new Date(program.start_date), 'PP')}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <Calendar className="text-primary-500 mr-2" size={18} />
                  <div>
                    <p className="text-sm text-gray-500">End Date</p>
                    <p className="font-medium">{format(new Date(program.end_date), 'PP')}</p>
                  </div>
                </div>
              </div>
              
              {/* Program Phases Section */}
              {program.phases && Array.isArray(program.phases) && program.phases.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-gray-700">Program Phases</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPhases(!showPhases)}
                      icon={showPhases ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    >
                      {showPhases ? 'Hide Phases' : 'Show Phases'}
                    </Button>
                  </div>
                  
                  {showPhases && (
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 animate-fade-in">
                      {loading || cloningLoading ? (
                        <div className="flex justify-center p-6">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        </div>
                      ) : programPhases && programPhases.length > 0 ? (
                        <div className="space-y-3">
                          {programPhases.map((phase, index) => (
                            <div key={index} className="p-3 border border-gray-200 rounded bg-white">
                              <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center">
                                  <Clock size={16} className="text-primary-600 mr-2" />
                                  <h5 className="font-medium">Phase {phase.phase_number}: {phase.label}</h5>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-800">
                                  {phase.phase_type}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                                <p className="text-gray-600">
                                  <span className="font-medium">Start:</span> {format(new Date(phase.start_date), 'PP')}
                                </p>
                                <p className="text-gray-600">
                                  <span className="font-medium">End:</span> {format(new Date(phase.end_date), 'PP')}
                                </p>
                              </div>
                              {phase.notes && (
                                <p className="text-sm text-gray-600 mt-2">{phase.notes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-600 text-center py-4">No phases found for this program.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className="border rounded-lg p-4 bg-gray-50 mb-6">
                <h4 className="font-medium mb-2">Program Statistics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <Building className="text-secondary-500 mr-2" size={18} />
                    <div>
                      <p className="text-sm text-gray-500">Total Sites</p>
                      <p className="font-medium">{program.total_sites}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <FileText className="text-secondary-500 mr-2" size={18} />
                    <div>
                      <p className="text-sm text-gray-500">Total Submissions</p>
                      <p className="font-medium">{program.total_submissions}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Program Lineage */}
              {program.cloned_from_program_id && (
                <div className="mb-6 bg-primary-50 p-4 rounded-lg border border-primary-200">
                  <h4 className="font-medium mb-2 flex items-center">
                    <Copy className="text-primary-600 mr-2" size={16} />
                    Program Lineage
                  </h4>
                  <p className="text-sm text-primary-700">
                    This program was cloned from another program. View the full history in the program phases section.
                  </p>
                </div>
              )}
              
              <div className="flex flex-col space-y-2">
                <div className="flex items-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    program.status === 'active' 
                      ? 'bg-success-100 text-success-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    Status: {program.status.charAt(0).toUpperCase() + program.status.slice(1)}
                  </span>
                </div>
                
                <div className="text-xs text-gray-500">
                  <p>Created: {format(new Date(program.created_at), 'PPp')}</p>
                  <p>Last Updated: {format(new Date(program.updated_at), 'PPp')}</p>
                </div>
              </div>
              
              {isAdmin && (
                <div className="mt-6 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-gray-700">Danger Zone</h4>
                    {isDeleteConfirmOpen ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Are you sure?</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsDeleteConfirmOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={handleDelete}
                        >
                          Yes, Delete
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<Trash2 size={14} />}
                        onClick={() => setIsDeleteConfirmOpen(true)}
                      >
                        Delete Program
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
      
      {isUsersModalOpen && (
        <ProgramUsersModal
          isOpen={isUsersModalOpen}
          onClose={() => setIsUsersModalOpen(false)}
          programId={program.program_id}
          programName={program.name}
        />
      )}
    </>
  );
};

export default ProgramDetailsModal;