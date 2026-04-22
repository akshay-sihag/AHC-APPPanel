import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { deleteFromCloudinary, getPublicIdFromUrl } from '@/lib/cloudinary';

// GET - Get single bug report (admin)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const bugReport = await prisma.bugReport.findUnique({
      where: { id },
      include: {
        appUser: {
          select: {
            id: true,
            name: true,
            displayName: true,
            email: true,
            phone: true,
            status: true,
          },
        },
      },
    });

    if (!bugReport) {
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, bugReport });
  } catch (error) {
    console.error('Error fetching bug report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update bug report status (admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['open', 'resolved'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be "open" or "resolved"' },
        { status: 400 }
      );
    }

    const existingReport = await prisma.bugReport.findUnique({
      where: { id },
    });

    if (!existingReport) {
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 });
    }

    const bugReport = await prisma.bugReport.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      message: `Bug report marked as ${status}`,
      bugReport,
    });
  } catch (error) {
    console.error('Error updating bug report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete bug report (admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existingReport = await prisma.bugReport.findUnique({
      where: { id },
    });

    if (!existingReport) {
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 });
    }

    // Delete associated Cloudinary image if exists
    if (existingReport.image) {
      const publicId = getPublicIdFromUrl(existingReport.image);
      if (publicId) {
        await deleteFromCloudinary(publicId).catch((err) =>
          console.error('Failed to delete Cloudinary image:', err)
        );
      }
    }

    await prisma.bugReport.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Bug report deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting bug report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
