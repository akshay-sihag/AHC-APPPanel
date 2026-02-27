import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';
import { getLocaleFromRequest, applyTranslation, applyTranslationsBatch } from '@/lib/translations';

/**
 * Public FAQ API Endpoint for Mobile App
 *
 * This endpoint retrieves active FAQs for the Android app.
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Number of FAQs per page (default: 10, max: 50)
 * - search: Search term to filter FAQs by question or answer
 * - id: Get a single FAQ by ID (returns single FAQ object instead of array)
 * - categoryId: Filter FAQs by category ID
 * - groupByCategory: When "true", returns FAQs grouped by category
 *
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * - Only returns FAQs with isActive: true
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
    const faqId = searchParams.get('id');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50); // Max 50 per page (matching blogs)
    const skip = (page - 1) * limit;
    const locale = getLocaleFromRequest(request);
    const categoryIdParam = searchParams.get('categoryId');
    const groupByCategory = searchParams.get('groupByCategory') === 'true';

    // If requesting a single FAQ by ID
    if (faqId) {
      const faq = await prisma.fAQ.findFirst({
        where: {
          id: faqId,
          isActive: true, // Only return active FAQs
        },
        include: {
          category: { select: { id: true, title: true, order: true } },
        },
      });

      if (!faq) {
        return NextResponse.json(
          { error: 'FAQ not found or not active' },
          { status: 404 }
        );
      }

      // Apply translations
      const tFaq = await applyTranslation(faq as any, 'faq', faq.id, locale);

      // Translate category title if present
      let categoryTitle = faq.category?.title || null;
      if (faq.category) {
        const tCat = await applyTranslation(faq.category as any, 'faq_category', String(faq.category.id), locale);
        categoryTitle = tCat.title;
      }

      return NextResponse.json({
        success: true,
        locale,
        faq: {
          id: faq.id,
          question: tFaq.question,
          answer: tFaq.answer,
          order: faq.order,
          categoryId: faq.categoryId,
          categoryTitle,
          createdAt: faq.createdAt.toISOString(),
          updatedAt: faq.updatedAt.toISOString(),
        },
      });
    }

    // Build where clause for active FAQs only
    const where: any = {
      isActive: true, // Only return active FAQs
    };

    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryIdParam) {
      where.categoryId = parseInt(categoryIdParam);
    }

    // If groupByCategory, fetch all active FAQs (no pagination) and group them
    if (groupByCategory) {
      const faqs = await prisma.fAQ.findMany({
        where,
        orderBy: [
          { order: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          category: { select: { id: true, title: true, order: true } },
        },
      });

      // Apply FAQ translations
      const tFaqs = await applyTranslationsBatch(faqs as any[], 'faq', 'id', locale);

      // Collect unique categories
      const categoryMap = new Map<number | null, { id: number | null; title: string; order: number }>();
      for (const faq of faqs) {
        const key = faq.categoryId;
        if (!categoryMap.has(key)) {
          categoryMap.set(key, {
            id: faq.category?.id || null,
            title: faq.category?.title || 'Uncategorized',
            order: faq.category?.order ?? 999999,
          });
        }
      }

      // Translate category titles
      const categoryEntries = Array.from(categoryMap.entries());
      for (const [, catInfo] of categoryEntries) {
        if (catInfo.id !== null) {
          const tCat = await applyTranslation({ title: catInfo.title } as any, 'faq_category', String(catInfo.id), locale);
          catInfo.title = tCat.title;
        }
      }

      // Group FAQs by category
      const grouped: { category: { id: number | null; title: string }; faqs: any[] }[] = [];
      const faqsByCategory = new Map<number | null, any[]>();

      faqs.forEach((faq, i) => {
        const key = faq.categoryId;
        if (!faqsByCategory.has(key)) {
          faqsByCategory.set(key, []);
        }
        const tFaq = tFaqs[i];
        faqsByCategory.get(key)!.push({
          id: faq.id,
          question: tFaq.question,
          answer: tFaq.answer,
          order: faq.order,
          categoryId: faq.categoryId,
          createdAt: faq.createdAt.toISOString(),
          updatedAt: faq.updatedAt.toISOString(),
        });
      });

      // Sort categories by order, uncategorized last
      const sortedKeys = Array.from(categoryMap.entries())
        .sort((a, b) => a[1].order - b[1].order)
        .map(([key]) => key);

      for (const key of sortedKeys) {
        const catInfo = categoryMap.get(key)!;
        grouped.push({
          category: { id: catInfo.id, title: catInfo.title },
          faqs: faqsByCategory.get(key) || [],
        });
      }

      return NextResponse.json({
        success: true,
        locale,
        categories: grouped,
        total: faqs.length,
      });
    }

    // Standard paginated response
    const [faqs, total] = await Promise.all([
      prisma.fAQ.findMany({
        where,
        orderBy: [
          { order: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
        include: {
          category: { select: { id: true, title: true, order: true } },
        },
      }),
      prisma.fAQ.count({ where }),
    ]);

    // Apply FAQ translations
    const tFaqs = await applyTranslationsBatch(faqs as any[], 'faq', 'id', locale);

    // Collect unique categories for translation
    const uniqueCategories = new Map<number, { title: string }>();
    for (const faq of faqs) {
      if (faq.category && !uniqueCategories.has(faq.category.id)) {
        uniqueCategories.set(faq.category.id, { title: faq.category.title });
      }
    }

    // Translate category titles
    const translatedCategoryTitles = new Map<number, string>();
    for (const [catId, catData] of uniqueCategories.entries()) {
      const tCat = await applyTranslation(catData as any, 'faq_category', String(catId), locale);
      translatedCategoryTitles.set(catId, tCat.title);
    }

    return NextResponse.json({
      success: true,
      locale,
      faqs: faqs.map((faq, i) => {
        const tFaq = tFaqs[i];
        return {
          id: faq.id,
          question: tFaq.question,
          answer: tFaq.answer,
          order: faq.order,
          categoryId: faq.categoryId,
          categoryTitle: faq.category ? (translatedCategoryTitles.get(faq.category.id) || faq.category.title) : null,
          createdAt: faq.createdAt.toISOString(),
          updatedAt: faq.updatedAt.toISOString(),
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
    console.error('Get public FAQs error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while fetching FAQs',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}
