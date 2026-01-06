import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * Webhooks Management Endpoint
 * 
 * GET: List all webhooks
 * POST: Create a new webhook
 * 
 * Security:
 * - Requires admin session
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const event = searchParams.get('event');

    // Build where clause
    const where: any = {};
    
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    if (event) {
      where.events = {
        has: event,
      };
    }

    // Get webhooks
    const webhooks = await prisma.webhook.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { deliveries: true },
        },
      },
    });

    // Format response (exclude secret)
    const formattedWebhooks = webhooks.map(webhook => ({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
      description: webhook.description,
      lastTriggeredAt: webhook.lastTriggeredAt?.toISOString() || null,
      successCount: webhook.successCount,
      failureCount: webhook.failureCount,
      lastError: webhook.lastError,
      headers: webhook.headers,
      deliveryCount: webhook._count.deliveries,
      createdAt: webhook.createdAt.toISOString(),
      updatedAt: webhook.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      webhooks: formattedWebhooks,
      count: formattedWebhooks.length,
    });
  } catch (error) {
    console.error('Get webhooks error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while fetching webhooks',
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.message
          : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, url, events, description, headers, secret } = body;

    // Validate required fields
    if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Name, URL, and events array are required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Validate events array
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

    // Generate secret if not provided
    let webhookSecret = secret;
    if (!webhookSecret) {
      webhookSecret = crypto.randomBytes(32).toString('hex');
    }

    // Create webhook
    const webhook = await prisma.webhook.create({
      data: {
        name,
        url,
        secret: webhookSecret,
        events,
        description: description || null,
        headers: headers || null,
        isActive: true,
      },
    });

    // Return webhook without secret (for security)
    return NextResponse.json({
      success: true,
      message: 'Webhook created successfully',
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        description: webhook.description,
        headers: webhook.headers,
        createdAt: webhook.createdAt.toISOString(),
        updatedAt: webhook.updatedAt.toISOString(),
        // Include secret only on creation
        secret: webhookSecret,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create webhook error:', error);
    
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while creating webhook';

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
