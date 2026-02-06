
import React, { useState } from 'react';
import { AdminSettingsPanelProps, BulkOperationSummary } from '../types';
import { DocumentArrowUpIcon } from './icons/DocumentArrowUpIcon';
import { InformationCircleIcon } from './icons/InformationCircleIcon';
import { TrashIcon } from './icons/TrashIcon';
import LoadingSpinner from './LoadingSpinner';
import SystemConfigPanel from './SystemConfigPanel';
import UserManagementPanel from './UserManagementPanel';

const AdminSettingsPanel: React.FC<AdminSettingsPanelProps> = ({
  availableTeams,
  onBulkUpdateClients,
  onBulkUpdateTherapists,
  onUpdateInsuranceQualifications,
}) => {
  const [clientFile, setClientFile] = useState<File | null>(null);
  const [therapistFile, setTherapistFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [operationSummary, setOperationSummary] = useState<BulkOperationSummary | null>(null);
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

  const toggleAccordion = (id: string) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'client' | 'therapist') => {
    setOperationSummary(null);
    const file = event.target.files?.[0];
    if (file) {
      if (type === 'client') setClientFile(file);
      else setTherapistFile(file);
    }
  };

  const processBulkUpdate = async (type: 'client' | 'therapist', action: 'ADD_UPDATE' | 'REMOVE') => {
    const file = type === 'client' ? clientFile : therapistFile;
    if (!file) {
      alert(`Please select a ${type} CSV file.`);
      return;
    }

    setIsLoading(true);
    setOperationSummary(null);
    let summary: BulkOperationSummary;

    if (type === 'client') {
      summary = await onBulkUpdateClients(file, action);
    } else {
      summary = await onBulkUpdateTherapists(file, action);
    }
    
    setOperationSummary(summary);
    setIsLoading(false);
    // Clear file input after processing
    if (type === 'client') setClientFile(null);
    else setTherapistFile(null);
    const fileInput = document.getElementById(`${type}-file-input`) as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };
  
  const clientCSVFormatDoc = `
    <p class="mb-2"><strong>Required Columns for Client CSV:</strong></p>
    <ul class="list-disc list-inside space-y-1 text-sm">
      <li><strong>ACTION:</strong> (Required) Must be <code>ADD_UPDATE</code> or <code>REMOVE</code>.</li>
      <li><strong>name:</strong> (Required for <code>ADD_UPDATE</code>, used as identifier for <code>REMOVE</code>) Client's full name. Must be unique for reliable <code>REMOVE</code>.</li>
      <li><strong>teamName:</strong> (Optional for <code>ADD_UPDATE</code>) Name of the team. Client assigned if team exists. Blank or non-existent team = unassigned.</li>
      <li><strong>insuranceRequirements:</strong> (Optional for <code>ADD_UPDATE</code>) Semicolon-separated list (e.g., "TRICARE;BCBA Certified"). New requirements added to Settings.</li>
      <li><strong>alliedHealthNeeds:</strong> (Optional for <code>ADD_UPDATE</code>) Semicolon-separated list in format <code>TYPE:FREQ:DURATION</code> (e.g., "OT:2:60;SLP:1:30"). TYPE is OT or SLP. FREQ is times/week. DURATION is mins/session.</li>
    </ul>
    <p class="mt-2 text-xs">For <code>ADD_UPDATE</code>, if a client with 'name' exists, they are updated. Otherwise, a new client is created.</p>
    <p class="text-xs">For <code>REMOVE</code>, client with matching 'name' is removed.</p>
  `;

  const therapistCSVFormatDoc = `
    <p class="mb-2"><strong>Required Columns for Staff CSV:</strong></p>
    <ul class="list-disc list-inside space-y-1 text-sm">
      <li><strong>ACTION:</strong> (Required) Must be <code>ADD_UPDATE</code> or <code>REMOVE</code>.</li>
      <li><strong>name:</strong> (Required for <code>ADD_UPDATE</code>, used as identifier for <code>REMOVE</code>) Staff member's full name. Must be unique for reliable <code>REMOVE</code>.</li>
      <li><strong>teamName:</strong> (Optional for <code>ADD_UPDATE</code>) Name of the team. Assignment logic similar to clients.</li>
      <li><strong>qualifications:</strong> (Optional for <code>ADD_UPDATE</code>) Semicolon-separated list (e.g., "RBT;CPR Certified"). New qualifications added to Settings.</li>
    </ul>
    <p class="mt-2 text-xs">For <code>ADD_UPDATE</code>, if a staff member with 'name' exists, they are updated. Otherwise, a new one is created.</p>
    <p class="text-xs">For <code>REMOVE</code>, staff member with matching 'name' is removed.</p>
  `;

  const renderDocumentation = (title: string, content: string, id: string) => (
    <div className="border border-slate-100 rounded-2xl overflow-hidden">
      <button
        onClick={() => toggleAccordion(id)}
        type="button"
        className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition-all"
      >
        <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <InformationCircleIcon className="w-5 h-5 text-brand-blue" />
          {title}
        </span>
        <span className={`text-slate-400 transition-transform duration-200 ${activeAccordion === id ? 'rotate-180' : ''}`}>
           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </span>
      </button>
      {activeAccordion === id && (
        <div className="p-6 bg-white border-t border-slate-100 prose prose-slate prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
      )}
    </div>
  );
  
  const renderSummary = () => {
    if (!operationSummary) return null;
    return (
        <div className={`mt-6 p-4 rounded-md shadow ${operationSummary.errorCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} border`}>
            <h4 className="font-semibold text-lg mb-2">{operationSummary.errorCount > 0 ? 'Operation Completed with Errors' : 'Operation Successful'}</h4>
            <p>Processed Rows: {operationSummary.processedRows}</p>
            {operationSummary.addedCount > 0 && <p>Added: {operationSummary.addedCount}</p>}
            {operationSummary.updatedCount > 0 && <p>Updated: {operationSummary.updatedCount}</p>}
            {operationSummary.removedCount > 0 && <p>Removed: {operationSummary.removedCount}</p>}
            <p>Errors: {operationSummary.errorCount}</p>
            
            {operationSummary.newlyAddedSettings?.insuranceRequirements && operationSummary.newlyAddedSettings.insuranceRequirements.length > 0 && (
                <p className="text-sm mt-1 text-sky-700">New Insurance Requirements added to Settings: {operationSummary.newlyAddedSettings.insuranceRequirements.join(', ')}</p>
            )}
            {operationSummary.newlyAddedSettings?.qualifications && operationSummary.newlyAddedSettings.qualifications.length > 0 && (
                <p className="text-sm mt-1 text-sky-700">New Qualifications added to Settings: {operationSummary.newlyAddedSettings.qualifications.join(', ')}</p>
            )}

            {operationSummary.errorCount > 0 && operationSummary.errors.length > 0 && (
                <div className="mt-3">
                    <p className="font-medium text-red-700">Error Details:</p>
                    <ul className="list-disc list-inside text-sm text-red-600 max-h-40 overflow-y-auto">
                        {operationSummary.errors.map((err, idx) => (
                            <li key={idx}>Row {err.rowNumber}: {err.message} {err.rowData && `(Data: ${err.rowData.substring(0,60)}...)`}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="space-y-12">
      <UserManagementPanel />

      <SystemConfigPanel />

      <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-12">
        <h3 className="text-2xl font-serif text-slate-900 tracking-tight flex items-center gap-3">
          <div className="w-2 h-8 bg-slate-900 rounded-full"></div>
          Bulk Data Operations
        </h3>

        {isLoading && <div className="flex flex-col justify-center items-center py-12 bg-slate-50 rounded-2xl"><LoadingSpinner /> <span className="mt-4 text-sm font-medium text-slate-500">Processing records...</span></div>}

        {renderSummary()}

      {/* Client Bulk Operations */}
      <section className="space-y-6">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Client Import/Export</h4>
        {renderDocumentation("Client CSV Structure Requirements", clientCSVFormatDoc, "clientDoc")}
        <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
          <label htmlFor="client-file-input" className="block text-sm font-bold text-slate-700">Select Source File</label>
          <input
            type="file"
            id="client-file-input"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={(e) => handleFileChange(e, 'client')}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 transition-all cursor-pointer"
          />

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => processBulkUpdate('client', 'ADD_UPDATE')}
              disabled={!clientFile || isLoading}
              className="bg-brand-blue hover:bg-blue-700 disabled:bg-slate-200 text-white font-bold py-2.5 px-6 rounded-full shadow-sm flex items-center space-x-2 text-xs transition-all"
            >
              <DocumentArrowUpIcon className="w-4 h-4" />
              <span>Sync from CSV</span>
            </button>
            <button
              onClick={() => processBulkUpdate('client', 'REMOVE')}
              disabled={!clientFile || isLoading}
              className="bg-white hover:bg-red-50 text-red-500 border border-red-100 font-bold py-2.5 px-6 rounded-full shadow-sm flex items-center space-x-2 text-xs transition-all"
            >
              <TrashIcon className="w-4 h-4" />
              <span>Bulk Remove</span>
            </button>
          </div>
        </div>
      </section>

      {/* Therapist Bulk Operations */}
      <section className="space-y-6">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Staff Import/Export</h4>
        {renderDocumentation("Staff CSV Structure Requirements", therapistCSVFormatDoc, "therapistDoc")}
        <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
          <label htmlFor="therapist-file-input" className="block text-sm font-bold text-slate-700">Select Source File</label>
          <input
            type="file"
            id="therapist-file-input"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={(e) => handleFileChange(e, 'therapist')}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 transition-all cursor-pointer"
          />

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => processBulkUpdate('therapist', 'ADD_UPDATE')}
              disabled={!therapistFile || isLoading}
              className="bg-brand-blue hover:bg-blue-700 disabled:bg-slate-200 text-white font-bold py-2.5 px-6 rounded-full shadow-sm flex items-center space-x-2 text-xs transition-all"
            >
              <DocumentArrowUpIcon className="w-4 h-4" />
              <span>Sync from CSV</span>
            </button>
            <button
              onClick={() => processBulkUpdate('therapist', 'REMOVE')}
              disabled={!therapistFile || isLoading}
              className="bg-white hover:bg-red-50 text-red-500 border border-red-100 font-bold py-2.5 px-6 rounded-full shadow-sm flex items-center space-x-2 text-xs transition-all"
            >
               <TrashIcon className="w-4 h-4" />
              <span>Bulk Remove</span>
            </button>
          </div>
        </div>
      </section>
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-widest font-bold mb-2">Technical Note</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            CSV processing is performed client-side. For Excel files (.xlsx, .xls), ensure the first sheet contains the data with the correct headers.
            CSV files should be comma-separated. Header row is expected. Semicolons (;) are used as separators within multi-value fields.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPanel;
