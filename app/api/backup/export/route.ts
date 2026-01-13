import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * Export Backup Data API
 * 
 * Exports medicines, medicine-categories, blogs, FAQs, and notifications as JSON
 * 
 * Query Parameters:
 * - entities: Comma-separated list of entities to export (medicines, medicine-categories, blogs, faqs, notifications)
 *   If not provided, exports all entities
 * 
 * Example:
 * GET /api/backup/export?entities=medicines,blogs
 * GET /api/backup/export (exports all)
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

    const { searchParams } = new URL(request.url);
    const entitiesParam = searchParams.get('entities');
    
    // Parse which entities to export
    const requestedEntities = entitiesParam 
      ? entitiesParam.split(',').map(e => e.trim().toLowerCase())
      : ['medicines', 'medicine-categories', 'blogs', 'faqs', 'notifications'];
    
    const exportData: any = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      entities: {},
    };

    // Export Medicine Categories (must be exported before medicines due to foreign key)
    // Always include categories if medicines are requested
    if (requestedEntities.includes('medicine-categories') || requestedEntities.includes('medicines')) {
      const categories = await prisma.medicineCategory.findMany({
        orderBy: { id: 'asc' },
      });
      
      exportData.entities['medicine-categories'] = categories.map(cat => ({
        id: cat.id,
        title: cat.title,
        tagline: cat.tagline,
        icon: cat.icon,
        createdAt: cat.createdAt.toISOString(),
        updatedAt: cat.updatedAt.toISOString(),
      }));
    }

    // Export Medicines
    if (requestedEntities.includes('medicines')) {
      const medicines = await prisma.medicine.findMany({
        include: {
          category: {
            select: {
              id: true,
              title: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });
      
      exportData.entities.medicines = medicines.map(med => ({
        id: med.id,
        categoryId: med.categoryId,
        categoryTitle: med.category.title, // Include for reference
        title: med.title,
        tagline: med.tagline,
        description: med.description,
        image: med.image,
        url: med.url,
        price: med.price,
        status: med.status,
        createdAt: med.createdAt.toISOString(),
        updatedAt: med.updatedAt.toISOString(),
      }));
    }

    // Export Blogs
    if (requestedEntities.includes('blogs')) {
      const blogs = await prisma.blog.findMany({
        orderBy: { createdAt: 'desc' },
      });
      
      exportData.entities.blogs = blogs.map(blog => ({
        id: blog.id,
        title: blog.title,
        tagline: blog.tagline,
        description: blog.description,
        tags: blog.tags,
        featuredImage: blog.featuredImage,
        status: blog.status,
        createdAt: blog.createdAt.toISOString(),
        updatedAt: blog.updatedAt.toISOString(),
      }));
    }

    // Export FAQs
    if (requestedEntities.includes('faqs')) {
      const faqs = await prisma.fAQ.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      });
      
      exportData.entities.faqs = faqs.map(faq => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        order: faq.order,
        isActive: faq.isActive,
        createdAt: faq.createdAt.toISOString(),
        updatedAt: faq.updatedAt.toISOString(),
      }));
    }

    // Export Notifications
    if (requestedEntities.includes('notifications')) {
      const notifications = await prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
      });
      
      exportData.entities.notifications = notifications.map(notif => ({
        id: notif.id,
        title: notif.title,
        description: notif.description,
        image: notif.image,
        url: notif.url,
        isActive: notif.isActive,
        receiverCount: notif.receiverCount,
        viewCount: notif.viewCount,
        createdAt: notif.createdAt.toISOString(),
        updatedAt: notif.updatedAt.toISOString(),
      }));
    }

    // Add summary
    exportData.summary = {
      'medicine-categories': exportData.entities['medicine-categories']?.length || 0,
      medicines: exportData.entities.medicines?.length || 0,
      blogs: exportData.entities.blogs?.length || 0,
      faqs: exportData.entities.faqs?.length || 0,
      notifications: exportData.entities.notifications?.length || 0,
    };

    // Return as JSON with proper headers for download
    return NextResponse.json(exportData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Export backup error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to export backup',
        details: process.env.NODE_ENV === 'development' && error instanceof Error 
          ? error.message 
          : undefined
      },
      { status: 500 }
    );
  }
}
