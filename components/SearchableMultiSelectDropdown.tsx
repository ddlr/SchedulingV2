
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
      <label htmlFor={controlId} className="block text-sm font-medium text-slate-600 mb-1">
        {label}:
      </label>
      <div 
        className="form-input w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white text-left flex items-center flex-wrap gap-1 min-h-[42px] cursor-text"
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
            className="flex items-center bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full"
          >
            {option}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // Prevent opening dropdown
                handleToggleOption(option);
              }}
              className="ml-1.5 text-blue-500 hover:text-blue-700"
              aria-label={`Remove ${option}`}
            >
              <XMarkIcon className="w-3 h-3" />
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
          className="flex-grow p-1 outline-none text-sm"
          aria-autocomplete="list"
          aria-controls={`${controlId}-listbox`}
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className="text-slate-400 hover:text-slate-600"
          aria-label={isOpen ? "Close dropdown" : "Open dropdown"}
        >
          <ChevronDownIcon className={`w-5 h-5 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div 
          id={`${controlId}-listbox`}
          className="absolute z-10 mt-1 w-full bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-y-auto p-2"
          role="listbox"
        >
          {filteredOptions.length > 0 && (
            <div className="px-1 py-1.5 border-b border-slate-200 mb-1">
              <button
                type="button"
                onClick={areAllFilteredSelected ? handleDeselectAllFiltered : handleSelectAllFiltered}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {areAllFilteredSelected ? 'Deselect All Visible' : 'Select All Visible'}
              </button>
            </div>
          )}
          {filteredOptions.map(option => (
            <label
              key={option}
              className="flex items-center space-x-2 p-1.5 hover:bg-slate-100 cursor-pointer rounded text-sm"
            >
              <input
                type="checkbox"
                checked={selectedOptions.includes(option)}
                onChange={() => handleToggleOption(option)}
                className="form-checkbox h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                aria-label={option}
              />
              <span>{option}</span>
            </label>
          ))}
          {filteredOptions.length === 0 && searchTerm && (
            <p className="text-sm text-slate-500 p-2">No matches for "{searchTerm}".</p>
          )}
           {filteredOptions.length === 0 && !searchTerm && (
            <p className="text-sm text-slate-500 p-2">No options available.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableMultiSelectDropdown;
