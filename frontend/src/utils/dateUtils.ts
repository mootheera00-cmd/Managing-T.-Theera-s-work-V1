/**
 * Format a date string (YYYY-MM-DD) for display.
 * Returns empty string if input is invalid.
 */
export function formatDMY(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  // Handle YYYY-MM-DD format - return as-is
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return dateStr.trim().substring(0, 10);
  }
  // Try parsing as date object
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return dateStr;
}
