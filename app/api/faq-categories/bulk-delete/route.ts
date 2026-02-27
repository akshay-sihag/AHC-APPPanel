import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { deleteTranslationsForEntities } from '@/lib/translations';

/**
 * Bulk Delete FAQ Categories
 *
 * Request Body:
 * {
 *   "ids": [1, 2, 3]
 * }
 *
 * Note: FAQs in deleted categories will have their categoryId set to null
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request. Expected array of IDs.' },
        { status: 400 }
      );
    }

    // Validate IDs are numbers
    const categoryIds = ids.map(id => parseInt(String(id))).filter(id => !isNaN(id) && id > 0);

    if (categoryIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid category IDs. Expected array of positive integers.' },
        { status: 400 }
      );
    }

    // Delete categories (FAQs will have categoryId set to null via onDelete: SetNull)
    const result = await prisma.faqCategory.deleteMany({
      where: {
        id: {
          in: categoryIds,
        },
      },
    });
    await deleteTranslationsForEntities('faq_category', categoryIds.map(String));

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.count} category(ies)`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('Bulk delete FAQ categories error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting FAQ categories' },
      { status: 500 }
    );
  }
}
