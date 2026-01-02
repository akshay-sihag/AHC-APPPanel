import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware';

// Cache blogs for 5 minutes to reduce WordPress API calls
let cachedBlogs: any = null;
let blogsCacheTime = 0;
const BLOGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Enable Next.js caching for this route (60 seconds)
export const revalidate = 60;

/**
 * WooCommerce Blogs API Endpoint
 * 
 * GET: Retrieves the latest 2 blog posts from WordPress REST API.
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * - Fetches from WordPress REST API: https://alternatehealthclub.com/wp-json/wp/v2/posts
 * - Always returns the 2 most recent blogs ordered by date
 */
export async function GET(request: NextRequest) {
  try {
    // Validate API key
    const apiKey = await validateApiKey(request);
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key required.' },
        { status: 401 }
      );
    }

    // Check cache first
    const now = Date.now();
    if (cachedBlogs && (now - blogsCacheTime) < BLOGS_CACHE_TTL) {
      return NextResponse.json(cachedBlogs);
    }

    // WordPress REST API endpoint
    const WORDPRESS_API_URL = 'https://alternatehealthclub.com/wp-json/wp/v2/posts';
    
    // Fetch latest 2 posts from WordPress (optimized URL construction)
    const wordpressUrl = new URL(WORDPRESS_API_URL);
    wordpressUrl.searchParams.set('per_page', '2');
    wordpressUrl.searchParams.set('orderby', 'date');
    wordpressUrl.searchParams.set('order', 'desc');
    wordpressUrl.searchParams.set('status', 'publish');
    wordpressUrl.searchParams.set('_embed', '1');
    wordpressUrl.searchParams.set('_fields', 'id,title,excerpt,content,date,modified,link,slug,tags,_embedded');

    // Add timeout to prevent hanging (optimized - 3s timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    let wordpressResponse: Response;
    try {
      wordpressResponse = await fetch(wordpressUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
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
            error: 'Request timeout. WordPress API took too long to respond.',
            details: process.env.NODE_ENV === 'development' 
              ? 'The request exceeded 3 seconds. Please check your WordPress API connection.' 
              : undefined,
          },
          { status: 504 }
        );
      }
      throw fetchError;
    }

    if (!wordpressResponse.ok) {
      const errorText = await wordpressResponse.text();
      console.error('WordPress API error:', {
        status: wordpressResponse.status,
        statusText: wordpressResponse.statusText,
        error: errorText.substring(0, 500),
      });

      return NextResponse.json(
        {
          error: 'Failed to fetch blogs from WordPress',
          details: process.env.NODE_ENV === 'development' 
            ? `WordPress API returned ${wordpressResponse.status}: ${wordpressResponse.statusText}` 
            : undefined,
        },
        { status: wordpressResponse.status || 500 }
      );
    }

    // Parse WordPress response
    let wordpressPosts;
    try {
      wordpressPosts = await wordpressResponse.json();
    } catch (parseError) {
      console.error('Failed to parse WordPress response:', parseError);
      return NextResponse.json(
        {
          error: 'Failed to parse response from WordPress API',
          details: process.env.NODE_ENV === 'development' && parseError instanceof Error
            ? parseError.message
            : undefined,
        },
        { status: 500 }
      );
    }

    // Handle case where WordPress returns a single post object instead of array
    const postsArray = Array.isArray(wordpressPosts) ? wordpressPosts : [wordpressPosts];

    // Transform WordPress posts (optimized - minimal processing)
    const htmlStripRegex = /<[^>]*>/g;
    const blogs = postsArray.map((p: any) => {
      const excerpt = p.excerpt?.rendered ?? '';
      const content = p.content?.rendered ?? '';
      const featuredMedia = p._embedded?.['wp:featuredmedia']?.[0];
      
      // Extract tag names (optimized)
      const allTerms = p._embedded?.['wp:term'];
      const tagNames = allTerms && Array.isArray(allTerms)
        ? allTerms.flat()
            .filter((t: any) => t?.taxonomy === 'post_tag')
            .map((t: any) => t?.name ?? t?.slug ?? '')
            .filter(Boolean)
        : [];

      return {
        id: String(p.id ?? ''),
        title: p.title?.rendered ?? p.title ?? '',
        tagline: excerpt ? excerpt.replace(htmlStripRegex, '').trim().substring(0, 200) : '',
        description: content ? content.replace(htmlStripRegex, '').trim().substring(0, 500) : '',
        tags: tagNames.length > 0 ? tagNames : (p.tags ?? []),
        featuredImage: featuredMedia?.source_url ?? 
                       featuredMedia?.media_details?.sizes?.full?.source_url ?? 
                       featuredMedia?.media_details?.sizes?.large?.source_url ?? '',
        createdAt: p.date ?? p.date_gmt ?? new Date().toISOString(),
        updatedAt: p.modified ?? p.modified_gmt ?? new Date().toISOString(),
        link: p.link ?? '',
        slug: p.slug ?? '',
      };
    });

    const response = {
      success: true,
      count: blogs.length,
      blogs: blogs,
    };

    // Cache the response
    cachedBlogs = response;
    blogsCacheTime = now;

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get WooCommerce blogs error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while fetching blogs from WordPress',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}
