import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * Dashboard Statistics API
 * 
 * Returns comprehensive statistics for the dashboard including:
 * - User statistics
 * - Content statistics (medicines, blogs, FAQs, notifications)
 * - Weight log statistics
 * - Activity trends
 * - Time-based data for charts
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

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // User Statistics
    const [
      totalUsers,
      activeUsers,
      activeUsersToday,
      usersWithFcmToken,
      newUsersLast7Days,
      newUsersLast30Days,
      usersByStatus,
    ] = await Promise.all([
      prisma.appUser.count(),
      prisma.appUser.count({ where: { status: 'Active' } }),
      prisma.appUser.count({ where: { lastLoginAt: { gte: last24Hours } } }),
      prisma.appUser.count({ where: { fcmToken: { not: null } } }),
      prisma.appUser.count({ where: { createdAt: { gte: last7Days } } }),
      prisma.appUser.count({ where: { createdAt: { gte: last30Days } } }),
      prisma.appUser.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    // User growth over last 30 days (for chart) - optimized batch query
    const userGrowthData = [];
    const userGrowthPromises = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      userGrowthPromises.push(
        prisma.appUser.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextDate,
            },
          },
        }).then(count => ({
          date: date.toISOString().split('T')[0],
          count,
        }))
      );
    }
    const userGrowthResults = await Promise.all(userGrowthPromises);
    userGrowthData.push(...userGrowthResults);

    // Content Statistics
    const [
      totalMedicines,
      activeMedicines,
      totalCategories,
      totalBlogs,
      publishedBlogs,
      totalFaqs,
      activeFaqs,
      totalNotifications,
      activeNotifications,
    ] = await Promise.all([
      prisma.medicine.count(),
      prisma.medicine.count({ where: { status: 'active' } }),
      prisma.medicineCategory.count(),
      prisma.blog.count(),
      prisma.blog.count({ where: { status: 'published' } }),
      prisma.fAQ.count(),
      prisma.fAQ.count({ where: { isActive: true } }),
      prisma.notification.count(),
      prisma.notification.count({ where: { isActive: true } }),
    ]);

    // Weight Log Statistics
    const [
      totalWeightLogs,
      weightLogsToday,
      weightLogsLast7Days,
      weightLogsLast30Days,
      uniqueUsersWithLogs,
    ] = await Promise.all([
      prisma.weightLog.count(),
      prisma.weightLog.count({ where: { createdAt: { gte: today } } }),
      prisma.weightLog.count({ where: { createdAt: { gte: last7Days } } }),
      prisma.weightLog.count({ where: { createdAt: { gte: last30Days } } }),
      prisma.weightLog.groupBy({
        by: ['appUserId'],
        _count: true,
      }).then(result => result.length),
    ]);

    // Weight logs over last 30 days (for chart) - optimized batch query
    const weightLogsData = [];
    const weightLogsPromises = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      weightLogsPromises.push(
        prisma.weightLog.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextDate,
            },
          },
        }).then(count => ({
          date: date.toISOString().split('T')[0],
          count,
        }))
      );
    }
    const weightLogsResults = await Promise.all(weightLogsPromises);
    weightLogsData.push(...weightLogsResults);

    // Medication Log Statistics
    const [
      totalMedicationLogs,
      medicationLogsToday,
      medicationLogsLast7Days,
    ] = await Promise.all([
      prisma.medicationLog.count(),
      prisma.medicationLog.count({ where: { createdAt: { gte: today } } }),
      prisma.medicationLog.count({ where: { createdAt: { gte: last7Days } } }),
    ]);

    // Notification Statistics
    const [
      totalNotificationViews,
      notificationViewsToday,
      topNotifications,
    ] = await Promise.all([
      prisma.notificationView.count(),
      prisma.notificationView.count({ where: { viewedAt: { gte: today } } }),
      prisma.notification.findMany({
        take: 5,
        orderBy: { viewCount: 'desc' },
        select: {
          id: true,
          title: true,
          viewCount: true,
          receiverCount: true,
        },
      }),
    ]);

    // Content creation over last 30 days - optimized batch query
    const contentCreationData = [];
    const contentCreationPromises = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      contentCreationPromises.push(
        Promise.all([
          prisma.blog.count({
            where: { createdAt: { gte: date, lt: nextDate } },
          }),
          prisma.medicine.count({
            where: { createdAt: { gte: date, lt: nextDate } },
          }),
          prisma.notification.count({
            where: { createdAt: { gte: date, lt: nextDate } },
          }),
        ]).then(([blogs, medicines, notifications]) => ({
          date: date.toISOString().split('T')[0],
          blogs,
          medicines,
          notifications,
        }))
      );
    }
    const contentCreationResults = await Promise.all(contentCreationPromises);
    contentCreationData.push(...contentCreationResults);

    // Category distribution
    const categoryDistribution = await prisma.medicineCategory.findMany({
      include: {
        _count: {
          select: { medicines: true },
        },
      },
      orderBy: {
        medicines: {
          _count: 'desc',
        },
      },
    });

    return NextResponse.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        activeToday: activeUsersToday,
        withFcmToken: usersWithFcmToken,
        newLast7Days: newUsersLast7Days,
        newLast30Days: newUsersLast30Days,
        byStatus: usersByStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>),
        growth: userGrowthData,
      },
      content: {
        medicines: {
          total: totalMedicines,
          active: activeMedicines,
        },
        categories: {
          total: totalCategories,
        },
        blogs: {
          total: totalBlogs,
          published: publishedBlogs,
        },
        faqs: {
          total: totalFaqs,
          active: activeFaqs,
        },
        notifications: {
          total: totalNotifications,
          active: activeNotifications,
        },
        creation: contentCreationData,
        categoryDistribution: categoryDistribution.map(cat => ({
          name: cat.title,
          medicines: cat._count.medicines,
        })),
      },
      weightLogs: {
        total: totalWeightLogs,
        today: weightLogsToday,
        last7Days: weightLogsLast7Days,
        last30Days: weightLogsLast30Days,
        uniqueUsers: uniqueUsersWithLogs,
        trends: weightLogsData,
      },
      medicationLogs: {
        total: totalMedicationLogs,
        today: medicationLogsToday,
        last7Days: medicationLogsLast7Days,
      },
      notifications: {
        totalViews: totalNotificationViews,
        viewsToday: notificationViewsToday,
        topNotifications,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}
