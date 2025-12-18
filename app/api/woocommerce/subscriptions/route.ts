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

    // First, try to get customer by email to get customer ID
    // This ensures we can fetch subscriptions reliably
    const customersUrl = new URL(`${apiUrl}/customers`);
    customersUrl.searchParams.append('email', normalizedEmail);
    customersUrl.searchParams.append('per_page', '1');

    const customersResponse = await fetch(customersUrl.toString(), {
      method: 'GET',
      headers: authHeaders,
    });

    let customerId: number | null = null;

    if (customersResponse.ok) {
      // Check if response is JSON before parsing
      const customersContentType = customersResponse.headers.get('content-type');
      const isCustomersJson = customersContentType && customersContentType.includes('application/json');
      
      if (isCustomersJson) {
        try {
          const customers = await customersResponse.json();
          const customersArray = Array.isArray(customers) ? customers : [customers];
          if (customersArray.length > 0 && customersArray[0].id) {
            customerId = customersArray[0].id;
          }
        } catch (parseError) {
          console.error('Failed to parse customers response:', parseError);
          // Continue without customer ID - will use email fallback
        }
      } else {
        // If customers endpoint returns HTML, log it but continue
        const errorText = await customersResponse.text();
        console.warn('WooCommerce customers API returned non-JSON response. Will use email for subscriptions lookup.');
        if (process.env.NODE_ENV === 'development') {
          console.log('Response preview:', errorText.substring(0, 200));
        }
        // If we get HTML, it might mean the API URL is wrong - but continue anyway
      }
    }

    // Fetch subscriptions from WooCommerce API
    // WooCommerce Subscriptions plugin uses /subscriptions endpoint
    // Try both v3 and v1 endpoints for compatibility
    let subscriptionsUrl: URL;
    let woocommerceResponse: Response;
    let subscriptions: any;

    // Try v3 endpoint first (newer WooCommerce versions)
    subscriptionsUrl = new URL(`${apiUrl}/subscriptions`);
    if (customerId) {
      subscriptionsUrl.searchParams.append('customer', customerId.toString());
    } else {
      // Fallback: try with email
      subscriptionsUrl.searchParams.append('customer', normalizedEmail);
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
      } else {
        subscriptionsUrl.searchParams.append('customer', normalizedEmail);
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
    let subscriptions;
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
    const subscriptionsArray = Array.isArray(subscriptions) ? subscriptions : [subscriptions];

    return NextResponse.json({
      success: true,
      email: normalizedEmail,
      count: subscriptionsArray.length,
      subscriptions: subscriptionsArray,
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

