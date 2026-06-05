export function apiErrorMessage(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data.error === 'string') {
    if (Array.isArray(data.details) && data.details.length > 0) {
      const extra = data.details
        .map((d: any) => (typeof d === 'string' ? d : d.message || JSON.stringify(d)))
        .join(', ');
      if (!data.error.includes(extra)) return `${data.error}${extra ? ` (${extra})` : ''}`;
    }
    return data.error;
  }
  if (typeof data.message === 'string') return data.message;
  return fallback;
}
