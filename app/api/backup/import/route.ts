import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * Import Backup Data API
 * 
 * Imports medicines, medicine-categories, blogs, FAQs, and notifications from JSON backup
 * 
 * Request Body:
 * {
 *   "entities": {
 *     "medicine-categories": [...],
 *     "medicines": [...],
 *     "blogs": [...],
 *     "faqs": [...],
 *     "notifications": [...]
 *   },
 *   "options": {
 *     "mode": "replace" | "merge" | "skip-existing", // Default: "merge"
 *     "importEntities": ["medicines", "blogs", ...] // Optional: only import specified entities
 *   }
 * }
 * 
 * Import Modes:
 * - replace: Delete all existing data and import new data
 * - merge: Import new data, update existing records by ID, skip if ID exists (default)
 * - skip-existing: Only import records that don't exist (by ID)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { entities, options = {} } = body;
    
    if (!entities || typeof entities !== 'object') {
      return NextResponse.json(
        { error: 'Invalid backup data. Expected "entities" object.' },
        { status: 400 }
      );
    }

    const mode = options.mode || 'merge';
    const importEntities = options.importEntities || Object.keys(entities);
    
    const results: any = {
      success: true,
      imported: {},
      errors: {},
      summary: {},
    };

    // Import Medicine Categories first (medicines depend on them)
    if (importEntities.includes('medicine-categories') && entities['medicine-categories']) {
      try {
        const categories = entities['medicine-categories'];
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          // Delete all existing categories (this will cascade delete medicines)
          await prisma.medicineCategory.deleteMany({});
        }

        for (const cat of categories) {
          try {
            if (!cat.title) {
              errors.push(`Category missing title: ${JSON.stringify(cat)}`);
              continue;
            }

            if (mode === 'skip-existing') {
              const existing = await prisma.medicineCategory.findUnique({
                where: { id: cat.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            await prisma.medicineCategory.upsert({
              where: { id: cat.id },
              update: {
                title: cat.title,
                tagline: cat.tagline || null,
                icon: cat.icon || null,
              },
              create: {
                id: cat.id,
                title: cat.title,
                tagline: cat.tagline || null,
                icon: cat.icon || null,
              },
            });

            if (mode === 'replace' || !await prisma.medicineCategory.findUnique({ where: { id: cat.id } })) {
              imported++;
            } else {
              updated++;
            }
          } catch (error: any) {
            errors.push(`Category ${cat.id || cat.title}: ${error.message}`);
          }
        }

        results.imported['medicine-categories'] = { imported, updated, skipped, errors };
        results.summary['medicine-categories'] = imported + updated;
      } catch (error: any) {
        results.errors['medicine-categories'] = error.message;
        results.success = false;
      }
    }

    // Import Medicines
    if (importEntities.includes('medicines') && entities.medicines) {
      try {
        const medicines = entities.medicines;
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.medicine.deleteMany({});
        }

        for (const med of medicines) {
          try {
            if (!med.title || !med.categoryId) {
              errors.push(`Medicine missing required fields: ${JSON.stringify(med)}`);
              continue;
            }

            // Verify category exists
            const category = await prisma.medicineCategory.findUnique({
              where: { id: med.categoryId },
            });

            if (!category) {
              errors.push(`Medicine ${med.id || med.title}: Category ${med.categoryId} not found`);
              continue;
            }

            if (mode === 'skip-existing') {
              const existing = await prisma.medicine.findUnique({
                where: { id: med.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            await prisma.medicine.upsert({
              where: { id: med.id },
              update: {
                categoryId: med.categoryId,
                title: med.title,
                tagline: med.tagline || null,
                description: med.description || null,
                image: med.image || null,
                url: med.url || null,
                price: med.price || null,
                status: med.status || 'active',
              },
              create: {
                id: med.id,
                categoryId: med.categoryId,
                title: med.title,
                tagline: med.tagline || null,
                description: med.description || null,
                image: med.image || null,
                url: med.url || null,
                price: med.price || null,
                status: med.status || 'active',
              },
            });

            const existing = await prisma.medicine.findUnique({ where: { id: med.id } });
            if (!existing || (existing.createdAt.getTime() === new Date(med.createdAt).getTime())) {
              imported++;
            } else {
              updated++;
            }
          } catch (error: any) {
            errors.push(`Medicine ${med.id || med.title}: ${error.message}`);
          }
        }

        results.imported.medicines = { imported, updated, skipped, errors };
        results.summary.medicines = imported + updated;
      } catch (error: any) {
        results.errors.medicines = error.message;
        results.success = false;
      }
    }

    // Import Blogs
    if (importEntities.includes('blogs') && entities.blogs) {
      try {
        const blogs = entities.blogs;
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.blog.deleteMany({});
        }

        for (const blog of blogs) {
          try {
            if (!blog.title || !blog.tagline || !blog.description) {
              errors.push(`Blog missing required fields: ${JSON.stringify(blog)}`);
              continue;
            }

            if (mode === 'skip-existing') {
              const existing = await prisma.blog.findUnique({
                where: { id: blog.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            await prisma.blog.upsert({
              where: { id: blog.id },
              update: {
                title: blog.title,
                tagline: blog.tagline,
                description: blog.description,
                tags: blog.tags || [],
                featuredImage: blog.featuredImage,
                status: blog.status || 'published',
              },
              create: {
                id: blog.id,
                title: blog.title,
                tagline: blog.tagline,
                description: blog.description,
                tags: blog.tags || [],
                featuredImage: blog.featuredImage,
                status: blog.status || 'published',
              },
            });

            const existing = await prisma.blog.findUnique({ where: { id: blog.id } });
            if (!existing || (existing.createdAt.getTime() === new Date(blog.createdAt).getTime())) {
              imported++;
            } else {
              updated++;
            }
          } catch (error: any) {
            errors.push(`Blog ${blog.id || blog.title}: ${error.message}`);
          }
        }

        results.imported.blogs = { imported, updated, skipped, errors };
        results.summary.blogs = imported + updated;
      } catch (error: any) {
        results.errors.blogs = error.message;
        results.success = false;
      }
    }

    // Import FAQs
    if (importEntities.includes('faqs') && entities.faqs) {
      try {
        const faqs = entities.faqs;
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.fAQ.deleteMany({});
        }

        for (const faq of faqs) {
          try {
            if (!faq.question || !faq.answer) {
              errors.push(`FAQ missing required fields: ${JSON.stringify(faq)}`);
              continue;
            }

            if (mode === 'skip-existing') {
              const existing = await prisma.fAQ.findUnique({
                where: { id: faq.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            await prisma.fAQ.upsert({
              where: { id: faq.id },
              update: {
                question: faq.question,
                answer: faq.answer,
                order: faq.order || 0,
                isActive: faq.isActive !== undefined ? faq.isActive : true,
              },
              create: {
                id: faq.id,
                question: faq.question,
                answer: faq.answer,
                order: faq.order || 0,
                isActive: faq.isActive !== undefined ? faq.isActive : true,
              },
            });

            const existing = await prisma.fAQ.findUnique({ where: { id: faq.id } });
            if (!existing || (existing.createdAt.getTime() === new Date(faq.createdAt).getTime())) {
              imported++;
            } else {
              updated++;
            }
          } catch (error: any) {
            errors.push(`FAQ ${faq.id || faq.question}: ${error.message}`);
          }
        }

        results.imported.faqs = { imported, updated, skipped, errors };
        results.summary.faqs = imported + updated;
      } catch (error: any) {
        results.errors.faqs = error.message;
        results.success = false;
      }
    }

    // Import Notifications
    if (importEntities.includes('notifications') && entities.notifications) {
      try {
        const notifications = entities.notifications;
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.notification.deleteMany({});
        }

        for (const notif of notifications) {
          try {
            if (!notif.title || !notif.description) {
              errors.push(`Notification missing required fields: ${JSON.stringify(notif)}`);
              continue;
            }

            if (mode === 'skip-existing') {
              const existing = await prisma.notification.findUnique({
                where: { id: notif.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            await prisma.notification.upsert({
              where: { id: notif.id },
              update: {
                title: notif.title,
                description: notif.description,
                image: notif.image || null,
                url: notif.url || null,
                isActive: notif.isActive !== undefined ? notif.isActive : true,
                receiverCount: notif.receiverCount || 0,
                viewCount: notif.viewCount || 0,
              },
              create: {
                id: notif.id,
                title: notif.title,
                description: notif.description,
                image: notif.image || null,
                url: notif.url || null,
                isActive: notif.isActive !== undefined ? notif.isActive : true,
                receiverCount: notif.receiverCount || 0,
                viewCount: notif.viewCount || 0,
              },
            });

            const existing = await prisma.notification.findUnique({ where: { id: notif.id } });
            if (!existing || (existing.createdAt.getTime() === new Date(notif.createdAt).getTime())) {
              imported++;
            } else {
              updated++;
            }
          } catch (error: any) {
            errors.push(`Notification ${notif.id || notif.title}: ${error.message}`);
          }
        }

        results.imported.notifications = { imported, updated, skipped, errors };
        results.summary.notifications = imported + updated;
      } catch (error: any) {
        results.errors.notifications = error.message;
        results.success = false;
      }
    }

    return NextResponse.json(results, {
      status: results.success ? 200 : 207, // 207 Multi-Status if partial success
    });
  } catch (error) {
    console.error('Import backup error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to import backup',
        details: process.env.NODE_ENV === 'development' && error instanceof Error 
          ? error.message 
          : undefined
      },
      { status: 500 }
    );
  }
}
