import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * Reset/Delete All Data API
 * 
 * Request Body:
 * {
 *   "entities": ["users", "weight-logs", "medicine-categories", "medicines", "blogs", "faqs", "notifications", "settings"]
 * }
 * 
 * This endpoint deletes ALL data for the specified entities.
 * WARNING: This is a destructive operation that cannot be undone.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { entities } = body;
    
    if (!entities || !Array.isArray(entities) || entities.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request. Expected array of entity names.' },
        { status: 400 }
      );
    }

    const results: any = {
      success: true,
      reset: {},
      errors: {},
    };

    // Reset Weight Logs (must be before users due to foreign key)
    if (entities.includes('weight-logs') || entities.includes('log')) {
      try {
        const count = await prisma.weightLog.deleteMany({});
        results.reset['weight-logs'] = { deleted: count.count };
      } catch (error: any) {
        results.errors['weight-logs'] = error.message;
        results.success = false;
      }
    }

    // Reset Medication Logs (must be before users due to foreign key)
    if (entities.includes('medication-logs')) {
      try {
        const count = await prisma.medicationLog.deleteMany({});
        results.reset['medication-logs'] = { deleted: count.count };
      } catch (error: any) {
        results.errors['medication-logs'] = error.message;
        results.success = false;
      }
    }

    // Reset Notification Views (must be before notifications due to foreign key)
    if (entities.includes('notification-views')) {
      try {
        const count = await prisma.notificationView.deleteMany({});
        results.reset['notification-views'] = { deleted: count.count };
      } catch (error: any) {
        results.errors['notification-views'] = error.message;
        results.success = false;
      }
    }

    // Reset Users (deletes weight logs and medication logs via cascade)
    if (entities.includes('users')) {
      try {
        const count = await prisma.appUser.deleteMany({});
        results.reset.users = { deleted: count.count };
      } catch (error: any) {
        results.errors.users = error.message;
        results.success = false;
      }
    }

    // Reset Medicines (must be before categories due to foreign key)
    if (entities.includes('medicines')) {
      try {
        const count = await prisma.medicine.deleteMany({});
        results.reset.medicines = { deleted: count.count };
      } catch (error: any) {
        results.errors.medicines = error.message;
        results.success = false;
      }
    }

    // Reset Medicine Categories
    if (entities.includes('medicine-categories')) {
      try {
        const count = await prisma.medicineCategory.deleteMany({});
        results.reset['medicine-categories'] = { deleted: count.count };
      } catch (error: any) {
        results.errors['medicine-categories'] = error.message;
        results.success = false;
      }
    }

    // Reset Blogs
    if (entities.includes('blogs')) {
      try {
        const count = await prisma.blog.deleteMany({});
        results.reset.blogs = { deleted: count.count };
      } catch (error: any) {
        results.errors.blogs = error.message;
        results.success = false;
      }
    }

    // Reset FAQs
    if (entities.includes('faqs')) {
      try {
        const count = await prisma.fAQ.deleteMany({});
        results.reset.faqs = { deleted: count.count };
      } catch (error: any) {
        results.errors.faqs = error.message;
        results.success = false;
      }
    }

    // Reset Notifications
    if (entities.includes('notifications')) {
      try {
        const count = await prisma.notification.deleteMany({});
        results.reset.notifications = { deleted: count.count };
      } catch (error: any) {
        results.errors.notifications = error.message;
        results.success = false;
      }
    }

    // Reset Settings (reset to defaults, don't delete)
    if (entities.includes('settings')) {
      try {
        const defaultSettings = await prisma.settings.upsert({
          where: { id: 'settings' },
          update: {
            adminEmail: 'admin@alternatehealthclub.com',
            timezone: 'America/New_York',
            weightUnit: 'lbs',
            heightUnit: 'inches',
            sessionTimeout: 30,
            requireStrongPassword: true,
            enableTwoFactor: false,
            woocommerceApiUrl: null,
            woocommerceApiKey: null,
            woocommerceApiSecret: null,
            fcmServerKey: null,
            fcmProjectId: null,
          },
          create: {
            id: 'settings',
            adminEmail: 'admin@alternatehealthclub.com',
            timezone: 'America/New_York',
            weightUnit: 'lbs',
            heightUnit: 'inches',
            sessionTimeout: 30,
            requireStrongPassword: true,
            enableTwoFactor: false,
          },
        });
        results.reset.settings = { reset: true, message: 'Settings reset to defaults' };
      } catch (error: any) {
        results.errors.settings = error.message;
        results.success = false;
      }
    }

    return NextResponse.json(results, {
      status: results.success ? 200 : 207, // 207 Multi-Status if partial success
    });
  } catch (error) {
    console.error('Reset data error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to reset data',
        details: process.env.NODE_ENV === 'development' && error instanceof Error 
          ? error.message 
          : undefined
      },
      { status: 500 }
    );
  }
}
