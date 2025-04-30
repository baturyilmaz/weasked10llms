/**
 * Helper function to generate a simple hash from a string.
 * @param str The input string.
 * @returns A non-negative integer hash.
 */
export const simpleHash = (str: string): number => {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash); // Ensure positive hash
}; 