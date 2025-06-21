import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Info, Copy, Tag } from 'lucide-react';
import Card, { CardHeader, CardContent, CardFooter } from '../common/Card';
import Button from '../common/Button';
import { PilotProgram } from '../../lib/types';
import { format } from 'date-fns';

interface PilotProgramCardProps {
  program: PilotProgram;
  onView: (program: PilotProgram) => void;
  onDetails: (program: PilotProgram, e: React.MouseEvent) => void;
  onClone: (program: PilotProgram, e: React.MouseEvent) => void;
  testId?: string;
}

const PilotProgramCard = ({ 
  program, 
  onView, 
  onDetails,
  onClone,
  testId 
}: PilotProgramCardProps) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  // Extract phase information if available
  const getPhaseInfo = () => {
    if (!program.phases || !Array.isArray(program.phases) || program.phases.length === 0) {
      return null;
    }

    // Get the last phase (most recent)
    const lastPhase = program.phases[program.phases.length - 1];
    
    if (!lastPhase) return null;
    
    return {
      phaseNumber: lastPhase.phase_number,
      phaseType: lastPhase.phase_type,
      phaseLabel: lastPhase.label || `Phase ${lastPhase.phase_number}`
    };
  };
  
  const phaseInfo = getPhaseInfo();

  return (
    <Card 
      hoverable
      onClick={() => onView(program)}
      className="h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      testId={testId || `program-card-${program.program_id}`}
    >
      <CardHeader testId={`program-header-${program.program_id}`}>
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold text-gray-900 truncate" title={program.name}>
            {program.name}
          </h3>
          <div className="flex items-center space-x-2">
            <span className={`pill ${
              program.status === 'active' 
                ? 'bg-success-100 text-success-800' 
                : 'bg-gray-100 text-gray-800'
            }`} data-testid={`program-status-${program.program_id}`}>
              {program.status === 'active' ? (
                <CheckCircle size={12} className="mr-1" />
              ) : (
                <XCircle size={12} className="mr-1" />
              )}
              {program.status.charAt(0).toUpperCase() + program.status.slice(1)}
            </span>
            <button 
              className="text-gray-500 hover:text-gray-700"
              onClick={(e) => onDetails(program, e)}
              aria-label="View program details"
              data-testid={`program-details-button-${program.program_id}`}
            >
              <Info size={16} />
            </button>
            <Button
              variant="outline"
              size="sm"
              icon={<Copy size={14} />}
              onClick={(e) => onClone(program, e)}
              className="!py-1 !px-2"
              testId={`clone-program-button-${program.program_id}`}
            >
              Clone
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent testId={`program-content-${program.program_id}`}>
        {phaseInfo && (
          <div className="flex items-center mb-2">
            <Tag size={14} className="text-primary-600 mr-1" />
            <span className="text-sm font-medium">
              Phase {phaseInfo.phaseNumber} {phaseInfo.phaseType && `(${phaseInfo.phaseType})`}
            </span>
          </div>
        )}
        
        <p className="text-gray-600 mb-4 line-clamp-3" title={program.description}>
          {program.description}
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center text-gray-600">
            <span className="truncate" title={`From: ${format(new Date(program.start_date), 'PP')}`}>
              From: {format(new Date(program.start_date), 'PP')}
            </span>
          </div>
          <div className="flex items-center text-gray-600">
            <span className="truncate" title={`To: ${format(new Date(program.end_date), 'PP')}`}>
              To: {format(new Date(program.end_date), 'PP')}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between text-sm text-gray-500" testId={`program-footer-${program.program_id}`}>
        <span>{program.total_sites} Sites</span>
        <span>{program.total_submissions} Submissions</span>
      </CardFooter>
    </Card>
  );
};

export default PilotProgramCard;