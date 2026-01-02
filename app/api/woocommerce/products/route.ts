import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

// Cache settings for 5 minutes to reduce database queries
let cachedSettings: any = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Enable Next.js caching for this route (60 seconds)
export const revalidate = 60;

/**
 * WooCommerce Products Endpoint
 * 
 * GET: Retrieves product data from WooCommerce.
 * 
 * GET Query Parameters:
 * - search: Search term to filter products by name (optional)
 * - category: Category ID to filter products (optional)
 * - per_page: Number of products per page (optional, default: 10)
 * - page: Page number for pagination (optional, default: 1)
 * - status: Product status filter - 'publish', 'draft', 'pending', 'private' (optional, default: 'publish')
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * 
 * Returns:
 * - List of products with details (name, price, images, description, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    // Parallel: Validate API key and get query parameters simultaneously
    const url = new URL(request.url);
    const [apiKey, searchParams] = await Promise.all([
      validateApiKey(request),
      Promise.resolve(url.searchParams),
    ]);
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key required.' },
        { status: 401 }
      );
    }

    // Get query parameters (already extracted)
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const perPage = searchParams.get('per_page') || '10';
    const page = searchParams.get('page') || '1';
    const status = searchParams.get('status') || 'publish';

    // Validate pagination parameters (optimized)
    const perPageNum = parseInt(perPage, 10);
    const pageNum = parseInt(page, 10);
    
    if (perPageNum < 1 || perPageNum > 100 || pageNum < 1) {
      return NextResponse.json(
        { error: perPageNum < 1 || perPageNum > 100 
          ? 'per_page must be a number between 1 and 100' 
          : 'page must be a positive number' },
        { status: 400 }
      );
    }

    // Get WooCommerce settings from database (with caching)
    let settings;
    const now = Date.now();
    if (cachedSettings && (now - settingsCacheTime) < SETTINGS_CACHE_TTL) {
      settings = cachedSettings;
    } else {
      settings = await prisma.settings.findUnique({
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
    }

    if (!settings || !settings.woocommerceApiUrl || !settings.woocommerceApiKey || !settings.woocommerceApiSecret) {
      return NextResponse.json(
        { error: 'WooCommerce API credentials are not configured. Please configure them in the admin settings.' },
        { status: 500 }
      );
    }

    // Prepare WooCommerce API URL (optimized)
    let apiUrl = settings.woocommerceApiUrl.endsWith('/') 
      ? settings.woocommerceApiUrl.slice(0, -1) 
      : settings.woocommerceApiUrl;
    
    // Auto-fix API URL if it's missing the wp-json path
    if (!apiUrl.includes('/wp-json/wc/')) {
      const baseUrl = apiUrl.split('/wp-json')[0] || apiUrl;
      apiUrl = `${baseUrl}/wp-json/wc/v3`;
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

    // Create Basic Auth header (cached in settings object if possible)
    const authString = Buffer.from(`${settings.woocommerceApiKey}:${settings.woocommerceApiSecret}`).toString('base64');
    const authHeaders = {
      'Authorization': `Basic ${authString}`,
      'Accept': 'application/json',
    };

    // Build products URL with query parameters (optimized)
    const productsUrl = new URL(`${apiUrl}/products`);
    productsUrl.searchParams.set('per_page', perPageNum.toString());
    productsUrl.searchParams.set('page', pageNum.toString());
    productsUrl.searchParams.set('status', status);
    
    if (search) productsUrl.searchParams.set('search', search);
    if (category) {
      const categoryNum = parseInt(category, 10);
      if (!isNaN(categoryNum)) productsUrl.searchParams.set('category', categoryNum.toString());
    }

    // Fetch products from WooCommerce API with timeout (optimized - 3s timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    let woocommerceResponse: Response;
    try {
      woocommerceResponse = await fetch(productsUrl.toString(), {
        method: 'GET',
        headers: authHeaders,
        signal: controller.signal,
        // Enable keep-alive for connection reuse
        keepalive: true,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          {
            error: 'Request timeout. WooCommerce API took too long to respond.',
            details: process.env.NODE_ENV === 'development' 
              ? 'The request exceeded 3 seconds. Please check your WooCommerce API connection.' 
              : undefined,
          },
          { status: 504 }
        );
      }
      throw fetchError;
    }

    // Check if response is JSON
    const contentType = woocommerceResponse.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!woocommerceResponse.ok) {
      const errorText = await woocommerceResponse.text();
      console.error('WooCommerce Products API error:', {
        status: woocommerceResponse.status,
        statusText: woocommerceResponse.statusText,
        contentType,
        error: errorText.substring(0, 500), // Limit error text length
      });

      // If HTML error page is returned, provide a better error message
      if (!isJson && errorText.includes('<!DOCTYPE')) {
        return NextResponse.json(
          {
            error: 'WooCommerce API returned an HTML error page. Please check your API credentials and URL.',
            details: process.env.NODE_ENV === 'development' 
              ? `Status: ${woocommerceResponse.status}. The API URL might be incorrect or authentication failed.` 
              : undefined,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch products from WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? `WooCommerce API returned ${woocommerceResponse.status}: ${woocommerceResponse.statusText}` 
            : undefined,
        },
        { status: woocommerceResponse.status || 500 }
      );
    }

    // Parse JSON response directly (optimized - no intermediate text())
    let products;
    try {
      if (!isJson) {
        const responseText = await woocommerceResponse.text();
        const isHtml = responseText.includes('<!DOCTYPE') || responseText.includes('<html');
        return NextResponse.json(
          {
            error: isHtml 
              ? 'WooCommerce API returned an HTML page instead of JSON'
              : 'WooCommerce API returned an invalid response format',
            details: process.env.NODE_ENV === 'development' 
              ? (isHtml 
                ? `The API URL "${apiUrl}" appears to be incorrect. Please verify the API URL in admin settings.`
                : 'The API returned non-JSON content. Please check your API URL and credentials.')
              : undefined,
          },
          { status: 500 }
        );
      }
      products = await woocommerceResponse.json();
    } catch (parseError) {
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

    // Handle case where WooCommerce returns a single product object instead of array
    const productsArray = Array.isArray(products) ? products : [products];

    // Get pagination info from response headers
    const totalProducts = woocommerceResponse.headers.get('x-wp-total');
    const totalPages = woocommerceResponse.headers.get('x-wp-totalpages');

    // Enrich products with formatted data (optimized - minimal processing)
    const enrichedProducts = productsArray.map((p: any) => ({
      id: p.id ?? null,
      name: p.name ?? '',
      slug: p.slug ?? '',
      permalink: p.permalink ?? '',
      type: p.type ?? 'simple',
      status: p.status ?? 'publish',
      featured: p.featured ?? false,
      description: p.description ?? '',
      short_description: p.short_description ?? '',
      sku: p.sku ?? '',
      price: p.price ?? '0',
      regular_price: p.regular_price ?? '0',
      sale_price: p.sale_price ?? '',
      on_sale: p.on_sale ?? false,
      stock_status: p.stock_status ?? 'instock',
      stock_quantity: p.stock_quantity ?? null,
      images: p.images ?? [],
      categories: p.categories ?? [],
      tags: p.tags ?? [],
      date_created: p.date_created ?? p.date_created_gmt ?? null,
      date_modified: p.date_modified ?? p.date_modified_gmt ?? null,
    }));

    return NextResponse.json({
      success: true,
      page: pageNum,
      per_page: perPageNum,
      total: totalProducts ? parseInt(totalProducts, 10) : enrichedProducts.length,
      total_pages: totalPages ? parseInt(totalPages, 10) : 1,
      count: enrichedProducts.length,
      products: enrichedProducts,
    });
  } catch (error) {
    console.error('Get WooCommerce products error:', error);
    
    // Return detailed error in development, generic in production
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while fetching products from WooCommerce';

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
