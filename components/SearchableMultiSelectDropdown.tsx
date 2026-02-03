
import React, { useState, useEffect, useRef } from 'react';
import { SearchableMultiSelectDropdownProps } from '../types';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { XMarkIcon } from './icons/XMarkIcon';

const SearchableMultiSelectDropdown: React.FC<SearchableMultiSelectDropdownProps> = ({
  label,
  options,
  selectedOptions,
  onChange,
  placeholder = "Select...",
  id,
  ariaLabel
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleOption = (option: string) => {
    const newSelectedOptions = selectedOptions.includes(option)
      ? selectedOptions.filter(item => item !== option)
      : [...selectedOptions, option];
    onChange(newSelectedOptions);
  };

  const handleSelectAllFiltered = () => {
    const newSelectedOptions = Array.from(new Set([...selectedOptions, ...filteredOptions]));
    onChange(newSelectedOptions);
  };

  const handleDeselectAllFiltered = () => {
    const newSelectedOptions = selectedOptions.filter(item => !filteredOptions.includes(item));
    onChange(newSelectedOptions);
  };
  
  const areAllFilteredSelected = filteredOptions.length > 0 && filteredOptions.every(opt => selectedOptions.includes(opt));

  const controlId = id || `searchable-multiselect-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="relative" ref={dropdownRef}>
      <label htmlFor={controlId} className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
        {label}
      </label>
      <div 
        className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm text-left flex items-center flex-wrap gap-2 min-h-[48px] cursor-text focus-within:ring-2 focus-within:ring-brand-blue/20 transition-all"
        onClick={() => { setIsOpen(true); inputRef.current?.focus(); }}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-owns={`${controlId}-listbox`}
        aria-label={ariaLabel || label}
      >
        {selectedOptions.map(option => (
          <span
            key={option}
            className="flex items-center bg-white border border-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-tight px-3 py-1.5 rounded-xl shadow-sm animate-in zoom-in-90 duration-200"
          >
            {option}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // Prevent opening dropdown
                handleToggleOption(option);
              }}
              className="ml-2 text-slate-300 hover:text-red-500 transition-colors"
              aria-label={`Remove ${option}`}
            >
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={controlId}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if(!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedOptions.length === 0 ? placeholder : ''}
          className="flex-grow bg-transparent p-1 outline-none text-sm text-slate-700 placeholder:text-slate-300 font-medium min-w-[80px]"
          aria-autocomplete="list"
          aria-controls={`${controlId}-listbox`}
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className="p-1 text-slate-300 hover:text-slate-500 transition-colors"
          aria-label={isOpen ? "Close dropdown" : "Open dropdown"}
        >
          <ChevronDownIcon className={`w-4 h-4 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div 
          id={`${controlId}-listbox`}
          className="absolute z-30 mt-2 w-full bg-white border border-slate-100 rounded-2xl shadow-xl max-h-60 overflow-y-auto p-2 animate-in fade-in slide-in-from-top-2 duration-200"
          role="listbox"
        >
          {filteredOptions.length > 0 && (
            <div className="px-2 py-2 border-b border-slate-50 mb-1 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Available Options</span>
              <button
                type="button"
                onClick={areAllFilteredSelected ? handleDeselectAllFiltered : handleSelectAllFiltered}
                className="text-[10px] text-brand-blue hover:text-blue-700 font-black uppercase tracking-tighter"
              >
                {areAllFilteredSelected ? 'Clear All' : 'Select All'}
              </button>
            </div>
          )}
          <div className="space-y-1">
            {filteredOptions.map(option => (
              <label
                key={option}
                className="flex items-center space-x-3 px-3 py-2 hover:bg-slate-50 cursor-pointer rounded-xl transition-colors text-sm font-medium text-slate-600 group"
              >
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(option)}
                  onChange={() => handleToggleOption(option)}
                  className="form-checkbox h-4 w-4 text-brand-blue rounded border-slate-200 focus:ring-brand-blue/20 transition-all"
                  aria-label={option}
                />
                <span className="group-hover:text-slate-900">{option}</span>
              </label>
            ))}
          </div>
          {filteredOptions.length === 0 && searchTerm && (
            <div className="text-center py-6">
              <p className="text-xs text-slate-400 italic">No matches for "{searchTerm}"</p>
            </div>
          )}
           {filteredOptions.length === 0 && !searchTerm && (
            <div className="text-center py-6">
              <p className="text-xs text-slate-400 italic">No options available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableMultiSelectDropdown;
