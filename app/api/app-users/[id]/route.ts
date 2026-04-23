import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { normalizeApiUrl, buildAuthHeaders } from '@/lib/woocommerce-helpers';

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  const diffMo = Math.floor(diffDay / 30);
  if (diffMo < 12) return `${diffMo} month${diffMo === 1 ? '' : 's'} ago`;
  const diffYr = Math.floor(diffMo / 12);
  return `${diffYr} year${diffYr === 1 ? '' : 's'} ago`;
}

/**
 * Get App User by ID (Admin Only)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const user = await prisma.appUser.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let customerName = user.wooCustomerName || null;

    if (user.woocommerceCustomerId && !customerName) {
      try {
        const settings = await prisma.settings.findFirst({
          select: {
            woocommerceApiUrl: true,
            woocommerceApiKey: true,
            woocommerceApiSecret: true,
          },
        });

        if (settings?.woocommerceApiUrl && settings?.woocommerceApiKey && settings?.woocommerceApiSecret) {
          const apiUrl = normalizeApiUrl(settings.woocommerceApiUrl);
          const authHeaders = buildAuthHeaders(settings.woocommerceApiKey, settings.woocommerceApiSecret);
          const res = await fetch(
            `${apiUrl}/customers/${user.woocommerceCustomerId}`,
            { method: 'GET', headers: authHeaders }
          );
          if (res.ok) {
            const c = await res.json();
            const name =
              [c.billing?.first_name, c.billing?.last_name].filter(Boolean).join(' ').trim() ||
              [c.shipping?.first_name, c.shipping?.last_name].filter(Boolean).join(' ').trim();
            if (name) {
              customerName = name;
              prisma.appUser
                .update({ where: { id: user.id }, data: { wooCustomerName: name } })
                .catch((err) => console.error('Error caching WooCommerce customer name:', err));
            }
          }
        }
      } catch (err) {
        console.error('Error fetching WooCommerce customer name:', err);
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name || user.displayName || user.email.split('@')[0],
        email: user.email,
        customerName,
        status: user.status,
        lastLogin: user.lastLoginAt ? formatTimeAgo(user.lastLoginAt) : 'Never',
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        weight: user.weight || 'N/A',
        goal: user.goal || 'N/A',
        initialWeight: user.initialWeight || 'N/A',
        initialWeightDate: user.initialWeightDate || null,
        weightSet: user.weightSet,
        joinDate: user.createdAt.toISOString().split('T')[0],
        phone: user.phone,
        age: user.age,
        height: user.height,
        feet: user.feet,
        streak: user.streak,
        woocommerceCustomerId: user.woocommerceCustomerId,
      },
    });
  } catch (error) {
    console.error('Get app user error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching user' },
      { status: 500 }
    );
  }
}

/**
 * Delete App User by ID (Admin Only)
 * 
 * This endpoint deletes an app user and all associated data:
 * - Weight logs (cascade delete)
 * - Medication logs (cascade delete)
 * - Notification views (cascade delete)
 * - All other user-related data
 * 
 * Path Parameters:
 * - id: User ID (required)
 * 
 * Security:
 * - Requires admin session authentication
 * 
 * Note: This is a destructive operation. All user data including weight logs
 * and medication logs will be permanently deleted.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Find user by ID
    const user = await prisma.appUser.findUnique({
      where: { id },
      include: {
        weightLogs: {
          select: { id: true },
        },
        medicationLogs: {
          select: { id: true },
        },
        notificationViews: {
          select: { id: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Count related records before deletion for response
    const weightLogCount = user.weightLogs.length;
    const medicationLogCount = user.medicationLogs.length;
    const notificationViewCount = user.notificationViews.length;

    // Delete the user (cascade will automatically delete related records)
    await prisma.appUser.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'User and all associated data deleted successfully',
      deleted: {
        userId: user.id,
        wpUserId: user.wpUserId,
        email: user.email,
        name: user.name,
        weightLogs: weightLogCount,
        medicationLogs: medicationLogCount,
        notificationViews: notificationViewCount,
      },
    });
  } catch (error) {
    console.error('Delete app user error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while deleting user',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}
