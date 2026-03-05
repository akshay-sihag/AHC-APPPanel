import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { normalizeApiUrl, buildAuthHeaders, getCustomerByEmailCached } from '@/lib/woocommerce-helpers';

/**
 * POST - One-time migration to backfill orderId on existing daily check-in records
 *
 * Authentication: Admin session required
 *
 * Query Parameters:
 * - dryRun (string, optional): Set to "true" to preview changes without updating
 * - limit (number, optional): Max number of users to process per call (default: 5)
 * - offset (number, optional): Number of users to skip (default: 0)
 *
 * Use limit/offset to paginate through users and avoid gateway timeouts.
 * Example: first call ?limit=5&offset=0, then ?limit=5&offset=5, etc.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Admin session required
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin session required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');
    const filterEmail = searchParams.get('email')?.toLowerCase().trim() || null;

    // Get WooCommerce settings
    const settings = await prisma.settings.findUnique({
      where: { id: 'settings' },
      select: {
        woocommerceApiUrl: true,
        woocommerceApiKey: true,
        woocommerceApiSecret: true,
      },
    });

    if (!settings?.woocommerceApiUrl || !settings?.woocommerceApiKey || !settings?.woocommerceApiSecret) {
      return NextResponse.json(
        { error: 'WooCommerce API credentials are not configured' },
        { status: 500 }
      );
    }

    const apiUrl = normalizeApiUrl(settings.woocommerceApiUrl);
    const authHeaders = buildAuthHeaders(settings.woocommerceApiKey, settings.woocommerceApiSecret);

    // Find all check-ins without orderId (optionally filtered by email)
    const allCheckIns = await prisma.dailyCheckIn.findMany({
      where: {
        orderId: null,
        ...(filterEmail && { appUser: { email: filterEmail } }),
      },
      select: {
        id: true,
        date: true,
        medicationName: true,
        appUserId: true,
        appUser: {
          select: { email: true, wpUserId: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Group check-ins by user email
    const byUser = new Map<string, typeof allCheckIns>();
    for (const checkIn of allCheckIns) {
      const email = checkIn.appUser.email;
      if (!byUser.has(email)) {
        byUser.set(email, []);
      }
      byUser.get(email)!.push(checkIn);
    }

    const allUserEmails = Array.from(byUser.keys()).sort();
    const totalUsers = allUserEmails.length;

    if (allCheckIns.length === 0 || offset >= totalUsers) {
      return NextResponse.json({
        success: true,
        dryRun,
        totalCheckIns: allCheckIns.length,
        totalUsers,
        usersProcessed: 0,
        offset,
        limit,
        hasMore: false,
        nextOffset: null,
        updated: 0,
        skipped: 0,
        noMatch: 0,
        errors: 0,
        details: [],
        duration: `${Date.now() - startTime}ms`,
      });
    }

    // Slice the users for this batch
    const batchEmails = allUserEmails.slice(offset, offset + limit);

    const details: { checkInId: string; date: string; medication: string; email: string; matchedOrderId: string | null; error?: string }[] = [];
    let updated = 0;
    let noMatch = 0;
    let errors = 0;

    // Process each user in this batch
    for (const email of batchEmails) {
      const userCheckIns = byUser.get(email)!;
      try {
        // Fetch all orders for this user from WooCommerce
        const orders = await fetchAllOrdersForUser(apiUrl, authHeaders, email);

        if (orders.length === 0) {
          for (const checkIn of userCheckIns) {
            noMatch++;
            details.push({
              checkInId: checkIn.id,
              date: checkIn.date,
              medication: checkIn.medicationName,
              email,
              matchedOrderId: null,
            });
          }
          continue;
        }

        // Match each check-in to an order
        for (const checkIn of userCheckIns) {
          try {
            const matchedOrder = findBestMatchingOrder(orders, checkIn.medicationName, checkIn.date);

            if (matchedOrder) {
              if (!dryRun) {
                await prisma.dailyCheckIn.update({
                  where: { id: checkIn.id },
                  data: { orderId: String(matchedOrder.id) },
                });
              }
              updated++;
              details.push({
                checkInId: checkIn.id,
                date: checkIn.date,
                medication: checkIn.medicationName,
                email,
                matchedOrderId: String(matchedOrder.id),
              });
            } else {
              noMatch++;
              details.push({
                checkInId: checkIn.id,
                date: checkIn.date,
                medication: checkIn.medicationName,
                email,
                matchedOrderId: null,
              });
            }
          } catch (err: any) {
            errors++;
            details.push({
              checkInId: checkIn.id,
              date: checkIn.date,
              medication: checkIn.medicationName,
              email,
              matchedOrderId: null,
              error: err.message,
            });
          }
        }
      } catch (err: any) {
        // If we fail to fetch orders for this user, mark all their check-ins as errors
        for (const checkIn of userCheckIns) {
          errors++;
          details.push({
            checkInId: checkIn.id,
            date: checkIn.date,
            medication: checkIn.medicationName,
            email,
            matchedOrderId: null,
            error: `Failed to fetch orders for ${email}: ${err.message}`,
          });
        }
      }
    }

    const nextOffset = offset + limit;
    const hasMore = nextOffset < totalUsers;

    return NextResponse.json({
      success: true,
      dryRun,
      totalCheckIns: allCheckIns.length,
      totalUsers,
      usersProcessed: batchEmails.length,
      offset,
      limit,
      hasMore,
      nextOffset: hasMore ? nextOffset : null,
      updated,
      skipped: 0,
      noMatch,
      errors,
      details,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Fetch all orders for a user via WooCommerce API.
 * Uses customer lookup then paginated orders fetch.
 */
