/**
 * Central permission catalog for ACETEL VIMS.
 *
 * Design:
 *  - Every user (except `admin`, who implicitly has every permission) carries an
 *    explicit `permissions: string[]` array on their User document.
 *  - When a staff account is created, it is seeded with the DEFAULT permission
 *    set for its role (see DEFAULT_PERMISSIONS_BY_ROLE below), preserving today's
 *    behaviour out of the box.
 *  - An admin can subsequently add or remove any individual permission for any
 *    user via PUT /api/admin/users/:id/permissions — this is what makes "who can
 *    see/do what" independent of programme assignment or hard-coded role checks.
 *  - Visibility bugs (e.g. "students enrolled by X don't show for Y") are caused
 *    by controllers filtering data by req.user.programme instead of by
 *    permission. The *_VIEW_ALL permissions below are what let a user see every
 *    record in the tenant regardless of who created it or which programme it
 *    belongs to.
 */

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard:view',

  STUDENTS_VIEW: 'students:view',           // view students within your own programme only
  STUDENTS_VIEW_ALL: 'students:view_all',   // view ALL students tenant-wide, regardless of programme/creator
  STUDENTS_ADD: 'students:add',
  STUDENTS_MANAGE: 'students:manage',       // edit, flag, approve postings, allocate
  STUDENTS_EXPORT: 'students:export',
  STUDENTS_DELETE: 'students:delete',

  COMPANIES_VIEW: 'companies:view',
  COMPANIES_ADD: 'companies:add',
  COMPANIES_MANAGE: 'companies:manage',     // edit, auto-allocate
  COMPANIES_DELETE: 'companies:delete',

  STAFF_VIEW: 'staff:view',
  STAFF_MANAGE: 'staff:manage',             // create/update/deactivate staff users
  STAFF_MANAGE_PERMISSIONS: 'staff:manage_permissions', // grant/revoke permissions on other users

  ATTENDANCE_VIEW: 'attendance:view',
  ATTENDANCE_MANAGE: 'attendance:manage',

  LOGBOOK_VIEW: 'logbook:view',
  LOGBOOK_MANAGE: 'logbook:manage',         // approve/reject logbook entries

  REPORTS_VIEW: 'reports:view',
  SETTINGS_MANAGE: 'settings:manage',
  AUDIT_VIEW: 'audit:view',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** Grouped catalog for rendering an admin "assign permissions" UI. */
export const PERMISSION_CATALOG = [
  {
    group: 'Dashboard',
    permissions: [
      { key: PERMISSIONS.DASHBOARD_VIEW, label: 'View Dashboard' },
    ],
  },
  {
    group: 'Students',
    permissions: [
      { key: PERMISSIONS.STUDENTS_VIEW, label: 'View Students (own programme)' },
      { key: PERMISSIONS.STUDENTS_VIEW_ALL, label: 'View All Students (all programmes)' },
      { key: PERMISSIONS.STUDENTS_ADD, label: 'Add / Enroll Student' },
      { key: PERMISSIONS.STUDENTS_MANAGE, label: 'Manage Student (edit, flag, allocate, approve posting)' },
      { key: PERMISSIONS.STUDENTS_EXPORT, label: 'Export Student Records' },
      { key: PERMISSIONS.STUDENTS_DELETE, label: 'Delete / Withdraw Student' },
    ],
  },
  {
    group: 'Partner Companies',
    permissions: [
      { key: PERMISSIONS.COMPANIES_VIEW, label: 'View Companies' },
      { key: PERMISSIONS.COMPANIES_ADD, label: 'Add Company' },
      { key: PERMISSIONS.COMPANIES_MANAGE, label: 'Manage Company (edit, auto-allocate)' },
      { key: PERMISSIONS.COMPANIES_DELETE, label: 'Delete Company' },
    ],
  },
  {
    group: 'Staff & Access',
    permissions: [
      { key: PERMISSIONS.STAFF_VIEW, label: 'View Staff' },
      { key: PERMISSIONS.STAFF_MANAGE, label: 'Manage Staff (create, edit, deactivate)' },
      { key: PERMISSIONS.STAFF_MANAGE_PERMISSIONS, label: 'Assign Permissions to Staff' },
    ],
  },
  {
    group: 'Attendance',
    permissions: [
      { key: PERMISSIONS.ATTENDANCE_VIEW, label: 'View Attendance' },
      { key: PERMISSIONS.ATTENDANCE_MANAGE, label: 'Manage Attendance' },
    ],
  },
  {
    group: 'Logbook',
    permissions: [
      { key: PERMISSIONS.LOGBOOK_VIEW, label: 'View Logbook Entries' },
      { key: PERMISSIONS.LOGBOOK_MANAGE, label: 'Approve / Reject Logbook Entries' },
    ],
  },
  {
    group: 'Reports & System',
    permissions: [
      { key: PERMISSIONS.REPORTS_VIEW, label: 'View Reports' },
      { key: PERMISSIONS.SETTINGS_MANAGE, label: 'Manage Settings' },
      { key: PERMISSIONS.AUDIT_VIEW, label: 'View Audit Logs' },
    ],
  },
];

