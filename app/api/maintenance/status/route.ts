import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Public endpoint for mobile app to check maintenance mode status
 * No authentication required
 *
 * GET /api/maintenance/status
 *
 * Response:
 * {
 *   "isMaintenanceMode": boolean,
 *   "message": string | null,
 *   "timestamp": string
 * }
 */
export async function GET() {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'settings' },
      select: {
        maintenanceMode: true,
        maintenanceMessage: true,
      },
    });

    return NextResponse.json({
      isMaintenanceMode: settings?.maintenanceMode ?? false,
      message: settings?.maintenanceMessage || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Maintenance status check error:', error);
    // In case of error, assume not in maintenance mode to avoid blocking users
    return NextResponse.json({
      isMaintenanceMode: false,
      message: null,
      timestamp: new Date().toISOString(),
    });
  }
}
