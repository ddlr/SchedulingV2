import { DayOfWeek, TherapistRole, AlliedHealthServiceType } from './types';
import { getSystemConfig } from './services/systemConfigService';

let _cachedConfig = getSystemConfig();

export const updateCachedConfig = (newConfig: any) => {
  _cachedConfig = newConfig;
};

export const DAYS_OF_WEEK: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
];

export const getCompanyOperatingHoursStart = () => _cachedConfig.companyOperatingHoursStart;
export const getCompanyOperatingHoursEnd = () => _cachedConfig.companyOperatingHoursEnd;
export const getStaffAssumedAvailabilityStart = () => _cachedConfig.staffAssumedAvailabilityStart;
export const getStaffAssumedAvailabilityEnd = () => _cachedConfig.staffAssumedAvailabilityEnd;
export const getLunchCoverageStartTime = () => _cachedConfig.lunchCoverageStartTime;
export const getLunchCoverageEndTime = () => _cachedConfig.lunchCoverageEndTime;
export const getIdealLunchWindowStart = () => _cachedConfig.idealLunchWindowStart;
export const getIdealLunchWindowEndForStart = () => _cachedConfig.idealLunchWindowEndForStart;
export const getTeamColors = () => _cachedConfig.teamColors;
export const getAllTherapistRoles = () => _cachedConfig.allTherapistRoles;
export const getDefaultRoleRank = () => _cachedConfig.defaultRoleRank;
export const getAllAlliedHealthServices = () => _cachedConfig.allAlliedHealthServices;
export const getAllSessionTypes = () => _cachedConfig.allSessionTypes;
export const getClientColorPalette = () => _cachedConfig.clientColorPalette;

export const COMPANY_OPERATING_HOURS_START = getCompanyOperatingHoursStart();
export const COMPANY_OPERATING_HOURS_END = getCompanyOperatingHoursEnd();
export const STAFF_ASSUMED_AVAILABILITY_START = getStaffAssumedAvailabilityStart();
export const STAFF_ASSUMED_AVAILABILITY_END = getStaffAssumedAvailabilityEnd();
export const LUNCH_COVERAGE_START_TIME = getLunchCoverageStartTime();
export const LUNCH_COVERAGE_END_TIME = getLunchCoverageEndTime();
export const IDEAL_LUNCH_WINDOW_START = getIdealLunchWindowStart();
export const IDEAL_LUNCH_WINDOW_END_FOR_START = getIdealLunchWindowEndForStart();
export const TEAM_COLORS = getTeamColors();
export const ALL_THERAPIST_ROLES = getAllTherapistRoles();
export const DEFAULT_ROLE_RANK = getDefaultRoleRank();
export const ALL_ALLIED_HEALTH_SERVICES = getAllAlliedHealthServices();
export const ALL_SESSION_TYPES = getAllSessionTypes();

export const TIME_SLOTS_H_MM: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_SLOTS_H_MM.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

export const PALETTE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.42 0 2.25 2.25 0 0 1-2.4-2.245 3 3 0 0 0-5.78-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.39m0 0A11.25 11.25 0 0 1 12 2.25a11.25 11.25 0 0 1 5.042 1.357m1.128 6.856A3 3 0 0 0 12 10.5a3 3 0 0 0-1.128 5.86m0 0a3 3 0 0 0 5.728 1.137 2.25 2.25 0 0 1 2.4 2.245 4.5 4.5 0 0 0-8.42 0 2.25 2.25 0 0 1 2.4-2.245 3 3 0 0 0 5.728-1.137Zm0 0a15.998 15.998 0 0 0-3.388-1.62m5.033.025a15.994 15.994 0 0 0-1.622-3.39m0 0a11.25 11.25 0 0 0-5.042-1.357A11.25 11.25 0 0 0 12 2.25a11.25 11.25 0 0 0-5.042 1.357m0 0c-.39.204-.774.434-1.144.686M7.5 4.5V6m13.5-1.5V6" /></svg>`;