async function fetchAllOrdersForUser(
  apiUrl: string,
  authHeaders: HeadersInit,
  email: string
): Promise<any[]> {
  const customer = await getCustomerByEmailCached(apiUrl, authHeaders, email);
  if (!customer) return [];

  const allOrders: any[] = [];
  let page = 1;

  while (true) {
    const url = new URL(`${apiUrl}/orders`);
    url.searchParams.append('customer', String(customer.id));
    url.searchParams.append('per_page', '100');
    url.searchParams.append('page', String(page));
    url.searchParams.append('status', 'any');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: authHeaders,
    });

    if (!response.ok) break;

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) break;

    const orders = await response.json();
    const ordersArray = Array.isArray(orders) ? orders : [orders];

    if (ordersArray.length === 0) break;

    allOrders.push(...ordersArray);

    const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);
    if (page >= totalPages) break;
    page++;
  }

  return allOrders;
}

/**
 * Check if a medication name matches an order line item name.
 * Case-insensitive, checks if either contains the other.
 * e.g., "Tirzepatide" matches "Compounded GLP-1/GIP (Tirzepatide) - Every 3 Months"
 */
function medicationMatchesLineItem(medicationName: string, lineItemName: string): boolean {
  const med = medicationName.toLowerCase().trim();
  const item = lineItemName.toLowerCase().trim();
  return item.includes(med) || med.includes(item);
}

/**
 * Find the best matching order for a check-in based on medication name and date.
 *
 * Rules:
 * a. Find all orders whose line_items contain a product matching the medicationName
 * b. Pick the most recent order whose date_created is on or before the check-in date
 * c. If no order is on or before, pick the earliest matching order (edge case)
 */
function findBestMatchingOrder(
  orders: any[],
  medicationName: string,
  checkInDate: string
): any | null {
  if (medicationName === 'default') return null;

  // Filter orders that have a matching line item
  const matchingOrders = orders.filter((order) => {
    const lineItems = order.line_items || [];
    return lineItems.some((item: any) =>
      medicationMatchesLineItem(medicationName, item.name || '')
    );
  });

  if (matchingOrders.length === 0) return null;

  // Parse order dates and sort
  const ordersWithDates = matchingOrders.map((order) => {
    const dateStr = order.date_created || order.date_created_gmt || '';
    // WooCommerce date format: "2026-03-01T10:30:00" — extract YYYY-MM-DD
    const orderDate = dateStr.substring(0, 10);
    return { order, orderDate };
  });

  // Find orders on or before the check-in date
  const onOrBefore = ordersWithDates
    .filter((o) => o.orderDate <= checkInDate)
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate)); // Most recent first

  if (onOrBefore.length > 0) {
    return onOrBefore[0].order;
  }

  // Fallback: earliest matching order (check-in logged before order date)
  const sorted = ordersWithDates.sort((a, b) => a.orderDate.localeCompare(b.orderDate));
  return sorted[0].order;
}
