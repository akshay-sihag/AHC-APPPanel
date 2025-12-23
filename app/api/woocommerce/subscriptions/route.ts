import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

/**
 * Get WooCommerce Subscriptions by Customer Email Endpoint
 * 
 * This endpoint retrieves subscription data from WooCommerce based on the user's email.
 * Requires WooCommerce Subscriptions plugin to be installed.
 * 
 * Query Parameters:
 * - email: User email (required) - matches the wp_user_email from Flutter app
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * 
 * Returns:
 * - List of subscriptions for the specified customer email
 */
export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    // Validate email parameter
    if (!email) {
      return NextResponse.json(
        { error: 'Email query parameter is required' },
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
    // Remove trailing slash if present and ensure proper endpoint
    let apiUrl = settings.woocommerceApiUrl.replace(/\/$/, '');
    
    // Auto-fix API URL if it's missing the wp-json path
    // If URL doesn't contain /wp-json/wc/, try to construct it
    if (!apiUrl.includes('/wp-json/wc/')) {
      // Try to append the standard WooCommerce REST API path
      const baseUrl = apiUrl.replace(/\/wp-json.*$/, ''); // Remove any existing wp-json path
      apiUrl = `${baseUrl}/wp-json/wc/v3`; // Default to v3
      console.warn(`WooCommerce API URL was missing /wp-json/wc/ path. Auto-corrected to: ${apiUrl}`);
    }
    
    // Validate API URL format - should contain wp-json/wc/v3 or wp-json/wc/v1
    if (!apiUrl.includes('/wp-json/wc/')) {
      return NextResponse.json(
        {
          error: 'Invalid WooCommerce API URL format',
          details: process.env.NODE_ENV === 'development' 
            ? `The API URL "${settings.woocommerceApiUrl}" is invalid. It should be in the format: https://yourstore.com/wp-json/wc/v3 or https://yourstore.com/wp-json/wc/v1` 
            : 'Please check your WooCommerce API URL in admin settings. It should include /wp-json/wc/v3 or /wp-json/wc/v1',
        },
        { status: 400 }
      );
    }

    // Create Basic Auth header for WooCommerce API
    // WooCommerce uses Consumer Key as username and Consumer Secret as password
    const authString = Buffer.from(
      `${settings.woocommerceApiKey}:${settings.woocommerceApiSecret}`
    ).toString('base64');

    const authHeaders = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Try to get customer by email to get customer ID (optimized with timeout)
    // If this fails, we'll fetch all subscriptions and filter by email
    let customerId: number | null = null;
    
    try {
      const customersUrl = new URL(`${apiUrl}/customers`);
      customersUrl.searchParams.append('email', normalizedEmail);
      customersUrl.searchParams.append('per_page', '1');

      // Use AbortController for timeout to avoid hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const customersResponse = await fetch(customersUrl.toString(), {
        method: 'GET',
        headers: authHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (customersResponse.ok) {
        const customersContentType = customersResponse.headers.get('content-type');
        const isCustomersJson = customersContentType && customersContentType.includes('application/json');
        
        if (isCustomersJson) {
          try {
            const customers = await customersResponse.json();
            const customersArray = Array.isArray(customers) ? customers : [customers];
            if (customersArray.length > 0 && customersArray[0].id) {
              customerId = parseInt(customersArray[0].id);
            }
          } catch (parseError) {
            // Continue without customer ID
          }
        }
      }
    } catch (customerError) {
      // Timeout or error - continue without customer ID, will fetch all and filter
      if (process.env.NODE_ENV === 'development') {
        console.log('Customer lookup skipped or failed, will fetch all subscriptions and filter by email');
      }
    }

    // Fetch subscriptions from WooCommerce API
    // WooCommerce Subscriptions plugin uses /subscriptions endpoint
    // The customer parameter only accepts customer ID, not email
    let subscriptionsUrl: URL;
    let woocommerceResponse: Response;
    let subscriptions: any;

    // Try v3 endpoint first (newer WooCommerce versions)
    subscriptionsUrl = new URL(`${apiUrl}/subscriptions`);
    
    // Only use customer ID if we have it, otherwise fetch all and filter by email
    if (customerId) {
      subscriptionsUrl.searchParams.append('customer', customerId.toString());
    }
    subscriptionsUrl.searchParams.append('per_page', '100'); // Get up to 100 subscriptions

    woocommerceResponse = await fetch(subscriptionsUrl.toString(), {
      method: 'GET',
      headers: authHeaders,
    });

    // If v3 endpoint doesn't work, try v1 endpoint (older WooCommerce Subscriptions versions)
    if (!woocommerceResponse.ok && woocommerceResponse.status === 404) {
      const apiUrlV1 = apiUrl.replace('/wc/v3', '/wc/v1');
      subscriptionsUrl = new URL(`${apiUrlV1}/subscriptions`);
      if (customerId) {
        subscriptionsUrl.searchParams.append('customer', customerId.toString());
      }
      subscriptionsUrl.searchParams.append('per_page', '100');

      woocommerceResponse = await fetch(subscriptionsUrl.toString(), {
        method: 'GET',
        headers: authHeaders,
      });
    }

    // Check if response is JSON
    const contentType = woocommerceResponse.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!woocommerceResponse.ok) {
      const errorText = await woocommerceResponse.text();
      console.error('WooCommerce Subscriptions API error:', {
        status: woocommerceResponse.status,
        statusText: woocommerceResponse.statusText,
        contentType,
        error: errorText.substring(0, 500), // Limit error text length
      });

      // If HTML error page is returned, provide a better error message
      if (!isJson && errorText.includes('<!DOCTYPE')) {
        return NextResponse.json(
          {
            error: 'WooCommerce API returned an HTML page instead of JSON',
            details: process.env.NODE_ENV === 'development' 
              ? `The API URL "${apiUrl}" appears to be incorrect. It should point to your WooCommerce REST API endpoint (e.g., https://yourstore.com/wp-json/wc/v3). Please verify the API URL in admin settings.` 
              : 'Please check your WooCommerce API URL configuration in admin settings.',
          },
          { status: 500 }
        );
      }

      // Check if it's a 404 - might mean subscriptions plugin is not installed
      if (woocommerceResponse.status === 404) {
        return NextResponse.json(
          {
            error: 'WooCommerce Subscriptions plugin not found or not active',
            details: process.env.NODE_ENV === 'development' 
              ? 'The /subscriptions endpoint is not available. Please ensure WooCommerce Subscriptions plugin is installed and activated.' 
              : undefined,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch subscriptions from WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? `WooCommerce API returned ${woocommerceResponse.status}: ${woocommerceResponse.statusText}` 
            : undefined,
        },
        { status: woocommerceResponse.status || 500 }
      );
    }

    // Parse JSON response
    try {
      const responseText = await woocommerceResponse.text();
      if (!isJson) {
        console.error('WooCommerce Subscriptions API returned non-JSON response:', responseText.substring(0, 500));
        
        // Check if it's an HTML error page
        if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
          return NextResponse.json(
            {
              error: 'WooCommerce API returned an HTML page instead of JSON',
              details: process.env.NODE_ENV === 'development' 
                ? `The API URL "${apiUrl}" appears to be incorrect. It should point to your WooCommerce REST API endpoint (e.g., https://yourstore.com/wp-json/wc/v3). Please verify the API URL in admin settings.` 
                : 'Please check your WooCommerce API URL configuration in admin settings.',
            },
            { status: 500 }
          );
        }
        
        return NextResponse.json(
          {
            error: 'WooCommerce API returned an invalid response format',
            details: process.env.NODE_ENV === 'development' 
              ? 'The API returned HTML or non-JSON content. Please check your API URL and credentials.' 
              : undefined,
          },
          { status: 500 }
        );
      }
      subscriptions = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse WooCommerce subscriptions response:', parseError);
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

    // Handle case where WooCommerce returns a single subscription object instead of array
    let subscriptionsArray = Array.isArray(subscriptions) ? subscriptions : [subscriptions];

    // If we don't have customerId, filter subscriptions by email
    // Check both billing.email and customer_email fields
    if (!customerId && subscriptionsArray.length > 0) {
      subscriptionsArray = subscriptionsArray.filter((sub: any) => {
        const subEmail = (
          sub.billing?.email?.toLowerCase().trim() ||
          sub.customer_email?.toLowerCase().trim() ||
          sub.email?.toLowerCase().trim() ||
          ''
        );
        return subEmail === normalizedEmail;
      });
    }

    // If we have customerId but no subscriptions, try fetching without customer filter
    // and then filter by email (in case customer ID lookup was incorrect)
    if (customerId && subscriptionsArray.length === 0) {
      console.log('No subscriptions found with customer ID, trying to fetch all and filter by email');
      const allSubscriptionsUrl = new URL(`${apiUrl}/subscriptions`);
      allSubscriptionsUrl.searchParams.append('per_page', '100');
      
      const allSubscriptionsResponse = await fetch(allSubscriptionsUrl.toString(), {
        method: 'GET',
        headers: authHeaders,
      });

      if (allSubscriptionsResponse.ok) {
        const contentType = allSubscriptionsResponse.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');
        
        if (isJson) {
          try {
            const allSubscriptions = await allSubscriptionsResponse.json();
            const allSubscriptionsArray = Array.isArray(allSubscriptions) ? allSubscriptions : [allSubscriptions];
            
            // Filter by email
            subscriptionsArray = allSubscriptionsArray.filter((sub: any) => {
              const subEmail = (
                sub.billing?.email?.toLowerCase().trim() ||
                sub.customer_email?.toLowerCase().trim() ||
                sub.email?.toLowerCase().trim() ||
                ''
              );
              return subEmail === normalizedEmail;
            });
          } catch (parseError) {
            console.error('Failed to parse all subscriptions response:', parseError);
          }
        }
      }
    }

    // Ensure all subscriptions include all status information
    // Include all status fields: status, date_created, date_modified, next_payment_date, etc.
    const enrichedSubscriptions = subscriptionsArray.map((sub: any) => ({
      ...sub,
      // Ensure all status-related fields are included
      status: sub.status || 'unknown',
      date_created: sub.date_created || sub.date_created_gmt || null,
      date_modified: sub.date_modified || sub.date_modified_gmt || null,
      next_payment_date: sub.next_payment_date || sub.next_payment_date_gmt || null,
      end_date: sub.end_date || sub.end_date_gmt || null,
      trial_end_date: sub.trial_end_date || sub.trial_end_date_gmt || null,
      // Include all subscription statuses: active, on-hold, cancelled, expired, pending-cancel, etc.
    }));

    return NextResponse.json({
      success: true,
      email: normalizedEmail,
      customerId: customerId || null,
      count: enrichedSubscriptions.length,
      subscriptions: enrichedSubscriptions,
    });
  } catch (error) {
    console.error('Get WooCommerce subscriptions error:', error);
    
    // Return detailed error in development, generic in production
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while fetching subscriptions from WooCommerce';

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
 * Cancel or Manage WooCommerce Subscription Endpoint
 * 
 * This endpoint cancels, pauses, resumes, or updates a subscription in WooCommerce.
 * 
 * Request Body:
 * - subscriptionId: Subscription ID (required)
 * - email: User email for verification (required)
 * - action: Action to perform - 'cancel', 'pause', 'resume', 'update' (required)
 * - updateData: Optional data for update action (only for 'update' action)
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * 
 * Returns:
 * - Updated subscription details
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
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { 
          error: 'Invalid JSON in request body',
          details: process.env.NODE_ENV === 'development' && parseError instanceof Error
            ? parseError.message
            : undefined
        },
        { status: 400 }
      );
    }
    
    console.log('Subscription management request:', {
      subscriptionId: body.subscriptionId,
      email: body.email,
      action: body.action,
      hasUpdateData: !!body.updateData,
    });
    
    const { subscriptionId, email, action, updateData } = body;

    // Validate required fields
    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Ensure subscriptionId is a number (handle string conversion)
    const subscriptionIdNum = typeof subscriptionId === 'string' 
      ? parseInt(subscriptionId, 10) 
      : parseInt(String(subscriptionId), 10);
    
    if (isNaN(subscriptionIdNum)) {
      return NextResponse.json(
        { error: 'Subscription ID must be a valid number' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required for subscription verification' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required. Valid actions: cancel, pause, resume, update' },
        { status: 400 }
      );
    }

    const validActions = ['cancel', 'pause', 'resume', 'update'];
    if (!validActions.includes(action.toLowerCase())) {
      return NextResponse.json(
        { error: `Invalid action. Valid actions are: ${validActions.join(', ')}` },
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
    
    if (!apiUrl.includes('/wp-json/wc/')) {
      const baseUrl = apiUrl.replace(/\/wp-json.*$/, '');
      apiUrl = `${baseUrl}/wp-json/wc/v3`;
      console.warn(`WooCommerce API URL was missing /wp-json/wc/ path. Auto-corrected to: ${apiUrl}`);
    }
    
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

    // First, verify the subscription exists and belongs to the user
    // Use the numeric subscription ID
    let subscriptionUrl = `${apiUrl}/subscriptions/${subscriptionIdNum}`;
    
    // Try v3 endpoint first
    let subscriptionResponse = await fetch(subscriptionUrl, {
      method: 'GET',
      headers: authHeaders,
    });

    // If v3 doesn't work, try v1
    if (!subscriptionResponse.ok && subscriptionResponse.status === 404) {
      const apiUrlV1 = apiUrl.replace('/wc/v3', '/wc/v1');
      subscriptionUrl = `${apiUrlV1}/subscriptions/${subscriptionId}`;
      subscriptionResponse = await fetch(subscriptionUrl, {
        method: 'GET',
        headers: authHeaders,
      });
    }

    // Check if response is JSON
    const subscriptionContentType = subscriptionResponse.headers.get('content-type');
    const isSubscriptionJson = subscriptionContentType && subscriptionContentType.includes('application/json');

    if (!subscriptionResponse.ok) {
      const errorText = await subscriptionResponse.text();
      
      if (!isSubscriptionJson && errorText.includes('<!DOCTYPE')) {
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

      if (subscriptionResponse.status === 404) {
        return NextResponse.json(
          { error: 'Subscription not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch subscription from WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? `WooCommerce API returned ${subscriptionResponse.status}: ${subscriptionResponse.statusText}` 
            : undefined,
        },
        { status: subscriptionResponse.status || 500 }
      );
    }

    // Parse subscription data
    let subscription;
    try {
      const subscriptionText = await subscriptionResponse.text();
      if (!isSubscriptionJson) {
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
      subscription = JSON.parse(subscriptionText);
    } catch (parseError) {
      console.error('Failed to parse subscription response:', parseError);
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

    // Verify the subscription belongs to the user
    const subscriptionEmail = (
      subscription.billing?.email?.toLowerCase().trim() ||
      subscription.customer_email?.toLowerCase().trim() ||
      ''
    );
    if (subscriptionEmail !== normalizedEmail) {
      return NextResponse.json(
        { error: 'Subscription does not belong to this user' },
        { status: 403 }
      );
    }

    // Prepare update payload based on action
    let updatePayload: any = {};
    const actionLower = action.toLowerCase();

    // Check current subscription status to validate action
    const currentStatus = subscription.status?.toLowerCase() || '';
    
    if (actionLower === 'cancel') {
      // Cancel subscription - set status to cancelled
      if (currentStatus === 'cancelled') {
        return NextResponse.json(
          { 
            error: 'Subscription is already cancelled',
            currentStatus: subscription.status,
            subscription: subscription
          },
          { status: 400 }
        );
      }
      updatePayload = { status: 'cancelled' };
    } else if (actionLower === 'pause') {
      // Pause subscription - set status to on-hold
      // Check if already paused
      if (currentStatus === 'on-hold' || currentStatus === 'paused') {
        return NextResponse.json({
          success: true,
          message: 'Subscription is already paused',
          subscription: subscription
        });
      }
      // Only allow pausing active subscriptions
      if (currentStatus !== 'active') {
        return NextResponse.json(
          { 
            error: `Subscription cannot be paused. Current status: ${subscription.status}`,
            details: 'Only active subscriptions can be paused.',
            currentStatus: subscription.status,
            allowedStatuses: ['active']
          },
          { status: 400 }
        );
      }
      updatePayload = { status: 'on-hold' };
    } else if (actionLower === 'resume') {
      // Resume subscription - set status to active
      // Check if already active
      if (currentStatus === 'active') {
        return NextResponse.json({
          success: true,
          message: 'Subscription is already active',
          subscription: subscription
        });
      }
      // Only allow resuming paused/on-hold subscriptions
      if (currentStatus !== 'on-hold' && currentStatus !== 'paused') {
        return NextResponse.json(
          { 
            error: `Subscription cannot be resumed. Current status: ${subscription.status}`,
            details: 'Only paused (on-hold) subscriptions can be resumed.',
            currentStatus: subscription.status,
            allowedStatuses: ['on-hold', 'paused']
          },
          { status: 400 }
        );
      }
      updatePayload = { status: 'active' };
    } else if (actionLower === 'update') {
      // Update subscription with provided data
      if (!updateData || typeof updateData !== 'object') {
        return NextResponse.json(
          { error: 'updateData is required for update action' },
          { status: 400 }
        );
      }
      updatePayload = updateData;
    }

    // Update the subscription using PUT method
    // WooCommerce Subscriptions typically uses PUT /subscriptions/{id} with status update
    console.log(`Attempting to ${actionLower} subscription ${subscriptionIdNum} (original: ${subscriptionId})`, {
      currentStatus: subscription.status,
      updatePayload,
      subscriptionUrl,
    });

    const updateResponse = await fetch(subscriptionUrl, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(updatePayload),
    });

    // Check if response is JSON
    const updateContentType = updateResponse.headers.get('content-type');
    const isUpdateJson = updateContentType && updateContentType.includes('application/json');

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('WooCommerce update subscription error:', {
        subscriptionId: subscriptionIdNum,
        originalSubscriptionId: subscriptionId,
        action: actionLower,
        currentStatus: subscription.status,
        status: updateResponse.status,
        statusText: updateResponse.statusText,
        error: errorText.substring(0, 1000),
        updatePayload,
        subscriptionUrl,
      });

      // Try to parse error if it's JSON
      let errorDetails: any = {};
      try {
        if (isUpdateJson) {
          errorDetails = JSON.parse(errorText);
        }
      } catch (e) {
        // Not JSON, use raw text
      }

      if (!isUpdateJson && errorText.includes('<!DOCTYPE')) {
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

      // Return more detailed error information
      const errorMessage = errorDetails.message || errorDetails.error || `Failed to ${action} subscription in WooCommerce`;
      const errorCode = errorDetails.code || errorDetails.error_code || null;

      return NextResponse.json(
        {
          error: errorMessage,
          errorCode: errorCode,
          subscriptionId: subscriptionIdNum,
          currentStatus: subscription.status,
          attemptedAction: actionLower,
          details: process.env.NODE_ENV === 'development' 
            ? {
                wooCommerceStatus: updateResponse.status,
                wooCommerceStatusText: updateResponse.statusText,
                errorResponse: errorText.substring(0, 500),
                updatePayload,
              }
            : undefined,
        },
        { status: updateResponse.status || 500 }
      );
    }

    // Parse updated subscription response
    let updatedSubscription;
    try {
      const updateText = await updateResponse.text();
      if (!isUpdateJson) {
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
      updatedSubscription = JSON.parse(updateText);
    } catch (parseError) {
      console.error('Failed to parse update subscription response:', parseError);
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

    // Enrich subscription with all status fields
    const enrichedSubscription = {
      ...updatedSubscription,
      status: updatedSubscription.status || 'unknown',
      date_created: updatedSubscription.date_created || updatedSubscription.date_created_gmt || null,
      date_modified: updatedSubscription.date_modified || updatedSubscription.date_modified_gmt || null,
      next_payment_date: updatedSubscription.next_payment_date || updatedSubscription.next_payment_date_gmt || null,
      end_date: updatedSubscription.end_date || updatedSubscription.end_date_gmt || null,
      trial_end_date: updatedSubscription.trial_end_date || updatedSubscription.trial_end_date_gmt || null,
    };

    return NextResponse.json({
      success: true,
      message: `Subscription ${action}d successfully`,
      subscription: enrichedSubscription,
    });
  } catch (error) {
    console.error('Manage WooCommerce subscription error:', error);
    
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while managing the subscription';

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

