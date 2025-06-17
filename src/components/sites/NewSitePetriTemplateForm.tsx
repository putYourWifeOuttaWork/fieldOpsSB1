import { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import Button from '../common/Button';
import { PetriDefaults } from '../../lib/types';

interface NewSitePetriTemplateFormProps {
  index: number;
  template: PetriDefaults;
  onUpdate: (data: PetriDefaults) => void;
  onRemove: () => void;
  testId?: string;
}

const NewSitePetriTemplateForm = ({ 
  index, 
  template, 
  onUpdate, 
  onRemove,
  testId 
}: NewSitePetriTemplateFormProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleChange = (field: keyof PetriDefaults, value: any) => {
    onUpdate({
      ...template,
      [field]: value
    });
  };

  return (
    <div 
      className="border border-gray-200 rounded-lg p-3 bg-gray-50"
      data-testid={testId}
    >
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <h4 className="font-medium text-gray-900">Petri Template #{index + 1}</h4>
          <button 
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-2 p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
            title={isExpanded ? "Collapse" : "Expand"}
            data-testid={`${testId}-toggle`}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        
        <Button 
          type="button" 
          variant="danger" 
          size="sm"
          icon={<Trash2 size={16} />}
          onClick={onRemove}
          className="!py-1"
          testId={`${testId}-remove-button`}
        >
          Remove
        </Button>
      </div>
      
      {isExpanded && (
        <div className="space-y-3 animate-fade-in">
          <div>
            <label htmlFor={`petriCode-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
              Petri Code
            </label>
            <input
              id={`petriCode-${index}`}
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter petri code"
              value={template.petri_code}
              onChange={(e) => handleChange('petri_code', e.target.value)}
              data-testid={`${testId}-code-input`}
            />
          </div>
          
          <div>
            <label htmlFor={`fungicideUsed-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
              Fungicide Used on Surrounding Plants
            </label>
            <div className="flex space-x-4" data-testid={`${testId}-fungicide-radio-group`}>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name={`fungicideUsed-${index}`}
                  value="Yes"
                  checked={template.fungicide_used === 'Yes'}
                  onChange={() => handleChange('fungicide_used', 'Yes')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  data-testid={`${testId}-fungicide-yes`}
                />
                <span className="ml-2">Yes</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name={`fungicideUsed-${index}`}
                  value="No"
                  checked={template.fungicide_used === 'No'}
                  onChange={() => handleChange('fungicide_used', 'No')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  data-testid={`${testId}-fungicide-no`}
                />
                <span className="ml-2">No</span>
              </label>
            </div>
          </div>
          
          <div>
            <label htmlFor={`surroundingWaterSchedule-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
              Water Schedule For Surrounding
            </label>
            <select
              id={`surroundingWaterSchedule-${index}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={template.surrounding_water_schedule}
              onChange={(e) => handleChange('surrounding_water_schedule', e.target.value)}
              data-testid={`${testId}-water-schedule-select`}
            >
              <option value="">Select water schedule</option>
              <option value="Daily">Daily</option>
              <option value="Every Other Day">Every Other Day</option>
              <option value="Every Third Day">Every Third Day</option>
              <option value="Twice Daily">Twice Daily</option>
              <option value="Thrice Daily">Thrice Daily</option>
            </select>
          </div>
          
          <div>
            <label htmlFor={`placement-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
              Placement
            </label>
            <div className="relative">
              <div className="flex items-center">
                <MapPin size={16} className="text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <select
                  id={`placement-${index}`}
                  className="w-full pl-9 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={template.placement || ''}
                  onChange={(e) => handleChange('placement', e.target.value)}
                  data-testid={`${testId}-placement-select`}
                >
                  <option value="">Select placement</option>
                  <option value="Center-Center">Center-Center</option>
                  <option value="Center-Right">Center-Right</option>
                  <option value="Center-Left">Center-Left</option>
                  <option value="Front-Left">Front-Left</option>
                  <option value="Front-Right">Front-Right</option>
                  <option value="Front-Center">Front-Center</option>
                  <option value="Back-Center">Back-Center</option>
                  <option value="Back-Right">Back-Right</option>
                  <option value="Back-Left">Back-Left</option>
                </select>
              </div>
            </div>
          </div>
          
          <div>
            <label htmlFor={`placementDynamics-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
              Placement Dynamics
            </label>
            <select
              id={`placementDynamics-${index}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={template.placement_dynamics || ''}
              onChange={(e) => handleChange('placement_dynamics', e.target.value)}
              data-testid={`${testId}-placement-dynamics-select`}
            >
              <option value="">Select placement dynamics</option>
              <option value="Near Port">Near Port</option>
              <option value="Near Door">Near Door</option>
              <option value="Near Ventillation Out">Near Ventillation Out</option>
              <option value="Near Airflow In">Near Airflow In</option>
            </select>
          </div>
          
          <div>
            <label htmlFor={`notes-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              id={`notes-${index}`}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Optional notes"
              value={template.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              maxLength={200}
              data-testid={`${testId}-notes-textarea`}
            ></textarea>
            <p className="mt-1 text-xs text-gray-500 text-right">
              {(template.notes?.length || 0)}/200 characters
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewSitePetriTemplateForm;