
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
      <label htmlFor={`${id}-button`} className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">{label}</label>
      <button
        id={`${id}-button`}
        type="button"
        onClick={handleToggle}
        className="w-full bg-white border border-slate-100 rounded-2xl shadow-sm px-4 py-3 text-left text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue flex justify-between items-center transition-all"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate font-medium">{getButtonLabel()}</span>
        <ChevronDownIcon className={`w-4 h-4 text-slate-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-2 w-full bg-white border border-slate-100 rounded-2xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          <ul className="p-2 space-y-1" role="listbox" aria-label={`${label} options`}>
            {items.length > 0 && (
                 <li className="px-2 py-2 border-b border-slate-50">
                    <label className="flex items-center space-x-3 text-sm font-semibold text-slate-900 cursor-pointer p-1 rounded-xl hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        className="form-checkbox h-4 w-4 text-brand-blue rounded border-slate-200 focus:ring-brand-blue/20"
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
                <label className="flex items-center space-x-3 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group">
                  <input
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-brand-blue rounded border-slate-200 focus:ring-brand-blue/20 transition-all"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => handleCheckboxChange(item.id)}
                    aria-label={item.name}
                  />
                  {item.color && <span className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: item.color }} aria-hidden="true"></span>}
                  <span className="truncate group-hover:text-slate-900 transition-colors">{item.name}</span>
                </label>
              </li>
            ))}
            {items.length === 0 && <li className="px-3 py-4 text-sm text-slate-400 italic text-center">No options available</li>}
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
    <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 mb-8 space-y-4 md:space-y-0 md:flex md:flex-wrap md:items-end md:gap-6">
      <DropdownFilter
        id="team-filter"
        label="Filter by Teams"
        items={allTeams.map(t => ({ id: t.id, name: t.name, color: t.color }))}
        selectedIds={selectedTeamIds}
        onSelectionChange={onTeamFilterChange}
        placeholder="Filter by Team(s)"
      />
      <DropdownFilter
        id="therapist-filter"
        label="Filter by Staff"
        items={allTherapists.map(t => ({ id: t.id, name: t.name }))}
        selectedIds={selectedTherapistIds}
        onSelectionChange={onTherapistFilterChange}
        placeholder="All Staff"
      />
      <DropdownFilter
        id="client-filter"
        label="Filter by Clients"
        items={allClients.map(c => ({ id: c.id, name: c.name }))}
        selectedIds={selectedClientIds}
        onSelectionChange={onClientFilterChange}
        placeholder="All Clients"
      />
      
      <button
        onClick={onClearFilters}
        className="w-full md:w-auto bg-white hover:bg-slate-50 text-slate-500 font-bold py-3 px-6 rounded-2xl border border-slate-100 shadow-sm transition-all duration-200 text-sm flex items-center justify-center space-x-2"
        aria-label="Clear all schedule filters"
      >
        <XMarkIcon className="w-4 h-4 text-slate-400" />
        <span>Reset</span>
      </button>
    </div>
  );
};

export default FilterControls;
