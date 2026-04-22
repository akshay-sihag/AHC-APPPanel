import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET all FAQ categories
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    // Get categories with pagination
    const [categories, total] = await Promise.all([
      prisma.faqCategory.findMany({
        where,
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          _count: {
            select: { faqs: true }
          }
        }
      }),
      prisma.faqCategory.count({ where }),
    ]);

    return NextResponse.json({
      categories: categories.map(cat => ({
        id: cat.id,
        title: cat.title,
        order: cat.order,
        isActive: cat.isActive,
        faqCount: cat._count.faqs,
        createdAt: cat.createdAt.toISOString(),
        updatedAt: cat.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get FAQ categories error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching FAQ categories' },
      { status: 500 }
    );
  }
}

// CREATE FAQ category
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
    const { title, order, isActive } = body;

    // Validate required fields
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Check if category with same title already exists
    const existingCategory = await prisma.faqCategory.findFirst({
      where: { title: { equals: title, mode: 'insensitive' } },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Category with this title already exists' },
        { status: 409 }
      );
    }

    // Auto-assign order if not provided
    let catOrder = order;
    if (catOrder === undefined || catOrder === null) {
      const lastCat = await prisma.faqCategory.findFirst({ orderBy: { order: 'desc' } });
      catOrder = (lastCat?.order || 0) + 1;
    }

    // Create category
    const category = await prisma.faqCategory.create({
      data: {
        title: title.trim(),
        order: catOrder,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'FAQ category created successfully',
      category: {
        id: category.id,
        title: category.title,
        order: category.order,
        isActive: category.isActive,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create FAQ category error:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating FAQ category' },
      { status: 500 }
    );
  }
}
