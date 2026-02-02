
export enum DayOfWeek {
  MONDAY = "Monday",
  TUESDAY = "Tuesday",
  WEDNESDAY = "Wednesday",
  THURSDAY = "Thursday",
  FRIDAY = "Friday",
  SATURDAY = "Saturday",
  SUNDAY = "Sunday",
}

export interface Team {
  id: string;
  name: string;
  color: string;
}

export type AlliedHealthServiceType = 'OT' | 'SLP';
export type SessionType = 'ABA' | 'AlliedHealth_OT' | 'AlliedHealth_SLP' | 'IndirectTime' | 'AdminTime';
export type StaffRole = "BCBA" | "CF" | "STAR 3" | "STAR 2" | "STAR 1" | "RBT" | "BT" | "Other";


export interface AlliedHealthNeed {
  type: AlliedHealthServiceType;
  frequencyPerWeek: number;
  durationMinutes: number;
  preferredTimeSlot?: { startTime: string; endTime: string };
  specificDays?: DayOfWeek[];
}

export interface InsuranceQualification {
  id: string; // Unique identifier/name (e.g., "MD_MEDICAID", "RBT")
  maxStaffPerDay?: number;
  minSessionDurationMinutes?: number;
  maxSessionDurationMinutes?: number;
  maxHoursPerWeek?: number;
  roleHierarchyOrder?: number;
}

export interface Client {
  id:string;
  name: string;
  teamId?: string;
  color?: string;
  /**
   * List of qualifications (IDs) a staff member must have to work with this client.
   */
  insuranceRequirements: string[];
  alliedHealthNeeds: AlliedHealthNeed[];
}

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  teamId?: string;
  qualifications: string[];
  canProvideAlliedHealth: AlliedHealthServiceType[];
}

export interface ScheduleEntry {
  id: string; // Unique ID for each entry
  clientName: string | null;
  clientId: string | null; // ID of the client
  staffName: string;
  staffId: string; // ID of the staff member
  day: DayOfWeek;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  sessionType: SessionType;
}

export type GeneratedSchedule = ScheduleEntry[];

export interface BaseScheduleConfig {
  id: string;
  name: string;
  appliesToDays: DayOfWeek[];
  schedule: GeneratedSchedule | null; // Schedule entries here should also be updated if we load them
}

export interface ClientFormProps {
  client: Client;
  staff: Staff[];
  availableTeams: Team[];
  availableInsuranceQualifications: InsuranceQualification[];
  onUpdate: (updatedClient: Client) => void;
  onRemove: (clientId: string) => void;
}

export interface StaffFormProps {
  staff: Staff;
  availableTeams: Team[];
  availableInsuranceQualifications: InsuranceQualification[];
  onUpdate: (updatedStaff: Staff) => void;
  onRemove: (staffId: string) => void;
}

export interface SettingsPanelProps {
  availableTeams: Team[];
  availableInsuranceQualifications: InsuranceQualification[];
  onUpdateTeams: (updatedTeams: Team[]) => void;
  onUpdateInsuranceQualifications: (updatedIQs: InsuranceQualification[]) => void;
}

export interface ScheduleViewProps {
  schedule: GeneratedSchedule;
  staff: Staff[]; // These are the *displayed* staff members
  clients: Client[];
  availableTeams: Team[];
  scheduledFullDate: Date | null;
  onMoveScheduleEntry: (draggedEntryId: string, newStaffId: string, newStartTime: string) => void;
  onOpenEditSessionModal: (entry: ScheduleEntry) => void;
  onOpenAddSessionModal: (staffId: string, staffName: string, startTime: string, day: DayOfWeek) => void;
}

export interface ValidationError {
  ruleId: string;
  message: string;
  details?: Record<string, any>;
}

export interface SessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: ScheduleEntry) => void;
  onDelete?: (entry: ScheduleEntry) => void;
  sessionData: ScheduleEntry | null; // If editing, this is the entry
  newSessionSlot: { staffId: string; staffName: string; startTime: string; day: DayOfWeek } | null; // If adding new
  clients: Client[];
  staff: Staff[];
  insuranceQualifications: InsuranceQualification[];
  availableSessionTypes: string[];
  timeSlots: string[];
  currentSchedule: GeneratedSchedule;
  currentError: ValidationError[] | null;
  clearError: () => void;
}

export interface BaseScheduleManagerProps {
    baseSchedules: BaseScheduleConfig[];
    onAddConfig: () => void;
    onUpdateConfigName: (id: string, newName: string) => void;
    onUpdateConfigDays: (id: string, newDays: DayOfWeek[]) => void;
    onDeleteConfig: (id: string) => void;
    onSetAsBase: (id: string) => void;
    onViewBase: (id: string) => void;
    currentGeneratedScheduleIsSet: boolean;
}

export interface FilterControlsProps {
  allTeams: Team[];
  allStaff: Staff[];
  allClients: Client[];
  selectedTeamIds: string[];
  selectedStaffIds: string[];
  selectedClientIds: string[];
  onTeamFilterChange: (ids: string[]) => void;
  onStaffFilterChange: (ids: string[]) => void;
  onClientFilterChange: (ids: string[]) => void;
  onClearFilters: () => void;
}

export interface SearchableMultiSelectDropdownProps {
  label: string;
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
}

// Updated Callout Types for date range
export interface Callout {
  id: string;
  entityType: 'client' | 'staff';
  entityId: string;
  entityName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (same as startDate for single day)
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  reason?: string;
}

export interface CalloutFormValues {
  entityType: 'client' | 'staff';
  entityId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  reason?: string;
}

export interface BulkOperationError {
  rowNumber: number;
  message: string;
  rowData?: string; // Original row data that caused the error
}

export interface BulkOperationSummary {
  processedRows: number;
  addedCount: number;
  updatedCount: number;
  removedCount: number;
  errorCount: number;
  errors: BulkOperationError[];
  newlyAddedSettings?: {
    insuranceRequirements?: string[];
    qualifications?: string[];
  };
}

export interface AdminSettingsPanelProps {
  availableTeams: Team[];
  onBulkUpdateClients: (file: File, action: 'ADD_UPDATE' | 'REMOVE') => Promise<BulkOperationSummary>;
  onBulkUpdateStaff: (file: File, action: 'ADD_UPDATE' | 'REMOVE') => Promise<BulkOperationSummary>;
  onUpdateInsuranceQualifications: (newQualifications: InsuranceQualification[]) => void;
}

export interface GAGenerationResult {
  schedule: GeneratedSchedule | null;
  finalValidationErrors: ValidationError[];
  generations: number;
  bestFitness: number;
  success: boolean;
  statusMessage: string;
}