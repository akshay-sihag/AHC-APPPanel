import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';
import { getLocaleFromRequest, applyTranslation, applyTranslationsBatch } from '@/lib/translations';

/**
 * Public FAQ Categories API Endpoint for Mobile App
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Number of categories per page (default: 50, max: 100)
 * - search: Search term to filter categories by title
 * - id: Get a single category by ID
 *
 * Security:
 * - Requires valid API key in request headers
 * - Only returns categories with isActive: true
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
    const categoryId = searchParams.get('id');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = (page - 1) * limit;
    const locale = getLocaleFromRequest(request);

    // If requesting a single category by ID
    if (categoryId) {
      const parsedCategoryId = parseInt(categoryId);
      if (isNaN(parsedCategoryId)) {
        return NextResponse.json(
          { error: 'Invalid category ID' },
          { status: 400 }
        );
      }

      const category = await prisma.faqCategory.findFirst({
        where: { id: parsedCategoryId, isActive: true },
        include: {
          _count: {
            select: { faqs: { where: { isActive: true } } }
          }
        }
      });

      if (!category) {
        return NextResponse.json(
          { error: 'FAQ category not found or not active' },
          { status: 404 }
        );
      }

      // Apply translations
      const tCat = await applyTranslation(category as any, 'faq_category', String(category.id), locale);

      return NextResponse.json({
        success: true,
        locale,
        category: {
          id: category.id,
          title: tCat.title,
          order: category.order,
          faqCount: category._count.faqs,
          createdAt: category.createdAt.toISOString(),
          updatedAt: category.updatedAt.toISOString(),
        },
      });
    }

    // Build where clause for active categories only
    const where: any = {
      isActive: true,
    };

    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    // Get categories with pagination
    const [categories, total] = await Promise.all([
      prisma.faqCategory.findMany({
        where,
        include: {
          _count: {
            select: { faqs: { where: { isActive: true } } }
          }
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.faqCategory.count({ where }),
    ]);

    // Apply translations
    const tCats = await applyTranslationsBatch(categories as any[], 'faq_category', 'id', locale);

    return NextResponse.json({
      success: true,
      locale,
      categories: categories.map((cat, i) => {
        const tCat = tCats[i];
        return {
          id: cat.id,
          title: tCat.title,
          order: cat.order,
          faqCount: cat._count.faqs,
          createdAt: cat.createdAt.toISOString(),
          updatedAt: cat.updatedAt.toISOString(),
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Get public FAQ categories error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while fetching FAQ categories',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}
