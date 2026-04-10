export interface OfflineLogbookEntry {
  id: string;
  entryDate: string;
  weekNumber: number;
  activities: string;
  toolsUsed?: string;
  skillsLearned?: string;
  challenges?: string;
  solutions?: string;
  timestamp: number;
  retryCount?: number;
}

const LOGBOOK_KEY = 'ims_offline_logbook';
const ATTENDANCE_KEY = 'ims_offline_attendance';

// ─── Logbook ──────────────────────────────────────────────
export function saveLogbookOffline(entry: Omit<OfflineLogbookEntry, 'timestamp'>): void {
  const entries = getOfflineLogbooks();
  const exists = entries.find(e => e.entryDate === entry.entryDate);
  if (!exists) {
    entries.push({ ...entry, timestamp: Date.now(), retryCount: 0 });
    localStorage.setItem(LOGBOOK_KEY, JSON.stringify(entries));
  }
}

export function getOfflineLogbooks(): OfflineLogbookEntry[] {
  try { 
    return JSON.parse(localStorage.getItem(LOGBOOK_KEY) || '[]'); 
  } catch { return []; }
}

export function clearOfflineLogbooks(): void {
  localStorage.removeItem(LOGBOOK_KEY);
}

// ─── Background Sync Engine ───────────────────────────────
let isSyncing = false;

export async function processOfflineSync(syncFn: (entry: OfflineLogbookEntry) => Promise<void>): Promise<void> {
  if (isSyncing || !navigator.onLine) return;
  
  const entries = getOfflineLogbooks();
  if (entries.length === 0) return;

  isSyncing = true;
  console.log(`📡 Starting background sync for ${entries.length} entries...`);

  const remainingEntries: OfflineLogbookEntry[] = [];

  for (const entry of entries) {
    try {
      await syncFn(entry);
      console.log(`✅ Synced entry: ${entry.id}`);
    } catch (err) {
      console.error(`❌ Sync failed for ${entry.id}:`, err);
      remainingEntries.push({
        ...entry,
        retryCount: (entry.retryCount || 0) + 1
      });
    }
  }

  localStorage.setItem(LOGBOOK_KEY, JSON.stringify(remainingEntries));
  isSyncing = false;
}

export function setupOfflineAutoSync(syncFn: (entry: OfflineLogbookEntry) => Promise<void>): void {
  // Sync on back online
  window.addEventListener('online', () => processOfflineSync(syncFn));
  
  // Interval check every 5 minutes
  setInterval(() => processOfflineSync(syncFn), 5 * 60 * 1000);
  
  // Initial check
  if (navigator.onLine) setTimeout(() => processOfflineSync(syncFn), 5000);
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function getPendingSyncCount(): number {
  return getOfflineLogbooks().length;
}
