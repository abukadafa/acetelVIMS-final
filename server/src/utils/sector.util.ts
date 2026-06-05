const VALID_SECTORS = ['AI', 'CS', 'MIS', 'Cybersecurity', 'Data Science', 'General IT'] as const;
export type CompanySector = (typeof VALID_SECTORS)[number];

const SECTOR_ALIASES: Record<string, CompanySector> = {
  AI: 'AI',
  'Artificial Intelligence': 'AI',
  CS: 'CS',
  'Computer Science': 'CS',
  MIS: 'MIS',
  'Management Information Systems': 'MIS',
  Cybersecurity: 'Cybersecurity',
  'Data Science': 'Data Science',
  'General IT': 'General IT',
  'Information Technology': 'General IT',
  'Software Development': 'General IT',
  Networking: 'General IT',
  Telecommunications: 'General IT',
  Government: 'General IT',
  Fintech: 'General IT',
  Energy: 'General IT',
};

export function normalizeCompanySector(input: string): CompanySector {
  const trimmed = input?.trim() || '';
  if ((VALID_SECTORS as readonly string[]).includes(trimmed)) {
    return trimmed as CompanySector;
  }
  return SECTOR_ALIASES[trimmed] || 'General IT';
}
