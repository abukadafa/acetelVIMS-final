/** Granular permissions assignable by administrators */
export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_STUDENTS: 'view_students',
  ADD_STUDENT: 'add_student',
  MANAGE_STUDENTS: 'manage_students',
  DELETE_STUDENT: 'delete_student',
  VIEW_STAFF: 'view_staff',
  ADD_STAFF: 'add_staff',
  MANAGE_STAFF: 'manage_staff',
  DELETE_STAFF: 'delete_staff',
  VIEW_COMPANIES: 'view_companies',
  MANAGE_COMPANIES: 'manage_companies',
  VIEW_ATTENDANCE: 'view_attendance',
  MANAGE_ATTENDANCE: 'manage_attendance',
  VIEW_LOGBOOK: 'view_logbook',
  MANAGE_LOGBOOK: 'manage_logbook',
  SEND_EMAIL: 'send_email',
  SEND_WHATSAPP: 'send_whatsapp',
  VIEW_AUDIT: 'view_audit',
  MANAGE_SETTINGS: 'manage_settings',
  APPROVE_POSTING: 'approve_posting',
  ALLOCATE_STUDENT: 'allocate_student',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const PERMISSION_LABELS: Record<Permission, string> = {
  view_dashboard: 'View Dashboard',
  view_analytics: 'View Analytics',
  view_students: 'View Students',
  add_student: 'Add / Enroll Student',
  manage_students: 'Manage Students',
  delete_student: 'Delete Student',
  view_staff: 'View Staff',
  add_staff: 'Add Staff',
  manage_staff: 'Manage Staff',
  delete_staff: 'Delete Staff',
  view_companies: 'View Partner Companies',
  manage_companies: 'Manage Partner Companies',
  view_attendance: 'View Attendance',
  manage_attendance: 'Manage Attendance',
  view_logbook: 'View Logbook',
  manage_logbook: 'Manage Logbook',
  send_email: 'Send Email',
  send_whatsapp: 'Send WhatsApp',
  view_audit: 'View Audit Trail',
  manage_settings: 'Manage Settings',
  approve_posting: 'Approve Posting',
  allocate_student: 'Allocate Student',
};

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: ALL_PERMISSIONS,
  internship_coordinator: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.ADD_STUDENT,
    PERMISSIONS.MANAGE_STUDENTS,
    PERMISSIONS.VIEW_STAFF,
    PERMISSIONS.ADD_STAFF,
    PERMISSIONS.MANAGE_STAFF,
    PERMISSIONS.VIEW_COMPANIES,
    PERMISSIONS.MANAGE_COMPANIES,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.MANAGE_ATTENDANCE,
    PERMISSIONS.VIEW_LOGBOOK,
    PERMISSIONS.MANAGE_LOGBOOK,
    PERMISSIONS.SEND_EMAIL,
    PERMISSIONS.SEND_WHATSAPP,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.APPROVE_POSTING,
    PERMISSIONS.ALLOCATE_STUDENT,
  ],
  prog_coordinator: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.ADD_STUDENT,
    PERMISSIONS.MANAGE_STUDENTS,
    PERMISSIONS.VIEW_STAFF,
    PERMISSIONS.ADD_STAFF,
    PERMISSIONS.MANAGE_STAFF,
    PERMISSIONS.VIEW_COMPANIES,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.MANAGE_ATTENDANCE,
    PERMISSIONS.VIEW_LOGBOOK,
    PERMISSIONS.MANAGE_LOGBOOK,
    PERMISSIONS.SEND_EMAIL,
    PERMISSIONS.SEND_WHATSAPP,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.APPROVE_POSTING,
    PERMISSIONS.ALLOCATE_STUDENT,
  ],
  ict_support: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.VIEW_STAFF,
    PERMISSIONS.ADD_STAFF,
    PERMISSIONS.MANAGE_STAFF,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.VIEW_LOGBOOK,
    PERMISSIONS.SEND_EMAIL,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.MANAGE_SETTINGS,
  ],
  supervisor: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.VIEW_LOGBOOK,
    PERMISSIONS.MANAGE_LOGBOOK,
    PERMISSIONS.SEND_EMAIL,
    PERMISSIONS.SEND_WHATSAPP,
  ],
  industry_supervisor: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.VIEW_LOGBOOK,
    PERMISSIONS.MANAGE_LOGBOOK,
  ],
  student: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_LOGBOOK,
    PERMISSIONS.VIEW_ATTENDANCE,
  ],
};

export function resolveUserPermissions(user: { role: string; permissions?: string[] | null }): Permission[] {
  if (user.role === 'admin') return ALL_PERMISSIONS;
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions.filter((p): p is Permission => ALL_PERMISSIONS.includes(p as Permission));
  }
  return DEFAULT_ROLE_PERMISSIONS[user.role] || [];
}

export function hasPermission(
  user: { role: string; permissions?: string[] | null },
  ...required: Permission[]
): boolean {
  const effective = resolveUserPermissions(user);
  return required.every((p) => effective.includes(p));
}
