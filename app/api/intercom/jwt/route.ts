import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { validateApiKey } from '@/lib/middleware';

/**
 * Intercom JWT Endpoint
 *
 * This endpoint generates a JWT for Intercom Identity Verification.
 * The JWT is signed using the Intercom Identity Verification Secret.
 *
 * Request Body:
 * - user_id: string (required) - The unique identifier for the user
 * - email: string (optional) - The user's email address
 *
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 *
 * Response:
 * - jwt: string - The signed JWT token for Intercom verification
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key
    let apiKey;
    try {
      apiKey = await validateApiKey(request);
    } catch (apiKeyError) {
      console.error('API key validation error:', apiKeyError);
      return NextResponse.json(
        {
          error: 'API key validation failed',
          details: process.env.NODE_ENV === 'development'
            ? (apiKeyError instanceof Error ? apiKeyError.message : 'Unknown error')
            : undefined
        },
        { status: 500 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Intercom Identity Verification Secret from environment
    const intercomSecret = process.env.INTERCOM_IDENTITY_VERIFICATION_SECRET;

    if (!intercomSecret) {
      console.error('INTERCOM_IDENTITY_VERIFICATION_SECRET is not configured');
      return NextResponse.json(
        { error: 'Intercom identity verification is not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { user_id, email } = body;

    // Validate required fields
    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    // Build JWT payload
    const payload: { user_id: string; email?: string } = {
      user_id: String(user_id),
    };

    if (email) {
      payload.email = String(email);
    }

    // Sign the JWT with Intercom secret
    const token = jwt.sign(payload, intercomSecret, { expiresIn: '1h' });

    return NextResponse.json({ jwt: token });
  } catch (error) {
    console.error('Intercom JWT generation error:', error);

    // Return detailed error in development, generic in production
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while generating Intercom JWT';

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
