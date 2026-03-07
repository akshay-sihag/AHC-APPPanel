import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// PATCH /api/blogs/reorder
// Body: { ids: string[] } — ordered array of blog IDs
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    const { ids } = await request.json();
    if (!Array.isArray(ids)) {
      return NextResponse.json({ error: 'ids must be an array' }, { status: 400 });
    }

    await Promise.all(
      ids.map((id: string, index: number) =>
        prisma.blog.update({ where: { id }, data: { order: index } })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reorder blogs error:', error);
    return NextResponse.json({ error: 'An error occurred while reordering blogs' }, { status: 500 });
  }
}
