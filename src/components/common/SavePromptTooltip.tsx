import { useEffect, useRef } from 'react';
import { Save, X } from 'lucide-react';
import Button from './Button';

interface SavePromptTooltipProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  targetRef: React.RefObject<HTMLElement>;
}

const SavePromptTooltip = ({
  isOpen,
  onClose,
  onSave,
  targetRef
}: SavePromptTooltipProps) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  // Auto-close after 10 seconds
  useEffect(() => {
    if (!isOpen) return;
    
    const timer = setTimeout(() => {
      onClose();
    }, 10000);
    
    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current && 
        !tooltipRef.current.contains(event.target as Node) &&
        targetRef.current && 
        !targetRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, targetRef]);

  // Position the tooltip relative to the target
  useEffect(() => {
    if (!isOpen || !targetRef.current || !tooltipRef.current) return;
    
    const targetRect = targetRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    
    // Position in the center of target, below it
    const left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
    const top = targetRect.bottom + 10; // 10px below the target
    
    // Adjust to ensure tooltip remains in viewport
    const adjustedLeft = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));
    
    tooltipRef.current.style.left = `${adjustedLeft}px`;
    tooltipRef.current.style.top = `${top}px`;
  }, [isOpen, targetRef]);

  if (!isOpen) return null;

  return (
    <div 
      ref={tooltipRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg p-3 border border-primary-200 animate-fade-in"
      style={{ maxWidth: '200px' }}
      data-testid="save-prompt-tooltip"
    >
      <button 
        className="absolute top-1 right-1 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
        onClick={onClose}
        aria-label="Close"
        data-testid="save-prompt-close"
      >
        <X size={12} />
      </button>
      <div className="text-center pt-1">
        <p className="mb-2 text-sm font-medium text-gray-800">Want to save now?</p>
        <Button
          variant="primary"
          size="sm"
          icon={<Save size={14} />}
          onClick={() => {
            onSave();
            onClose();
          }}
          fullWidth
          testId="save-prompt-button"
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default SavePromptTooltip;