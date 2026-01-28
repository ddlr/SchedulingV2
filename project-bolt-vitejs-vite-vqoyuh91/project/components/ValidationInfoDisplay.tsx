
import React, { useState, useEffect } from 'react';
import { ValidationError } from '../types';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

interface ValidationInfoDisplayProps {
  errors: ValidationError[] | null;
  score?: number | null;
  title?: string;
}

const ValidationInfoDisplay: React.FC<ValidationInfoDisplayProps> = ({ 
  errors, 
  score, 
  title = "Schedule Validation Info" 
}) => {
  // Default to true so users see errors immediately
  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-expand when errors change to ensure visibility of new issues
  useEffect(() => {
    if (errors && errors.length > 0) {
      setIsExpanded(true);
    }
  }, [errors]);

  if (!errors || errors.length === 0) return null;

  // Determine health color based on score (Lower is better for penalty score)
  // Assuming 0 is perfect, < 500 is good, < 2000 is warning, > 2000 is bad
  let scoreColorClass = "text-slate-600 bg-slate-100 border-slate-200";
  let healthLabel = "Unknown";
  
  if (score !== undefined && score !== null) {
      if (score === 0) {
          scoreColorClass = "text-green-700 bg-green-100 border-green-200";
          healthLabel = "Perfect";
      } else if (score < 500) {
          scoreColorClass = "text-emerald-700 bg-emerald-100 border-emerald-200";
          healthLabel = "Excellent";
      } else if (score < 2000) {
          scoreColorClass = "text-amber-700 bg-amber-100 border-amber-200";
          healthLabel = "Good";
      } else {
          scoreColorClass = "text-red-700 bg-red-100 border-red-200";
          healthLabel = "Needs Work";
      }
  }

  // Count hard vs soft violations roughly based on naming
  const hardErrors = errors.filter(e => e.ruleId.includes('CONFLICT') || e.ruleId.includes('MISMATCH') || e.ruleId.includes('LIMIT')).length;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm mb-6 overflow-hidden transition-all duration-200">
      <div 
        className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors select-none"
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? "Click to collapse" : "Click to expand details"}
      >
        <div className="flex flex-wrap items-center gap-3 flex-1">
            <h3 className="font-semibold text-slate-700 whitespace-nowrap">{title}</h3>
            
            {/* Score Display at the top */}
            {score !== undefined && score !== null && (
                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${scoreColorClass} flex items-center gap-2`}>
                    <span>Fitness Score: {score.toFixed(0)}</span>
                    <span className="opacity-75 border-l pl-2 border-current">{healthLabel}</span>
                </div>
            )}

            <div className="flex-grow"></div>

            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                {errors.length} Issue{errors.length !== 1 ? 's' : ''} 
                {hardErrors > 0 && <span className="text-red-600 ml-1 font-semibold">({hardErrors} Critical)</span>}
            </span>
        </div>
        <button 
            className="ml-4 text-slate-400 hover:text-slate-600 transition-transform duration-200 p-1"
            aria-label={isExpanded ? "Collapse validation info" : "Expand validation info"}
        >
            <ChevronDownIcon className={`w-5 h-5 transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isExpanded && (
        <div className="p-4 bg-red-50 border-t border-red-100 animate-fadeIn">
            <ul className="list-disc list-inside space-y-1 text-sm text-red-700 max-h-96 overflow-y-auto">
                {errors.map((err, index) => (
                    <li key={index} className="leading-relaxed">
                        <strong className="capitalize text-red-800">{err.ruleId.replace(/_/g, ' ').toLowerCase()}:</strong> {err.message}
                    </li>
                ))}
            </ul>
        </div>
      )}
    </div>
  );
};

export default ValidationInfoDisplay;
