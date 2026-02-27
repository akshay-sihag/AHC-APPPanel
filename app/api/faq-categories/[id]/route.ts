import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { deleteTranslationsForEntity } from '@/lib/translations';

// GET single FAQ category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const resolvedParams = params instanceof Promise ? await params : params;

    const categoryId = parseInt(resolvedParams.id);
    if (isNaN(categoryId) || categoryId <= 0) {
      return NextResponse.json(
        { error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    const category = await prisma.faqCategory.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: { faqs: true }
        }
      }
    });

    if (!category) {
      return NextResponse.json(
        { error: 'FAQ category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      category: {
        id: category.id,
        title: category.title,
        order: category.order,
        isActive: category.isActive,
        faqCount: category._count.faqs,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      }
    });
  } catch (error) {
    console.error('Get FAQ category error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching FAQ category' },
      { status: 500 }
    );
  }
}

// UPDATE FAQ category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const resolvedParams = params instanceof Promise ? await params : params;

    const body = await request.json();
    const { title, order, isActive } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const categoryId = parseInt(resolvedParams.id);
    if (isNaN(categoryId) || categoryId <= 0) {
      return NextResponse.json(
        { error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    // Check if category exists
    const existingCategory = await prisma.faqCategory.findUnique({
      where: { id: categoryId },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: 'FAQ category not found' },
        { status: 404 }
      );
    }

    // If title is being updated, check for duplicates
    if (title && title !== existingCategory.title) {
      const duplicateCategory = await prisma.faqCategory.findFirst({
        where: {
          title: { equals: title, mode: 'insensitive' },
          id: { not: categoryId }
        },
      });

      if (duplicateCategory) {
        return NextResponse.json(
          { error: 'Category with this title already exists' },
          { status: 409 }
        );
      }
    }

    // Update category
    const updateData: any = {
      title: title.trim(),
    };

    if (order !== undefined) {
      updateData.order = order;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const category = await prisma.faqCategory.update({
      where: { id: categoryId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'FAQ category updated successfully',
      category: {
        id: category.id,
        title: category.title,
        order: category.order,
        isActive: category.isActive,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update FAQ category error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while updating FAQ category',
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.message
          : undefined
      },
      { status: 500 }
    );
  }
}

// DELETE FAQ category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const resolvedParams = params instanceof Promise ? await params : params;

    const categoryId = parseInt(resolvedParams.id);
    if (isNaN(categoryId) || categoryId <= 0) {
      return NextResponse.json(
        { error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    // Check if category exists
    const existingCategory = await prisma.faqCategory.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: { faqs: true }
        }
      }
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: 'FAQ category not found' },
        { status: 404 }
      );
    }

    // Delete category (FAQs will have categoryId set to null via onDelete: SetNull)
    await prisma.faqCategory.delete({
      where: { id: categoryId },
    });
    await deleteTranslationsForEntity('faq_category', String(categoryId));

    return NextResponse.json({
      success: true,
      message: `FAQ category deleted successfully. ${existingCategory._count.faqs} FAQ(s) have been uncategorized.`,
    });
  } catch (error) {
    console.error('Delete FAQ category error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting FAQ category' },
      { status: 500 }
    );
  }
}