/**
 * Default permission sets per legacy role — applied when a staff user is
 * created and used by the one-off migration script to backfill existing
 * users. These intentionally mirror pre-existing route-level role checks so
 * behaviour does not change until an admin explicitly edits a user's grants,
 * EXCEPT that coordinator-type roles now default to *_VIEW_ALL instead of
 * being programme-locked, which is the fix for the "enrolled students/
 * companies don't show for other staff" bug.
 */
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<string, Permission[]> = {
  admin: [...ALL_PERMISSIONS], // informational only — admin bypasses checks entirely

  prog_coordinator: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STUDENTS_VIEW_ALL,
    PERMISSIONS.STUDENTS_ADD,
    PERMISSIONS.STUDENTS_MANAGE,
    PERMISSIONS.STUDENTS_EXPORT,
    PERMISSIONS.COMPANIES_VIEW,
    PERMISSIONS.COMPANIES_ADD,
    PERMISSIONS.COMPANIES_MANAGE,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.STAFF_MANAGE,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MANAGE,
    PERMISSIONS.LOGBOOK_VIEW,
    PERMISSIONS.LOGBOOK_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.AUDIT_VIEW,
  ],

  internship_coordinator: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STUDENTS_VIEW_ALL,
    PERMISSIONS.STUDENTS_ADD,
    PERMISSIONS.STUDENTS_MANAGE,
    PERMISSIONS.STUDENTS_EXPORT,
    PERMISSIONS.COMPANIES_VIEW,
    PERMISSIONS.COMPANIES_ADD,
    PERMISSIONS.COMPANIES_MANAGE,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.STAFF_MANAGE,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MANAGE,
    PERMISSIONS.LOGBOOK_VIEW,
    PERMISSIONS.LOGBOOK_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.AUDIT_VIEW,
  ],

  ict_support: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STUDENTS_VIEW_ALL,
    PERMISSIONS.STUDENTS_ADD,
    PERMISSIONS.STUDENTS_MANAGE,
    PERMISSIONS.STUDENTS_EXPORT,
    PERMISSIONS.COMPANIES_VIEW,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.STAFF_MANAGE,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.LOGBOOK_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.AUDIT_VIEW,
  ],

  supervisor: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STUDENTS_VIEW_ALL,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.LOGBOOK_VIEW,
    PERMISSIONS.LOGBOOK_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
  ],

  industry_supervisor: [
    PERMISSIONS.DASHBOARD_VIEW,
    // Intentionally no STUDENTS_VIEW/STUDENTS_VIEW_ALL: industry supervisors see
    // their assigned interns via the scoped GET /api/supervisor/students
    // endpoint, not the staff-wide student list/export.
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.LOGBOOK_VIEW,
    PERMISSIONS.LOGBOOK_MANAGE,
  ],

  student: [
    PERMISSIONS.DASHBOARD_VIEW,
  ],
};

export function getDefaultPermissionsForRole(role: string): Permission[] {
  return DEFAULT_PERMISSIONS_BY_ROLE[role] ? [...DEFAULT_PERMISSIONS_BY_ROLE[role]] : [];
}

/** True if the permission string is a recognised permission key. */
export function isValidPermission(perm: string): perm is Permission {
  return (ALL_PERMISSIONS as string[]).includes(perm);
}
