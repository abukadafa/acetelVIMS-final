/** Match student state of origin to company.state values (FCT vs full name). */
export function companyStatesMatching(studentState?: string): string | { $in: string[] } {
  if (!studentState) return '';
  const s = studentState.trim();
  if (
    s === 'Federal Capital Territory (FCT)' ||
    s === 'Federal Capital Territory' ||
    s === 'FCT' ||
    s === 'Abuja'
  ) {
    return { $in: ['FCT', 'Federal Capital Territory', 'Federal Capital Territory (FCT)', 'Abuja'] };
  }
  return s;
}
