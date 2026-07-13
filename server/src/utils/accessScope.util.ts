import mongoose from 'mongoose';
import { Permission, PERMISSIONS, resolveUserPermissions } from './permissions.util';

/** Roles that see all students within their tenant */
const TENANT_WIDE_STUDENT_ROLES = ['admin', 'internship_coordinator'];

/** Roles scoped to their assigned programme when one is set */
const PROGRAMME_SCOPED_ROLES = ['prog_coordinator', 'ict_support'];

/** Roles that only see students they supervise */
const SUPERVISOR_SCOPED_ROLES = ['supervisor', 'industry_supervisor'];

export interface ScopeUser {
  id: string;
  role: string;
  tenant?: string;
  programme?: string;
  permissions?: Permission[];
}

function effectivePermissions(user: ScopeUser): Permission[] {
  return user.permissions?.length
    ? user.permissions
    : resolveUserPermissions(user);
}

/**
 * Build MongoDB query scope for student visibility.
 * Visibility is permission-based (view_students), not creator-based.
 * All enrolled students in scope are visible to every user allowed to view them.
 */
export function buildStudentScope(user: ScopeUser, base: Record<string, unknown> = {}): Record<string, unknown> {
  const query: Record<string, unknown> = {
    ...base,
    tenant: user.tenant,
    isDeleted: { $ne: true },
  };

  const perms = effectivePermissions(user);

  // Admin always sees entire tenant
  if (user.role === 'admin') {
    return query;
  }

  // Must hold view_students (or manage/add which imply listing)
  const canView =
    perms.includes(PERMISSIONS.VIEW_STUDENTS) ||
    perms.includes(PERMISSIONS.MANAGE_STUDENTS) ||
    perms.includes(PERMISSIONS.ADD_STUDENT);
  if (!canView) {
    query._id = new mongoose.Types.ObjectId('000000000000000000000000');
    return query;
  }

  // Tenant-wide roles see all students in the institution
  if (TENANT_WIDE_STUDENT_ROLES.includes(user.role)) {
    return query;
  }

  // Programme coordinators / ICT — scoped to programme when assigned
  if (PROGRAMME_SCOPED_ROLES.includes(user.role)) {
    if (user.programme) {
      query.programme = new mongoose.Types.ObjectId(user.programme);
    }
    return query;
  }

  // Supervisors see students assigned to them
  if (SUPERVISOR_SCOPED_ROLES.includes(user.role)) {
    query.supervisor = new mongoose.Types.ObjectId(user.id);
    return query;
  }

  return query;
}

/** Whether a user can see all partner companies in the tenant */
export function canViewAllCompanies(user: ScopeUser): boolean {
  const perms = effectivePermissions(user);
  if (user.role === 'admin' || user.role === 'internship_coordinator') return true;
  return perms.includes(PERMISSIONS.VIEW_COMPANIES) || perms.includes(PERMISSIONS.MANAGE_COMPANIES);
}
