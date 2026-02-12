import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';
import { filterFieldsArray, parseFieldsParam } from '@/lib/field-filter';
import { normalizeApiUrl, buildAuthHeaders, getCustomerByEmailCached } from '@/lib/woocommerce-helpers';

// Cache settings for 5 minutes to reduce database queries
let cachedSettings: any = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * WooCommerce Orders Endpoint
 * 
 * GET: Retrieves order data from WooCommerce based on the user's email.
 * POST: Cancels an order in WooCommerce.
 * 
 * GET Query Parameters:
 * - email: User email (required) - matches the wp_user_email from Flutter app
 * 
 * POST Body:
 * - orderId: Order ID to cancel (required)
 * - email: User email for verification (required)
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * 
 * Returns:
 * - GET: List of orders for the specified customer email
 * - POST: Cancelled order details
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Validate API key
    const apiKey = await validateApiKey(request);
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key required.' },
        { status: 401 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const fieldsParam = url.searchParams.get('fields'); // Dynamic field filtering
    const requestedFields = parseFieldsParam(fieldsParam);

    // Validate email parameter
    if (!email) {
      return NextResponse.json(
        { error: 'Email query parameter is required' },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Helper function to get WooCommerce settings
    async function getWooCommerceSettings() {
      const now = Date.now();
      if (cachedSettings && (now - settingsCacheTime) < SETTINGS_CACHE_TTL) {
        return cachedSettings;
      }
      
      const settings = await prisma.settings.findUnique({
        where: { id: 'settings' },
        select: {
          woocommerceApiUrl: true,
          woocommerceApiKey: true,
          woocommerceApiSecret: true,
        },
      });
      
      if (settings) {
        cachedSettings = settings;
        settingsCacheTime = now;
      }
      
      return settings;
    }

    // Helper function to extract subscription IDs from order meta_data
    function extractSubscriptionIdsFromMeta(order: any): number[] {
      const subscriptionIds: number[] = [];
      
      if (order.meta_data && Array.isArray(order.meta_data)) {
        for (const meta of order.meta_data) {
          // Check for various subscription-related meta keys
          if (meta.key === '_subscription_renewal' || 
              meta.key === '_subscription_switch' ||
              meta.key === '_subscription_resubscribe' ||
              meta.key === '_subscription_id' ||
              meta.key === 'subscription_id') {
            const subId = parseInt(meta.value, 10);
            if (!isNaN(subId) && !subscriptionIds.includes(subId)) {
              subscriptionIds.push(subId);
            }
          }
        }
      }
      
      return subscriptionIds;
    }

    // Helper function to determine order type based on meta_data and context
    function determineOrderType(order: any, isParentOfSubscription: boolean): string {
      if (order.meta_data && Array.isArray(order.meta_data)) {
        for (const meta of order.meta_data) {
          if (meta.key === '_subscription_renewal') return 'renewal';
          if (meta.key === '_subscription_switch') return 'switch';
          if (meta.key === '_subscription_resubscribe') return 'resubscribe';
        }
      }
      // If this order is the parent of a subscription
      if (isParentOfSubscription) return 'parent';
      // If no subscription meta and not a parent, it's standalone
      return order.parent_id === 0 ? 'standalone' : 'unknown';
    }

    // Helper function to extract tracking info from an order note
    function extractTrackingFromNote(noteText: string): {
      tracking_number: string;
      carrier: string;
      ship_date: string | null;
    } | null {
      const noteLower = noteText.toLowerCase();
      if (!noteLower.includes('shipped') && !noteLower.includes('tracking') && !noteLower.includes('shipment')) {
        return null;
      }

      // UPS tracking number: 1Z followed by 16 alphanumeric characters
      const upsMatch = noteText.match(/\b(1Z[A-Z0-9]{16})\b/i);
      if (!upsMatch) {
        return null;
      }

      const trackingNumber = upsMatch[1].toUpperCase();

      // Extract carrier info from "via UPS – UPS 2nd Day Air®" pattern
      let carrier = 'UPS';
      const carrierMatch = noteText.match(/via\s+(UPS(?:\s*[–\-]\s*UPS\s+[^.®]*[®]?))/i);
      if (carrierMatch) {
        carrier = carrierMatch[1].trim();
      }

      // Extract ship date from "shipped on February 11, 2026" pattern
      let shipDate: string | null = null;
      const dateMatch = noteText.match(
        /shipped\s+on\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i
      );
      if (dateMatch) {
        try {
          const parsed = new Date(dateMatch[1]);
          if (!isNaN(parsed.getTime())) {
            shipDate = parsed.toISOString().split('T')[0];
          }
        } catch {
          // Leave shipDate as null
        }
      }

      return { tracking_number: trackingNumber, carrier, ship_date: shipDate };
    }

    // Helper function to fetch orders from WooCommerce (OPTIMIZED)
    async function fetchOrdersFromWooCommerce(email: string) {
      const settings = await getWooCommerceSettings();

      if (!settings || !settings.woocommerceApiUrl || !settings.woocommerceApiKey || !settings.woocommerceApiSecret) {
        throw new Error('WooCommerce API credentials are not configured');
      }

      // Normalize API URL using shared helper
      const apiUrl = normalizeApiUrl(settings.woocommerceApiUrl);

      // Build auth headers using shared helper
      const authHeaders = buildAuthHeaders(settings.woocommerceApiKey, settings.woocommerceApiSecret);

      // OPTIMIZED: Get customer by email first (server-side filtering)
      console.log(`[Orders API] Looking up customer by email: ${email}`);
      const customer = await getCustomerByEmailCached(apiUrl, authHeaders, email);

      let customerId: number | null = null;
      let ordersArray: any[] = [];

      if (!customer) {
        console.log(`[Orders API] No customer found for email ${email}. Returning empty orders.`);
        return {
          success: true,
          email: email,
          customerId: null,
          count: 0,
          orders: [],
        };
      }

      customerId = customer.id;
      console.log(`[Orders API] Found customer ID ${customerId}. Fetching orders with server-side filter.`);

      // Fetch orders with customer ID filter (server-side filtering - MUCH faster)
      const ordersUrl = new URL(`${apiUrl}/orders`);
      ordersUrl.searchParams.append('customer', customerId.toString());
      ordersUrl.searchParams.append('per_page', '100');

      const woocommerceResponse = await fetch(ordersUrl.toString(), {
        method: 'GET',
        headers: authHeaders,
      });

      if (!woocommerceResponse.ok) {
        throw new Error(`WooCommerce API returned ${woocommerceResponse.status}`);
      }

      // Parse JSON response
      const contentType = woocommerceResponse.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');

      if (!isJson) {
        throw new Error('WooCommerce API returned invalid response format');
      }

      const orders = await woocommerceResponse.json();
      ordersArray = Array.isArray(orders) ? orders : [orders];

      console.log(`[Orders API] Found ${ordersArray.length} orders for customer ID ${customerId}`);

      // STEP 1: Fetch all customer subscriptions to build order->subscription mapping
      // In WooCommerce Subscriptions, subscription.parent_id points to the parent order
      const subscriptionsUrl = new URL(`${apiUrl}/subscriptions`);
      subscriptionsUrl.searchParams.append('customer', customerId.toString());
      subscriptionsUrl.searchParams.append('per_page', '100');

      let subscriptionsArray: any[] = [];
      try {
        const subscriptionsResponse = await fetch(subscriptionsUrl.toString(), {
          method: 'GET',
          headers: authHeaders,
        });

        if (subscriptionsResponse.ok) {
          const subContentType = subscriptionsResponse.headers.get('content-type');
          if (subContentType && subContentType.includes('application/json')) {
            const subs = await subscriptionsResponse.json();
            subscriptionsArray = Array.isArray(subs) ? subs : [subs];
          }
        }
      } catch (subError) {
        console.log(`[Orders API] Could not fetch subscriptions: ${subError}`);
      }

      console.log(`[Orders API] Found ${subscriptionsArray.length} subscriptions for customer`);

      // Build maps: 
      // - orderIdToSubscriptionIds: order_id -> [subscription_ids] (subscriptions where this order is the parent)
      // - subscriptionIdToParentOrderId: subscription_id -> parent_order_id
      const orderIdToSubscriptionIds: Map<number, number[]> = new Map();
      const subscriptionsMap: Map<number, any> = new Map();

      subscriptionsArray.forEach((sub: any) => {
        subscriptionsMap.set(sub.id, sub);
        
        // If subscription has a parent_id, that order is the parent order of this subscription
        if (sub.parent_id && sub.parent_id > 0) {
          if (!orderIdToSubscriptionIds.has(sub.parent_id)) {
            orderIdToSubscriptionIds.set(sub.parent_id, []);
          }
          orderIdToSubscriptionIds.get(sub.parent_id)!.push(sub.id);
        }
      });

      // STEP 2: Collect all unique product_ids from all orders
      const allProductIds: number[] = [];
      const ordersById: Map<number, any> = new Map();

      ordersArray.forEach((order: any) => {
        // Store order by ID for quick lookup
        ordersById.set(order.id, order);
        
        // Collect product IDs
        if (order.line_items && Array.isArray(order.line_items)) {
          order.line_items.forEach((item: any) => {
            if (item.product_id) {
              allProductIds.push(item.product_id);
            }
          });
        }
      });

      // STEP 3: Fetch all unique products in parallel
      const uniqueProductIds = [...new Set(allProductIds)];
      const productsMap = new Map<number, any>();

      await Promise.all(
        uniqueProductIds.map(async (productId) => {
          try {
            const productUrl = `${apiUrl}/products/${productId}`;
            const productResponse = await fetch(productUrl, {
              method: 'GET',
              headers: authHeaders,
            });

            if (productResponse.ok) {
              const productContentType = productResponse.headers.get('content-type');
              if (productContentType && productContentType.includes('application/json')) {
                const product = await productResponse.json();
                productsMap.set(productId, product);
              }
            }
          } catch (productError) {
            // Continue without product - will use default values
          }
        })
      );

      // STEP 4: Build subscription-to-orders mapping for related_orders
      // Fetch related orders from each subscription's orders endpoint
      const subscriptionOrdersMap: Map<number, number[]> = new Map();
      
      // For each subscription, get its related orders
      await Promise.all(
        subscriptionsArray.map(async (sub: any) => {
          try {
            const subOrdersUrl = `${apiUrl}/subscriptions/${sub.id}/orders`;
            const subOrdersResponse = await fetch(subOrdersUrl, {
              method: 'GET',
              headers: authHeaders,
            });

            if (subOrdersResponse.ok) {
              const contentType = subOrdersResponse.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const subOrders = await subOrdersResponse.json();
                const orderIds = Array.isArray(subOrders) 
                  ? subOrders.map((o: any) => o.id) 
                  : [subOrders.id];
                subscriptionOrdersMap.set(sub.id, orderIds);
              }
            }
          } catch (err) {
            // Continue without subscription orders
          }
        })
      );

      // STEP 5: Fetch order notes in parallel to extract tracking numbers
      const orderTrackingMap = new Map<number, Array<{
        tracking_number: string;
        carrier: string;
        ship_date: string | null;
      }>>();

      await Promise.all(
        ordersArray.map(async (order: any) => {
          try {
            const notesUrl = `${apiUrl}/orders/${order.id}/notes`;
            const notesResponse = await fetch(notesUrl, {
              method: 'GET',
              headers: authHeaders,
            });

            if (notesResponse.ok) {
              const notesContentType = notesResponse.headers.get('content-type');
              if (notesContentType && notesContentType.includes('application/json')) {
                const notes = await notesResponse.json();
                const notesArray = Array.isArray(notes) ? notes : [notes];

                const trackingEntries: Array<{
                  tracking_number: string;
                  carrier: string;
                  ship_date: string | null;
                }> = [];
                const seenTrackingNumbers = new Set<string>();

                for (const note of notesArray) {
                  const noteText = note.note || '';
                  const tracking = extractTrackingFromNote(noteText);
                  if (tracking && !seenTrackingNumbers.has(tracking.tracking_number)) {
                    seenTrackingNumbers.add(tracking.tracking_number);
                    trackingEntries.push(tracking);
                  }
                }

                if (trackingEntries.length > 0) {
                  orderTrackingMap.set(order.id, trackingEntries);
                }
              }
            }
          } catch (notesError) {
            // Continue without notes - tracking will be empty for this order
            console.log(`[Orders API] Could not fetch notes for order ${order.id}: ${notesError}`);
          }
        })
      );

      console.log(`[Orders API] Extracted tracking info for ${orderTrackingMap.size} orders`);

      // STEP 6: Transform orders to return all required fields
      const enrichedOrders = ordersArray.map((order: any) => {
        // Filter meta_data to include tracking and medication_schedule ACF fields
        const relevantMetaData = (order.meta_data || []).filter((meta: any) => {
          const key = (meta.key || '');
          const keyLower = key.toLowerCase();
          
          // Include tracking entries
          if (keyLower.includes('tracking') || keyLower.includes('track')) {
            return true;
          }
          
          // Include medication_schedule ACF fields (without underscore prefix - these have actual values)
          if (key.startsWith('medication_schedule') && !key.startsWith('_')) {
            return true;
          }
          
          return false;
        });

        // Transform line items with required fields
        const transformedLineItems = (order.line_items || []).map((item: any) => {
          let imageSrc = null;

          // Get product image from cache (if available)
          if (item.product_id && productsMap.has(item.product_id)) {
            const product = productsMap.get(item.product_id);
            if (product.images && product.images.length > 0) {
              imageSrc = product.images[0].src || null;
            }
          }

          return {
            id: item.id,
            name: item.name || 'Unknown Product',
            quantity: item.quantity || 1,
            price: item.price || '0',
            total: item.total || '0',
            sku: item.sku || '',
            image: { src: imageSrc },
          };
        });

        // Get subscription IDs for this order from multiple sources:
        // 1. From order meta_data (for renewal/switch orders)
        // 2. From orderIdToSubscriptionIds map (for parent orders)
        const metaSubscriptionIds = extractSubscriptionIdsFromMeta(order);
        const parentSubscriptionIds = orderIdToSubscriptionIds.get(order.id) || [];
        const orderSubscriptionIds = [...new Set([...metaSubscriptionIds, ...parentSubscriptionIds])];
        
        // Check if this order is a parent of any subscription
        const isParentOfSubscription = parentSubscriptionIds.length > 0;
        
        // Determine order type at the order level
        const orderType = determineOrderType(order, isParentOfSubscription);

        // Build related_orders - include both related orders AND subscriptions
        const relatedOrdersList: any[] = [];
        
        // Add related orders (other orders sharing the same subscription)
        const relatedOrderIds: Set<number> = new Set();
        orderSubscriptionIds.forEach(subId => {
          const relatedIds = subscriptionOrdersMap.get(subId) || [];
          relatedIds.forEach(id => {
            if (id !== order.id) { // Exclude current order
              relatedOrderIds.add(id);
            }
          });
        });

        [...relatedOrderIds].forEach(relatedOrderId => {
          const relatedOrder = ordersById.get(relatedOrderId);
          if (!relatedOrder) return;
          
          // Check if related order is parent of any subscription
          const relatedIsParent = (orderIdToSubscriptionIds.get(relatedOrderId) || []).length > 0;
          const relatedType = determineOrderType(relatedOrder, relatedIsParent);
          
          // Determine relationship label
          let relationship = 'Related Order';
          if (relatedType === 'parent') relationship = 'Parent Order';
          else if (relatedType === 'renewal') relationship = 'Renewal Order';
          else if (relatedType === 'switch') relationship = 'Switch Order';
          else if (relatedType === 'resubscribe') relationship = 'Resubscribe Order';
          
          relatedOrdersList.push({
            id: relatedOrder.id,
            number: relatedOrder.number || `${relatedOrder.id}`,
            status: relatedOrder.status || 'unknown',
            date_created: relatedOrder.date_created || relatedOrder.date_created_gmt || null,
            total: relatedOrder.total || '0',
            type: relatedType,
            relationship: relationship,
          });
        });

        // Add related subscriptions to related_orders as well (with type: "subscription")
        orderSubscriptionIds.forEach(subId => {
          const subscription = subscriptionsMap.get(subId);
          if (subscription) {
            relatedOrdersList.push({
              id: subscription.id,
              number: subscription.number || `${subscription.id}`,
              status: subscription.status || 'unknown',
              date_created: subscription.date_created || subscription.date_created_gmt || null,
              total: subscription.total || '0',
              type: 'subscription',
              relationship: 'Subscription',
            });
          }
        });

        // Build related_subscriptions (separate array for subscription-specific data)
        const relatedSubscriptions = orderSubscriptionIds.map(subId => {
          const subscription = subscriptionsMap.get(subId);
          if (!subscription) {
            return {
              id: subId,
              number: `${subId}`,
              status: 'unknown',
              total: '0',
              billing_period: null,
            };
          }
          
          return {
            id: subscription.id,
            number: subscription.number || `${subscription.id}`,
            status: subscription.status || 'unknown',
            total: subscription.total || '0',
            billing_period: subscription.billing_period || null,
          };
        });

        // Return all required fields
        return {
          id: order.id,
          number: order.number || `${order.id}`,
          status: order.status || 'unknown',
          date_created: order.date_created || order.date_created_gmt || null,
          total: order.total || '0',
          currency: order.currency || 'USD',
          parent_id: order.parent_id || 0,
          type: orderType,
          payment_method: order.payment_method || null,
          payment_method_title: order.payment_method_title || null,
          billing: order.billing ? {
            first_name: order.billing.first_name || '',
            last_name: order.billing.last_name || '',
            email: order.billing.email || '',
            phone: order.billing.phone || '',
            address_1: order.billing.address_1 || '',
            address_2: order.billing.address_2 || '',
            city: order.billing.city || '',
            state: order.billing.state || '',
            postcode: order.billing.postcode || '',
            country: order.billing.country || '',
          } : null,
          shipping: order.shipping ? {
            first_name: order.shipping.first_name || '',
            last_name: order.shipping.last_name || '',
            address_1: order.shipping.address_1 || '',
            address_2: order.shipping.address_2 || '',
            city: order.shipping.city || '',
            state: order.shipping.state || '',
            postcode: order.shipping.postcode || '',
            country: order.shipping.country || '',
          } : null,
          line_items: transformedLineItems,
          subscription_ids: orderSubscriptionIds,
          related_orders: relatedOrdersList,
          related_subscriptions: relatedSubscriptions,
          meta_data: relevantMetaData,
          tracking: orderTrackingMap.get(order.id) || [],
        };
      });

      return {
        success: true,
        email: email,
        customerId: customerId,
        count: enrichedOrders.length,
        orders: enrichedOrders,
      };
    }

    // Get WooCommerce settings
    const settings = await getWooCommerceSettings();

    if (!settings || !settings.woocommerceApiUrl || !settings.woocommerceApiKey || !settings.woocommerceApiSecret) {
      return NextResponse.json(
        { error: 'WooCommerce API credentials are not configured. Please configure them in the admin settings.' },
        { status: 500 }
      );
    }

    // Fetch fresh data from WooCommerce
    let responseData;
    try {
      responseData = await fetchOrdersFromWooCommerce(normalizedEmail);
    } catch (error: any) {
      console.error('Failed to fetch orders from WooCommerce:', error);
      
      return NextResponse.json(
        {
          error: 'Failed to fetch orders from WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? error.message 
            : undefined,
        },
        { status: 500 }
      );
    }

    // Apply field filtering if requested (always include meta_data for orders)
    const filteredData = requestedFields
      ? {
          ...responseData,
          orders: filterFieldsArray(responseData.orders || [], requestedFields, {
            includeMetaData: true, // Always include meta_data for medication_schedule
          }),
        }
      : responseData;

    const responseTime = Date.now() - startTime;
    return NextResponse.json({
      ...filteredData,
      responseTime: `${responseTime}ms`,
    });
  } catch (error) {
    console.error('Get WooCommerce orders error:', error);
    
    // Return detailed error in development, generic in production
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while fetching orders from WooCommerce';

    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.stack
          : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Cancel WooCommerce Order Endpoint
 * 
 * This endpoint cancels an order in WooCommerce.
 * 
 * Request Body:
 * - orderId: Order ID to cancel (required)
 * - email: User email for verification (required)
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * 
 * Returns:
 * - Cancelled order details
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key
    let apiKey;
    try {
      apiKey = await validateApiKey(request);
    } catch (apiKeyError) {
      console.error('API key validation error:', apiKeyError);
      return NextResponse.json(
        { error: 'API key validation failed', details: process.env.NODE_ENV === 'development' ? (apiKeyError instanceof Error ? apiKeyError.message : 'Unknown error') : undefined },
        { status: 500 }
      );
    }
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key required.' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { orderId, email } = body;

    // Validate required fields
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required for order verification' },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Get WooCommerce settings from database
    const settings = await prisma.settings.findUnique({
      where: { id: 'settings' },
    });

    if (!settings || !settings.woocommerceApiUrl || !settings.woocommerceApiKey || !settings.woocommerceApiSecret) {
      return NextResponse.json(
        { error: 'WooCommerce API credentials are not configured. Please configure them in the admin settings.' },
        { status: 500 }
      );
    }

    // Prepare WooCommerce API URL
    let apiUrl = settings.woocommerceApiUrl.replace(/\/$/, '');
    
    // Auto-fix API URL if it's missing the wp-json path
    if (!apiUrl.includes('/wp-json/wc/')) {
      const baseUrl = apiUrl.replace(/\/wp-json.*$/, '');
      apiUrl = `${baseUrl}/wp-json/wc/v3`;
      console.warn(`WooCommerce API URL was missing /wp-json/wc/ path. Auto-corrected to: ${apiUrl}`);
    }
    
    // Validate API URL format
    if (!apiUrl.includes('/wp-json/wc/')) {
      return NextResponse.json(
        {
          error: 'Invalid WooCommerce API URL format',
          details: process.env.NODE_ENV === 'development' 
            ? `The API URL "${settings.woocommerceApiUrl}" is invalid. It should be in the format: https://yourstore.com/wp-json/wc/v3` 
            : 'Please check your WooCommerce API URL in admin settings.',
        },
        { status: 400 }
      );
    }

    // Create Basic Auth header for WooCommerce API
    const authString = Buffer.from(
      `${settings.woocommerceApiKey}:${settings.woocommerceApiSecret}`
    ).toString('base64');

    const authHeaders = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // First, verify the order exists and belongs to the user
    const orderUrl = `${apiUrl}/orders/${orderId}`;
    const orderResponse = await fetch(orderUrl, {
      method: 'GET',
      headers: authHeaders,
    });

    // Check if response is JSON
    const orderContentType = orderResponse.headers.get('content-type');
    const isOrderJson = orderContentType && orderContentType.includes('application/json');

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      
      if (!isOrderJson && errorText.includes('<!DOCTYPE')) {
        return NextResponse.json(
          {
            error: 'WooCommerce API returned an HTML page instead of JSON',
            details: process.env.NODE_ENV === 'development' 
              ? 'Please check your WooCommerce API URL and credentials.' 
              : undefined,
          },
          { status: 500 }
        );
      }

      if (orderResponse.status === 404) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch order from WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? `WooCommerce API returned ${orderResponse.status}: ${orderResponse.statusText}` 
            : undefined,
        },
        { status: orderResponse.status || 500 }
      );
    }

    // Parse order data
    let order;
    try {
      const orderText = await orderResponse.text();
      if (!isOrderJson) {
        return NextResponse.json(
          {
            error: 'WooCommerce API returned an invalid response format',
            details: process.env.NODE_ENV === 'development' 
              ? 'The API returned HTML or non-JSON content.' 
              : undefined,
          },
          { status: 500 }
        );
      }
      order = JSON.parse(orderText);
    } catch (parseError) {
      console.error('Failed to parse order response:', parseError);
      return NextResponse.json(
        {
          error: 'Failed to parse response from WooCommerce API',
          details: process.env.NODE_ENV === 'development' && parseError instanceof Error
            ? parseError.message
            : undefined,
        },
        { status: 500 }
      );
    }

    // Verify the order belongs to the user
    const orderEmail = order.billing?.email?.toLowerCase().trim() || order.customer_email?.toLowerCase().trim();
    if (orderEmail !== normalizedEmail) {
      return NextResponse.json(
        { error: 'Order does not belong to this user' },
        { status: 403 }
      );
    }

    // Check if order can be cancelled
    const cancellableStatuses = ['pending', 'processing', 'on-hold'];
    if (!cancellableStatuses.includes(order.status)) {
      return NextResponse.json(
        { 
          error: `Order cannot be cancelled. Current status: ${order.status}`,
          details: 'Only orders with status "pending", "processing", or "on-hold" can be cancelled.',
        },
        { status: 400 }
      );
    }

    // Cancel the order by updating status to "cancelled"
    const cancelResponse = await fetch(orderUrl, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'cancelled',
      }),
    });

    // Check if response is JSON
    const cancelContentType = cancelResponse.headers.get('content-type');
    const isCancelJson = cancelContentType && cancelContentType.includes('application/json');

    if (!cancelResponse.ok) {
      const errorText = await cancelResponse.text();
      console.error('WooCommerce cancel order error:', {
        status: cancelResponse.status,
        statusText: cancelResponse.statusText,
        error: errorText.substring(0, 500),
      });

      if (!isCancelJson && errorText.includes('<!DOCTYPE')) {
        return NextResponse.json(
          {
            error: 'WooCommerce API returned an HTML page instead of JSON',
            details: process.env.NODE_ENV === 'development' 
              ? 'Please check your WooCommerce API URL and credentials.' 
              : undefined,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to cancel order in WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? `WooCommerce API returned ${cancelResponse.status}: ${cancelResponse.statusText}` 
            : undefined,
        },
        { status: cancelResponse.status || 500 }
      );
    }

    // Parse cancelled order response
    let cancelledOrder;
    try {
      const cancelText = await cancelResponse.text();
      if (!isCancelJson) {
        return NextResponse.json(
          {
            error: 'WooCommerce API returned an invalid response format',
            details: process.env.NODE_ENV === 'development' 
              ? 'The API returned HTML or non-JSON content.' 
              : undefined,
          },
          { status: 500 }
        );
      }
      cancelledOrder = JSON.parse(cancelText);
    } catch (parseError) {
      console.error('Failed to parse cancel order response:', parseError);
      return NextResponse.json(
        {
          error: 'Failed to parse response from WooCommerce API',
          details: process.env.NODE_ENV === 'development' && parseError instanceof Error
            ? parseError.message
            : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      order: cancelledOrder,
    });
  } catch (error) {
    console.error('Cancel WooCommerce order error:', error);
    
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while cancelling the order';

    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.stack
          : undefined
      },
      { status: 500 }
    );
  }
}

