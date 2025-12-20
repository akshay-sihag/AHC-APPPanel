import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

/**
 * WooCommerce Billing Address Endpoint
 * 
 * GET: Retrieves billing address for a customer by email
 * PUT: Updates billing address for a customer by email
 * 
 * GET Query Parameters:
 * - email: User email (required)
 * 
 * PUT Request Body:
 * - email: User email (required)
 * - billing: Billing address object (required)
 *   - first_name: First name
 *   - last_name: Last name
 *   - company: Company name (optional)
 *   - address_1: Street address line 1
 *   - address_2: Street address line 2 (optional)
 *   - city: City
 *   - state: State/Province code
 *   - postcode: Postal/ZIP code
 *   - country: Country code (ISO 3166-1 alpha-2)
 *   - email: Email address
 *   - phone: Phone number
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
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

    // Get customer by email
    const customersUrl = new URL(`${apiUrl}/customers`);
    customersUrl.searchParams.append('email', normalizedEmail);
    customersUrl.searchParams.append('per_page', '1');

    const customersResponse = await fetch(customersUrl.toString(), {
      method: 'GET',
      headers: authHeaders,
    });

    // Check if response is JSON
    const customersContentType = customersResponse.headers.get('content-type');
    const isCustomersJson = customersContentType && customersContentType.includes('application/json');

    if (!customersResponse.ok) {
      const errorText = await customersResponse.text();
      
      if (!isCustomersJson && errorText.includes('<!DOCTYPE')) {
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

      if (customersResponse.status === 404) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch customer from WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? `WooCommerce API returned ${customersResponse.status}: ${customersResponse.statusText}` 
            : undefined,
        },
        { status: customersResponse.status || 500 }
      );
    }

    // Parse customer data
    let customers;
    try {
      const customersText = await customersResponse.text();
      if (!isCustomersJson) {
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
      customers = JSON.parse(customersText);
    } catch (parseError) {
      console.error('Failed to parse customers response:', parseError);
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

    const customersArray = Array.isArray(customers) ? customers : [customers];
    
    if (customersArray.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const customer = customersArray[0];

    // Extract billing address
    const billingAddress = {
      first_name: customer.billing?.first_name || '',
      last_name: customer.billing?.last_name || '',
      company: customer.billing?.company || '',
      address_1: customer.billing?.address_1 || '',
      address_2: customer.billing?.address_2 || '',
      city: customer.billing?.city || '',
      state: customer.billing?.state || '',
      postcode: customer.billing?.postcode || '',
      country: customer.billing?.country || '',
      email: customer.billing?.email || customer.email || normalizedEmail,
      phone: customer.billing?.phone || '',
    };

    return NextResponse.json({
      success: true,
      email: normalizedEmail,
      customerId: customer.id,
      billing: billingAddress,
    });
  } catch (error) {
    console.error('Get WooCommerce billing address error:', error);
    
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while fetching billing address from WooCommerce';

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
 * Update WooCommerce Billing Address
 */
export async function PUT(request: NextRequest) {
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
    const { email, billing } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!billing) {
      return NextResponse.json(
        { error: 'Billing address object is required' },
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

    // First, get customer by email to get customer ID
    const customersUrl = new URL(`${apiUrl}/customers`);
    customersUrl.searchParams.append('email', normalizedEmail);
    customersUrl.searchParams.append('per_page', '1');

    const customersResponse = await fetch(customersUrl.toString(), {
      method: 'GET',
      headers: authHeaders,
    });

    // Check if response is JSON
    const customersContentType = customersResponse.headers.get('content-type');
    const isCustomersJson = customersContentType && customersContentType.includes('application/json');

    if (!customersResponse.ok) {
      const errorText = await customersResponse.text();
      
      if (!isCustomersJson && errorText.includes('<!DOCTYPE')) {
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

      if (customersResponse.status === 404) {
        return NextResponse.json(
          { error: 'Customer not found. Please register first.' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch customer from WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? `WooCommerce API returned ${customersResponse.status}: ${customersResponse.statusText}` 
            : undefined,
        },
        { status: customersResponse.status || 500 }
      );
    }

    // Parse customer data
    let customers;
    try {
      const customersText = await customersResponse.text();
      if (!isCustomersJson) {
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
      customers = JSON.parse(customersText);
    } catch (parseError) {
      console.error('Failed to parse customers response:', parseError);
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

    const customersArray = Array.isArray(customers) ? customers : [customers];
    
    if (customersArray.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found. Please register first.' },
        { status: 404 }
      );
    }

    const customer = customersArray[0];
    const customerId = customer.id;

    // Prepare billing address update
    // Merge with existing billing data to preserve fields not being updated
    const updatedBilling = {
      ...customer.billing,
      ...billing,
      // Ensure email is set
      email: billing.email || normalizedEmail,
    };

    // Update customer billing address
    const updateUrl = `${apiUrl}/customers/${customerId}`;
    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        billing: updatedBilling,
      }),
    });

    // Check if response is JSON
    const updateContentType = updateResponse.headers.get('content-type');
    const isUpdateJson = updateContentType && updateContentType.includes('application/json');

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('WooCommerce update billing address error:', {
        status: updateResponse.status,
        statusText: updateResponse.statusText,
        error: errorText.substring(0, 500),
      });

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

      return NextResponse.json(
        {
          error: 'Failed to update billing address in WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? `WooCommerce API returned ${updateResponse.status}: ${updateResponse.statusText}` 
            : undefined,
        },
        { status: updateResponse.status || 500 }
      );
    }

    // Parse updated customer data
    let updatedCustomer;
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
      updatedCustomer = JSON.parse(updateText);
    } catch (parseError) {
      console.error('Failed to parse update response:', parseError);
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

    // Extract updated billing address
    const billingAddress = {
      first_name: updatedCustomer.billing?.first_name || '',
      last_name: updatedCustomer.billing?.last_name || '',
      company: updatedCustomer.billing?.company || '',
      address_1: updatedCustomer.billing?.address_1 || '',
      address_2: updatedCustomer.billing?.address_2 || '',
      city: updatedCustomer.billing?.city || '',
      state: updatedCustomer.billing?.state || '',
      postcode: updatedCustomer.billing?.postcode || '',
      country: updatedCustomer.billing?.country || '',
      email: updatedCustomer.billing?.email || updatedCustomer.email || normalizedEmail,
      phone: updatedCustomer.billing?.phone || '',
    };

    return NextResponse.json({
      success: true,
      message: 'Billing address updated successfully',
      email: normalizedEmail,
      customerId: updatedCustomer.id,
      billing: billingAddress,
    });
  } catch (error) {
    console.error('Update WooCommerce billing address error:', error);
    
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while updating billing address in WooCommerce';

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

