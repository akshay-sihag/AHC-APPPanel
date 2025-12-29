import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET single FAQ
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
    const faq = await prisma.fAQ.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!faq) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ faq });
  } catch (error) {
    console.error('Get FAQ error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching FAQ' },
      { status: 500 }
    );
  }
}

// UPDATE FAQ
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
    const { question, answer, order, isActive } = body;

    // Validate required fields
    if (!question || !answer) {
      return NextResponse.json(
        { error: 'Question and answer are required' },
        { status: 400 }
      );
    }

    // Check if FAQ exists
    const existingFaq = await prisma.fAQ.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!existingFaq) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      );
    }

    // Update FAQ
    const updatedFaq = await prisma.fAQ.update({
      where: { id: resolvedParams.id },
      data: {
        question: question.trim(),
        answer: answer.trim(),
        order: order !== undefined ? parseInt(order) : existingFaq.order,
        isActive: isActive !== undefined ? isActive : existingFaq.isActive,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'FAQ updated successfully',
      faq: updatedFaq,
    });
  } catch (error) {
    console.error('Update FAQ error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating FAQ' },
      { status: 500 }
    );
  }
}

// DELETE FAQ
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

    // Check if FAQ exists
    const existingFaq = await prisma.fAQ.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!existingFaq) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      );
    }

    // Delete FAQ
    await prisma.fAQ.delete({
      where: { id: resolvedParams.id },
    });

    return NextResponse.json({
      success: true,
      message: 'FAQ deleted successfully',
    });
  } catch (error) {
    console.error('Delete FAQ error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting FAQ' },
      { status: 500 }
    );
  }
}

