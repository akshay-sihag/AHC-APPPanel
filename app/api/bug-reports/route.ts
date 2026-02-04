import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { validateApiKey } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

// GET - List all bug reports (admin)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {};

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { reporterName: { contains: search, mode: 'insensitive' } },
        { reporterEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [bugReports, total, openCount, resolvedCount] = await Promise.all([
      prisma.bugReport.findMany({
        where: whereClause,
        include: {
          appUser: {
            select: {
              id: true,
              name: true,
              displayName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bugReport.count({ where: whereClause }),
      prisma.bugReport.count({ where: { status: 'open' } }),
      prisma.bugReport.count({ where: { status: 'resolved' } }),
    ]);

    return NextResponse.json({
      success: true,
      bugReports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total: openCount + resolvedCount,
        open: openCount,
        resolved: resolvedCount,
      },
    });
  } catch (error) {
    console.error('Error fetching bug reports:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create bug report (app user via API key)
export async function POST(request: NextRequest) {
  try {
    let apiKey;
    try {
      apiKey = await validateApiKey(request);
    } catch (apiKeyError) {
      console.error('API key validation error:', apiKeyError);
      return NextResponse.json(
        { error: 'API key validation failed' },
        { status: 500 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      image,
      platform,
      osVersion,
      deviceName,
      appVersion,
      wpUserId,
      email,
      name,
    } = body;

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json(
        { error: 'title and description are required' },
        { status: 400 }
      );
    }

    // Try to find the app user
    let appUser = null;
    if (wpUserId) {
      appUser = await prisma.appUser.findUnique({
        where: { wpUserId: String(wpUserId) },
        select: { id: true, name: true, displayName: true, email: true },
      });
    } else if (email) {
      appUser = await prisma.appUser.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: { id: true, name: true, displayName: true, email: true },
      });
    }

    const bugReport = await prisma.bugReport.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        image: image || null,
        platform: platform || null,
        osVersion: osVersion || null,
        deviceName: deviceName || null,
        appVersion: appVersion || null,
        appUserId: appUser?.id || null,
        reporterName: appUser?.displayName || appUser?.name || name || null,
        reporterEmail: appUser?.email || email || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Bug report submitted successfully',
        bugReport: {
          id: bugReport.id,
          title: bugReport.title,
          description: bugReport.description,
          image: bugReport.image,
          status: bugReport.status,
          platform: bugReport.platform,
          osVersion: bugReport.osVersion,
          deviceName: bugReport.deviceName,
          appVersion: bugReport.appVersion,
          reporterName: bugReport.reporterName,
          reporterEmail: bugReport.reporterEmail,
          createdAt: bugReport.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating bug report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
