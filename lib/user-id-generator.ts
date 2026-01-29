import { prisma } from './prisma';

const USER_ID_PREFIX = 'AHC';
const STARTING_NUMBER = 2601; // Start from AHC2601

/**
 * Generate the next unique user ID in format AHC2601, AHC2602, etc.
 * Finds the highest existing ID and increments from there.
 * If no users exist, starts from AHC2601.
 */
export async function generateNextUserId(): Promise<string> {
  // Find the highest existing user ID that matches our format
  const users = await prisma.appUser.findMany({
    where: {
      id: {
        startsWith: USER_ID_PREFIX,
      },
    },
    select: { id: true },
    orderBy: { id: 'desc' },
    take: 100, // Get recent ones to find the max
  });

  let maxNumber = STARTING_NUMBER - 1; // Will become STARTING_NUMBER after increment

  for (const user of users) {
    const num = parseUserId(user.id);
    if (num !== null && num > maxNumber) {
      maxNumber = num;
    }
  }

  // Generate next ID
  const nextNumber = maxNumber + 1;
  return `${USER_ID_PREFIX}${nextNumber}`;
}

/**
 * Parse a user ID to extract the numeric part
 * @param userId - User ID like "AHC2601"
 * @returns The numeric part (e.g., 2601) or null if invalid
 */
export function parseUserId(userId: string): number | null {
  if (!userId || !userId.startsWith(USER_ID_PREFIX)) return null;
  const numPart = userId.slice(USER_ID_PREFIX.length);
  const num = parseInt(numPart, 10);
  return isNaN(num) ? null : num;
}

/**
 * Validate a user ID format
 * @param userId - User ID to validate
 * @returns true if valid format (AHC followed by numbers)
 */
export function isValidUserId(userId: string): boolean {
  if (!userId || !userId.startsWith(USER_ID_PREFIX)) return false;
  const numPart = userId.slice(USER_ID_PREFIX.length);
  return /^\d+$/.test(numPart);
}
