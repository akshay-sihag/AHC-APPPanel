import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test FCM Configuration - Debug endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const debug: Record<string, any> = {
      cwd: process.cwd(),
      env: {
        FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT ? 'SET (length: ' + process.env.FIREBASE_SERVICE_ACCOUNT.length + ')' : 'NOT SET',
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET',
      },
      keyFiles: [],
    };

    // Check for key files
    const localKeyPaths = [
      path.join(process.cwd(), 'key', 'key-1.json'),
      path.join(process.cwd(), 'key', 'firebase-key.json'),
      path.join(process.cwd(), 'key', 'service-account.json'),
      '/var/www/AHC-APPPanel/key/key-1.json',
    ];

    for (const keyPath of localKeyPaths) {
      const exists = fs.existsSync(keyPath);
      let content = null;
      let error = null;

      if (exists) {
        try {
          const fileContent = fs.readFileSync(keyPath, 'utf8');
          const parsed = JSON.parse(fileContent);
          content = {
            project_id: parsed.project_id,
            client_email: parsed.client_email,
            has_private_key: !!parsed.private_key,
          };
        } catch (e: any) {
          error = e.message;
        }
      }

      debug.keyFiles.push({
        path: keyPath,
        exists,
        content,
        error,
      });
    }

    // Try to list files in key directory
    const keyDir = path.join(process.cwd(), 'key');
    try {
      if (fs.existsSync(keyDir)) {
        debug.keyDirContents = fs.readdirSync(keyDir);
      } else {
        debug.keyDirContents = 'Directory does not exist';
      }
    } catch (e: any) {
      debug.keyDirContents = 'Error: ' + e.message;
    }

    // Try absolute path
    try {
      if (fs.existsSync('/var/www/AHC-APPPanel/key')) {
        debug.absoluteKeyDirContents = fs.readdirSync('/var/www/AHC-APPPanel/key');
      } else {
        debug.absoluteKeyDirContents = 'Directory does not exist';
      }
    } catch (e: any) {
      debug.absoluteKeyDirContents = 'Error: ' + e.message;
    }

    return NextResponse.json(debug);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
