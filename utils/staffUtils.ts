
import { Therapist } from '../types';
import { DEFAULT_ROLE_RANK } from '../constants';

export const sortStaffHierarchically = (a: Therapist, b: Therapist): number => {
    const rankA = DEFAULT_ROLE_RANK[a.role] ?? -1;
    const rankB = DEFAULT_ROLE_RANK[b.role] ?? -1;
    if (rankA !== rankB) return rankB - rankA;
    return a.name.localeCompare(b.name);
};
