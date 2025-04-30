/**
 * Formats a date as a readable string (e.g., "May 15, 2023")
 */
export const formatDate = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return date.toLocaleDateString(undefined, options);
}; 