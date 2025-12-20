import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
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
    const extension = originalName.split('.').pop() || 'png';
    const filename = `${timestamp}_${originalName}`;

    // Ensure the directory exists
    const uploadDir = join(process.cwd(), 'public', 'medicine', 'category-icons');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filepath = join(uploadDir, filename);
    
    await writeFile(filepath, buffer);

    // Return the public URL path
    const iconUrl = `/medicine/category-icons/${filename}`;

    return NextResponse.json({
      success: true,
      iconUrl,
      message: 'Icon uploaded successfully',
    });
  } catch (error) {
    console.error('Icon upload error:', error);
    return NextResponse.json(
      { error: 'An error occurred while uploading icon' },
      { status: 500 }
    );
  }
}

