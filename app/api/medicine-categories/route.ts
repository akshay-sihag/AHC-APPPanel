import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET all medicine categories
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
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { tagline: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get categories with pagination
    const [categories, total] = await Promise.all([
      prisma.medicineCategory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { medicines: true }
          }
        }
      }),
      prisma.medicineCategory.count({ where }),
    ]);

    return NextResponse.json({
      categories: categories.map(cat => ({
        id: cat.id,
        title: cat.title,
        tagline: cat.tagline,
        icon: cat.icon,
        medicineCount: cat._count.medicines,
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
    console.error('Get medicine categories error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching medicine categories' },
      { status: 500 }
    );
  }
}

// CREATE medicine category
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
    const { title, tagline, icon } = body;

    // Validate required fields
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Check if category with same title already exists
    const existingCategory = await prisma.medicineCategory.findFirst({
      where: { title: { equals: title, mode: 'insensitive' } },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Category with this title already exists' },
        { status: 409 }
      );
    }

    // Create category
    const category = await prisma.medicineCategory.create({
      data: {
        title,
        tagline: tagline || null,
        icon: icon || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Medicine category created successfully',
      category: {
        id: category.id,
        title: category.title,
        tagline: category.tagline,
        icon: category.icon,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create medicine category error:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating medicine category' },
      { status: 500 }
    );
  }
}

