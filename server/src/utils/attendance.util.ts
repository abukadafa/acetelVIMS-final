import Setting from '../models/Setting.model';

/**
 * ACETEL VIMS requires two daily attendance check-ins: a morning session and
 * an afternoon session. Which session a check-in belongs to is derived from
 * the current server time relative to a configurable cutoff hour (24h,
 * tenant-wide setting key `attendance_session_cutoff_hour`, default 12:00 —
 * i.e. anything before noon is "morning", noon or later is "afternoon").
 */
export async function getSessionCutoffHour(tenantId: string): Promise<number> {
  const setting = await Setting.findOne({ tenant: tenantId, key: 'attendance_session_cutoff_hour' });
  const parsed = parseInt(setting?.value || '12', 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 23) return 12;
  return parsed;
}

export function getSessionForTime(date: Date, cutoffHour: number): 'morning' | 'afternoon' {
  return date.getHours() < cutoffHour ? 'morning' : 'afternoon';
}

/** YYYY-MM-DD in server-local time — used as the per-day grouping key for attendance records. */
export function getAttendanceDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function resolveCurrentSession(tenantId: string, at: Date = new Date()): Promise<{
  session: 'morning' | 'afternoon';
  attendanceDate: string;
}> {
  const cutoffHour = await getSessionCutoffHour(tenantId);
  return {
    session: getSessionForTime(at, cutoffHour),
    attendanceDate: getAttendanceDateKey(at),
  };
}
