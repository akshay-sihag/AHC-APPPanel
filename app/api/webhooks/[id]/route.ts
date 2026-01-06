import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * Webhook Management Endpoint
 * 
 * GET: Get a specific webhook
 * PUT: Update a webhook
 * DELETE: Delete a webhook
 * 
 * Security:
 * - Requires admin session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get webhook
    const webhook = await prisma.webhook.findUnique({
      where: { id },
      include: {
        _count: {
          select: { deliveries: true },
        },
      },
    });

    if (!webhook) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    // Return webhook without secret
    return NextResponse.json({
      success: true,
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        description: webhook.description,
        headers: webhook.headers,
        lastTriggeredAt: webhook.lastTriggeredAt?.toISOString() || null,
        successCount: webhook.successCount,
        failureCount: webhook.failureCount,
        lastError: webhook.lastError,
        deliveryCount: webhook._count.deliveries,
        createdAt: webhook.createdAt.toISOString(),
        updatedAt: webhook.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get webhook error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while fetching webhook',
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.message
          : undefined
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, url, events, description, headers, secret, isActive } = body;

    // Check if webhook exists
    const existingWebhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!existingWebhook) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        );
      }
    }

    // Validate events if provided
    if (events && Array.isArray(events)) {
      const validEvents = [
        'user.created',
        'user.updated',
        'user.deleted',
        'weight.logged',
        'medication.logged',
        'user.registered',
        'user.login',
      ];

      const invalidEvents = events.filter((e: string) => !validEvents.includes(e));
      if (invalidEvents.length > 0) {
        return NextResponse.json(
          { 
            error: `Invalid event types: ${invalidEvents.join(', ')}`,
            validEvents,
          },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (url !== undefined) updateData.url = url;
    if (events !== undefined) updateData.events = events;
    if (description !== undefined) updateData.description = description;
    if (headers !== undefined) updateData.headers = headers;
    if (secret !== undefined) updateData.secret = secret;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update webhook
    const webhook = await prisma.webhook.update({
      where: { id },
      data: updateData,
    });

    // Return webhook without secret
    return NextResponse.json({
      success: true,
      message: 'Webhook updated successfully',
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        description: webhook.description,
        headers: webhook.headers,
        lastTriggeredAt: webhook.lastTriggeredAt?.toISOString() || null,
        successCount: webhook.successCount,
        failureCount: webhook.failureCount,
        lastError: webhook.lastError,
        createdAt: webhook.createdAt.toISOString(),
        updatedAt: webhook.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update webhook error:', error);
    
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while updating webhook';

    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.stack
          : undefined
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if webhook exists
    const webhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!webhook) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    // Delete webhook (cascade will delete deliveries)
    await prisma.webhook.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully',
    });
  } catch (error) {
    console.error('Delete webhook error:', error);
    
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while deleting webhook';

    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.stack
          : undefined
      },
      { status: 500 }
    );
  }
}
