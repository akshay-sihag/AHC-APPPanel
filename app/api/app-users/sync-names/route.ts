import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { normalizeApiUrl, buildAuthHeaders } from '@/lib/woocommerce-helpers';

// POST /api/app-users/sync-names - Bulk sync all WooCommerce customer names (admin only)
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.settings.findFirst({
      select: {
        woocommerceApiUrl: true,
        woocommerceApiKey: true,
        woocommerceApiSecret: true,
      },
    });

    if (!settings?.woocommerceApiUrl || !settings?.woocommerceApiKey || !settings?.woocommerceApiSecret) {
      return NextResponse.json({ error: 'WooCommerce credentials not configured' }, { status: 500 });
    }

    const apiUrl = normalizeApiUrl(settings.woocommerceApiUrl);
    const authHeaders = buildAuthHeaders(settings.woocommerceApiKey, settings.woocommerceApiSecret);

    // Get all users with a customer ID but no cached name
    const users = await prisma.appUser.findMany({
      where: {
        wooCustomerName: null,
        woocommerceCustomerId: { not: null },
      },
      select: { id: true, woocommerceCustomerId: true },
    });

    if (users.length === 0) {
      return NextResponse.json({ message: 'All users already have names cached', synced: 0, total: 0 });
    }

    const extractName = (c: any): string =>
      [c.billing?.first_name, c.billing?.last_name].filter(Boolean).join(' ').trim() ||
      [c.shipping?.first_name, c.shipping?.last_name].filter(Boolean).join(' ').trim();

    let synced = 0;
    let notFound = 0;
    let errors = 0;

    // Batch fetch by customer ID (100 per WooCommerce API call)
    for (let i = 0; i < users.length; i += 100) {
      const batch = users.slice(i, i + 100);
      const ids = batch.map(u => u.woocommerceCustomerId!);
      try {
        const res = await fetch(
          `${apiUrl}/customers?include=${ids.join(',')}&per_page=100`,
          { method: 'GET', headers: authHeaders }
        );
        if (res.ok) {
          const customers = await res.json();
          if (Array.isArray(customers)) {
            const nameMap = new Map<number, string>();
            for (const c of customers) {
              const name = extractName(c);
              if (name && c.id) nameMap.set(c.id, name);
            }
            for (const user of batch) {
              const name = nameMap.get(user.woocommerceCustomerId!);
              if (name) {
                await prisma.appUser.update({
                  where: { id: user.id },
                  data: { wooCustomerName: name },
                });
                synced++;
              } else {
                notFound++;
              }
            }
          }
        } else {
          errors += batch.length;
        }
      } catch {
        errors += batch.length;
      }
    }

    return NextResponse.json({
      message: 'Bulk sync complete',
      total: users.length,
      synced,
      notFound,
      errors,
    });
  } catch (error) {
    console.error('Bulk sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
