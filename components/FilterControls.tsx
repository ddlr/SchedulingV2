
import React, { useState, useEffect, useRef } from 'react';
import { Team, Therapist, Client, FilterControlsProps } from '../types';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { XMarkIcon } from './icons/XMarkIcon';

interface DropdownFilterProps {
  id: string;
  label: string;
  items: { id: string; name: string; color?: string }[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  placeholder?: string;
}

const DropdownFilter: React.FC<DropdownFilterProps> = ({
  id,
  label,
  items,
  selectedIds,
  onSelectionChange,
  placeholder = "Select..."
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleToggle = () => setIsOpen(!isOpen);

  const handleCheckboxChange = (itemId: string) => {
    const newSelectedIds = selectedIds.includes(itemId)
      ? selectedIds.filter(sid => sid !== itemId)
      : [...selectedIds, itemId];
    onSelectionChange(newSelectedIds);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      onSelectionChange(items.map(item => item.id));
    } else {
      onSelectionChange([]);
    }
  };

  const getButtonLabel = () => {
    if (selectedIds.length === 0) return placeholder;
    if (items.length > 0 && selectedIds.length === items.length) return `All ${label}`;
    if (selectedIds.length === 1) {
      const selectedItem = items.find(item => item.id === selectedIds[0]);
      return selectedItem ? selectedItem.name : placeholder;
    }
    return `${selectedIds.length} ${label} selected`;
  };
  
  const sortedItems = [...items].sort((a,b) => a.name.localeCompare(b.name));
  const isAllSelected = items.length > 0 && selectedIds.length === items.length;

  return (
    <div className="relative flex-grow min-w-[200px]" ref={dropdownRef}>
      <label htmlFor={`${id}-button`} className="block text-sm font-medium text-slate-600 mb-1">{label}:</label>
      <button
        id={`${id}-button`}
        type="button"
        onClick={handleToggle}
        className="w-full bg-white border border-slate-300 rounded-md shadow-sm px-3 py-2 text-left text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex justify-between items-center"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{getButtonLabel()}</span>
        <ChevronDownIcon className={`w-5 h-5 text-slate-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          <ul className="p-2 space-y-1" role="listbox" aria-label={`${label} options`}>
            {items.length > 0 && (
                 <li className="px-2 py-1.5 border-b border-slate-200">
                    <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        className="form-checkbox h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        aria-label={isAllSelected ? `Deselect all ${label}` : `Select all ${label}`}
                      />
                      <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
                    </label>
                  </li>
            )}
            {sortedItems.map(item => (
              <li key={item.id} role="option" aria-selected={selectedIds.includes(item.id)}>
                <label className="flex items-center space-x-2 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer">
                  <input
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => handleCheckboxChange(item.id)}
                    aria-label={item.name}
                  />
                  {item.color && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true"></span>}
                  <span className="truncate">{item.name}</span>
                </label>
              </li>
            ))}
            {items.length === 0 && <li className="px-2 py-1.5 text-sm text-slate-500">No options available.</li>}
          </ul>
        </div>
      )}
    </div>
  );
};

const FilterControls: React.FC<FilterControlsProps> = ({
  allTeams,
  allTherapists,
  allClients,
  selectedTeamIds,
  selectedTherapistIds,
  selectedClientIds,
  onTeamFilterChange,
  onTherapistFilterChange,
  onClientFilterChange,
  onClearFilters,
}) => {
  return (
    <div className="bg-slate-50 p-4 rounded-lg shadow-sm border border-slate-200 mb-6 space-y-4 md:space-y-0 md:flex md:flex-wrap md:items-end md:gap-4">
      <DropdownFilter
        id="team-filter"
        label="Teams"
        items={allTeams.map(t => ({ id: t.id, name: t.name, color: t.color }))}
        selectedIds={selectedTeamIds}
        onSelectionChange={onTeamFilterChange}
        placeholder="Filter by Team(s)"
      />
      <DropdownFilter
        id="therapist-filter"
        label="Therapists"
        items={allTherapists.map(t => ({ id: t.id, name: t.name }))}
        selectedIds={selectedTherapistIds}
        onSelectionChange={onTherapistFilterChange}
        placeholder="Filter by Therapist(s)"
      />
      <DropdownFilter
        id="client-filter"
        label="Clients"
        items={allClients.map(c => ({ id: c.id, name: c.name }))}
        selectedIds={selectedClientIds}
        onSelectionChange={onClientFilterChange}
        placeholder="Filter by Client(s)"
      />
      
      <button
        onClick={onClearFilters}
        className="w-full md:w-auto bg-slate-500 hover:bg-slate-600 text-white font-medium py-2.5 px-4 rounded-lg shadow hover:shadow-md transition-colors duration-150 text-sm flex items-center justify-center space-x-2"
        aria-label="Clear all schedule filters"
      >
        <XMarkIcon className="w-4 h-4" />
        <span>Clear Filters</span>
      </button>
    </div>
  );
};

export default FilterControls;
