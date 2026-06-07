/** Nigerian states canonicalization and address helpers. */
const STATE_ALIASES: Record<string, string> = {
  'fct': 'FCT',
  'federal capital territory': 'FCT',
  'federal capital territory (fct)': 'FCT',
  'abuja': 'FCT',
  'abuja fct': 'FCT',
  'lagos': 'Lagos',
  'ogun': 'Ogun',
  'akwa ibom': 'Akwa Ibom',
  'cross river': 'Cross River',
  'rivers': 'Rivers',
  'nassarawa': 'Nasarawa',
  'niger': 'Niger',
  'benue': 'Benue',
  'abia': 'Abia',
  'adamawa': 'Adamawa',
  'akwaibom': 'Akwa Ibom',
  'anambra': 'Anambra',
  'bauchi': 'Bauchi',
  'bayelsa': 'Bayelsa',
  'borno': 'Borno',
  'delta': 'Delta',
  'ebonyi': 'Ebonyi',
  'edo': 'Edo',
  'ekiti': 'Ekiti',
  'enugu': 'Enugu',
  'gombe': 'Gombe',
  'imo': 'Imo',
  'jigawa': 'Jigawa',
  'kaduna': 'Kaduna',
  'kano': 'Kano',
  'katsina': 'Katsina',
  'kebbi': 'Kebbi',
  'kogi': 'Kogi',
  'kwara': 'Kwara',
  'nasarawa': 'Nasarawa',
  'ondo': 'Ondo',
  'osun': 'Osun',
  'oyo': 'Oyo',
  'plateau': 'Plateau',
  'sokoto': 'Sokoto',
  'taraba': 'Taraba',
  'yobe': 'Yobe',
  'zamfara': 'Zamfara',
};

export const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River',
  'Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi',
  'Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
  'Taraba','Yobe','Zamfara'
];

export function normalizeStateName(value?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/[^a-z]/g, ' ').replace(/\s+/g, ' ').trim();
  const normalizedKey = key.replace(/\s+state(?:\s+of\s+origin)?$/, '').trim();
  return STATE_ALIASES[normalizedKey] || NIGERIAN_STATES.find((state) => state.toLowerCase() === normalizedKey) || raw;
}

export function extractStateFromAddress(address?: string): string {
  if (!address) return '';
  const normalized = address.toLowerCase();
  if (normalized.includes('abuja')) return 'FCT';
  for (const state of NIGERIAN_STATES) {
    if (state === 'FCT') continue;
    if (normalized.includes(state.toLowerCase())) return state;
  }
  return '';
}

export function companyStatesMatching(studentState?: string, studentAddress?: string): string | { $in: string[] } {
  const normalizedState = normalizeStateName(studentState) || extractStateFromAddress(studentAddress);
  if (!normalizedState) return '';
  if (normalizedState === 'FCT') {
    return { $in: ['FCT', 'Federal Capital Territory', 'Federal Capital Territory (FCT)', 'Abuja'] };
  }
  return normalizedState;
}

export function studentStateMatchesCompany(companyState?: string, studentState?: string, studentAddress?: string): boolean {
  const normalizedCompany = normalizeStateName(companyState);
  const normalizedStudent = normalizeStateName(studentState) || extractStateFromAddress(studentAddress);
  if (!normalizedCompany || !normalizedStudent) return false;
  return normalizedCompany === normalizedStudent;
}
