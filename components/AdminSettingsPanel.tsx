
import React, { useState } from 'react';
import { AdminSettingsPanelProps, BulkOperationSummary } from '../types';
import { DocumentArrowUpIcon } from './icons/DocumentArrowUpIcon';
import { InformationCircleIcon } from './icons/InformationCircleIcon';
import { TrashIcon } from './icons/TrashIcon';
import LoadingSpinner from './LoadingSpinner';
import SystemConfigPanel from './SystemConfigPanel';

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
    <p class="mb-2"><strong>Required Columns for Therapist CSV:</strong></p>
    <ul class="list-disc list-inside space-y-1 text-sm">
      <li><strong>ACTION:</strong> (Required) Must be <code>ADD_UPDATE</code> or <code>REMOVE</code>.</li>
      <li><strong>name:</strong> (Required for <code>ADD_UPDATE</code>, used as identifier for <code>REMOVE</code>) Therapist's full name. Must be unique for reliable <code>REMOVE</code>.</li>
      <li><strong>teamName:</strong> (Optional for <code>ADD_UPDATE</code>) Name of the team. Assignment logic similar to clients.</li>
      <li><strong>qualifications:</strong> (Optional for <code>ADD_UPDATE</code>) Semicolon-separated list (e.g., "RBT;CPR Certified"). New qualifications added to Settings.</li>
      <li><strong>canCoverIndirect:</strong> (Optional for <code>ADD_UPDATE</code>) <code>TRUE</code> or <code>FALSE</code>.</li>
      <li><strong>canProvideAlliedHealth:</strong> (Optional for <code>ADD_UPDATE</code>) Semicolon-separated list of allied health service types (e.g., "OT;SLP").</li>
    </ul>
    <p class="mt-2 text-xs">For <code>ADD_UPDATE</code>, if a therapist with 'name' exists, they are updated. Otherwise, a new one is created.</p>
    <p class="text-xs">For <code>REMOVE</code>, therapist with matching 'name' is removed.</p>
  `;

  const renderDocumentation = (title: string, content: string, id: string) => (
    <div className="border border-slate-200 rounded-md">
      <button
        onClick={() => toggleAccordion(id)}
        className="w-full flex justify-between items-center p-3 bg-slate-100 hover:bg-slate-200 transition-colors rounded-t-md"
      >
        <span className="font-medium text-slate-700 flex items-center"><InformationCircleIcon className="w-5 h-5 mr-2 text-blue-500" />{title}</span>
        <span className={`transform transition-transform duration-200 ${activeAccordion === id ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {activeAccordion === id && (
        <div className="p-4 border-t border-slate-200 bg-white rounded-b-md prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
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
    <div className="space-y-10">
      <SystemConfigPanel />

      <div className="p-4 bg-white rounded-lg shadow-md space-y-10">
        <h2 className="text-2xl font-semibold text-slate-700 mb-6 border-b pb-3">Bulk Data Operations</h2>

        {isLoading && <div className="flex justify-center items-center my-4"><LoadingSpinner /> <span className="ml-2">Processing file...</span></div>}

        {renderSummary()}

      {/* Client Bulk Operations */}
      <section className="space-y-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
        <h3 className="text-xl font-semibold text-slate-600">Client Data</h3>
        {renderDocumentation("Client CSV File Format Guide", clientCSVFormatDoc, "clientDoc")}
        <div className="mt-3">
          <label htmlFor="client-file-input" className="block text-sm font-medium text-slate-700 mb-1">Upload Client CSV File:</label>
          <input
            type="file"
            id="client-file-input"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={(e) => handleFileChange(e, 'client')}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          <button
            onClick={() => processBulkUpdate('client', 'ADD_UPDATE')}
            disabled={!clientFile || isLoading}
            className="bg-green-500 hover:bg-green-600 disabled:bg-slate-300 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center space-x-2 text-sm"
          >
            <DocumentArrowUpIcon className="w-5 h-5" />
            <span>Add/Update Clients from CSV</span>
          </button>
          <button
            onClick={() => processBulkUpdate('client', 'REMOVE')}
            disabled={!clientFile || isLoading}
            className="bg-red-500 hover:bg-red-600 disabled:bg-slate-300 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center space-x-2 text-sm"
          >
            <TrashIcon className="w-5 h-5" />
            <span>Remove Clients from CSV</span>
          </button>
        </div>
      </section>

      {/* Therapist Bulk Operations */}
      <section className="space-y-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
        <h3 className="text-xl font-semibold text-slate-600">Therapist Data</h3>
        {renderDocumentation("Therapist CSV File Format Guide", therapistCSVFormatDoc, "therapistDoc")}
        <div className="mt-3">
          <label htmlFor="therapist-file-input" className="block text-sm font-medium text-slate-700 mb-1">Upload Therapist CSV File:</label>
          <input
            type="file"
            id="therapist-file-input"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={(e) => handleFileChange(e, 'therapist')}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          <button
            onClick={() => processBulkUpdate('therapist', 'ADD_UPDATE')}
            disabled={!therapistFile || isLoading}
            className="bg-green-500 hover:bg-green-600 disabled:bg-slate-300 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center space-x-2 text-sm"
          >
            <DocumentArrowUpIcon className="w-5 h-5" />
            <span>Add/Update Therapists from CSV</span>
          </button>
          <button
            onClick={() => processBulkUpdate('therapist', 'REMOVE')}
            disabled={!therapistFile || isLoading}
            className="bg-red-500 hover:bg-red-600 disabled:bg-slate-300 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center space-x-2 text-sm"
          >
             <TrashIcon className="w-5 h-5" />
            <span>Remove Therapists from CSV</span>
          </button>
        </div>
      </section>
        <p className="text-xs text-slate-500 mt-6">
          Note: CSV processing is done client-side. For Excel files (.xlsx, .xls), ensure the first sheet contains the data with the correct headers.
          CSV files should be comma-separated. Header row is expected. Semicolons (;) are used as separators within multi-value fields like 'insuranceRequirements'.
        </p>
      </div>
    </div>
  );
};

export default AdminSettingsPanel;
