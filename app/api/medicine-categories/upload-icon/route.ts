import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { uploadToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Check if Cloudinary is configured
    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { 
          error: 'Image storage not configured',
          details: 'Please configure Cloudinary credentials in .env (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)'
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('icon') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No icon file provided' },
        { status: 400 }
      );
    }

    // Validate file type - allow images and SVG
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'File must be an image (JPEG, PNG, GIF, WebP, or SVG)' },
        { status: 400 }
      );
    }

    // Validate file size (max 2MB for icons)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Icon size must be less than 2MB' },
        { status: 400 }
      );
    }

    // Create unique filename
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${originalName}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const result = await uploadToCloudinary(buffer, filename, 'ahc-category-icons');

    return NextResponse.json({
      success: true,
      iconUrl: result.secure_url, // Full HTTPS URL that works everywhere
      publicId: result.public_id, // For deletion if needed
      message: 'Icon uploaded successfully',
    });
  } catch (error) {
    console.error('Icon upload error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while uploading icon',
        details: process.env.NODE_ENV === 'development' && error instanceof Error 
          ? error.message 
          : undefined
      },
      { status: 500 }
    );
  }
}
