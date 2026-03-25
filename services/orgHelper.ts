let _currentOrgId: string | null = null;
const _orgChangeListeners: Array<(orgId: string | null) => void> = [];

export const getCurrentOrgId = (): string => {
  if (!_currentOrgId) {
    throw new Error('Organization ID not set. User must be logged in.');
  }
  return _currentOrgId;
};

export const getCurrentOrgIdOrNull = (): string | null => {
  return _currentOrgId;
};

export const setCurrentOrgId = (orgId: string | null): void => {
  const changed = _currentOrgId !== orgId;
  _currentOrgId = orgId;
  if (changed) {
    _orgChangeListeners.forEach(listener => listener(orgId));
  }
};

export const onOrgChange = (listener: (orgId: string | null) => void): (() => void) => {
  _orgChangeListeners.push(listener);
  return () => {
    const index = _orgChangeListeners.indexOf(listener);
    if (index > -1) {
      _orgChangeListeners.splice(index, 1);
    }
  };
};
