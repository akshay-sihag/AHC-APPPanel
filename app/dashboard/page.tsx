'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type DashboardStats = {
  users: {
    total: number;
    active: number;
    activeToday: number;
    withFcmToken: number;
    newLast7Days: number;
    newLast30Days: number;
    byStatus: Record<string, number>;
    growth: Array<{ date: string; count: number }>;
  };
  content: {
    medicines: { total: number; active: number };
    categories: { total: number };
    blogs: { total: number; published: number };
    faqs: { total: number; active: number };
    notifications: { total: number; active: number };
    creation: Array<{ date: string; blogs: number; medicines: number; notifications: number }>;
    categoryDistribution: Array<{ name: string; medicines: number }>;
  };
  weightLogs: {
    total: number;
    today: number;
    last7Days: number;
    last30Days: number;
    uniqueUsers: number;
    trends: Array<{ date: string; count: number }>;
  };
  medicationLogs: {
    total: number;
    today: number;
    last7Days: number;
  };
  notifications: {
    totalViews: number;
    viewsToday: number;
    topNotifications: Array<{ id: string; title: string; viewCount: number; receiverCount: number }>;
  };
};

const COLORS = ['#435970', '#7895b3', '#dfedfb', '#9bb5d1', '#6b8ba3', '#a8c4e0'];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/dashboard/stats', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          console.error('Failed to fetch dashboard stats');
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#435970]"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-[#7895b3]">Failed to load dashboard data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold text-[#435970] mb-1">Dashboard Overview</h3>
        <p className="text-[#7895b3]">Comprehensive analytics and insights</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-[#435970] bg-green-100 text-green-700 px-2 py-1 rounded">
              +{stats.users.newLast7Days} this week
            </span>
          </div>
          <h4 className="text-4xl font-bold text-[#435970] mb-1">{stats.users.total.toLocaleString()}</h4>
          <p className="text-sm text-[#7895b3]">Total Users</p>
          <p className="text-xs text-[#7895b3] mt-1">{stats.users.active} active</p>
        </div>

        {/* Active Users Today */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-[#435970] bg-blue-100 text-blue-700 px-2 py-1 rounded">Today</span>
          </div>
          <h4 className="text-4xl font-bold text-[#435970] mb-1">{stats.users.activeToday.toLocaleString()}</h4>
          <p className="text-sm text-[#7895b3]">Active Users</p>
          <p className="text-xs text-[#7895b3] mt-1">Last 24 hours</p>
        </div>

        {/* Total Content */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-[#435970] bg-purple-100 text-purple-700 px-2 py-1 rounded">Content</span>
          </div>
          <h4 className="text-4xl font-bold text-[#435970] mb-1">
            {(stats.content.medicines.total + stats.content.blogs.total + stats.content.faqs.total + stats.content.notifications.total).toLocaleString()}
          </h4>
          <p className="text-sm text-[#7895b3]">Total Content Items</p>
          <p className="text-xs text-[#7895b3] mt-1">
            {stats.content.medicines.total} medicines, {stats.content.blogs.total} blogs
          </p>
        </div>

        {/* Weight Logs */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-[#435970] bg-orange-100 text-orange-700 px-2 py-1 rounded">Today</span>
          </div>
          <h4 className="text-4xl font-bold text-[#435970] mb-1">{stats.weightLogs.today.toLocaleString()}</h4>
          <p className="text-sm text-[#7895b3]">Weight Logs</p>
          <p className="text-xs text-[#7895b3] mt-1">{stats.weightLogs.total.toLocaleString()} total</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-xl font-bold text-[#435970]">User Growth (Last 30 Days)</h4>
            <Link
              href="/dashboard/users"
              className="text-sm text-[#7895b3] hover:text-[#435970] transition-colors font-medium"
            >
              View All
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.users.growth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dfedfb" />
              <XAxis
                dataKey="date"
                stroke="#7895b3"
                tick={{ fill: '#7895b3', fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis stroke="#7895b3" tick={{ fill: '#7895b3', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #dfedfb',
                  borderRadius: '8px',
                }}
                labelFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString();
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#435970"
                strokeWidth={2}
                name="New Users"
                dot={{ fill: '#435970', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Weight Logs Trend */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-xl font-bold text-[#435970]">Weight Logs Trend (Last 30 Days)</h4>
            <Link
              href="/dashboard/log-data"
              className="text-sm text-[#7895b3] hover:text-[#435970] transition-colors font-medium"
            >
              View All
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.weightLogs.trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dfedfb" />
              <XAxis
                dataKey="date"
                stroke="#7895b3"
                tick={{ fill: '#7895b3', fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis stroke="#7895b3" tick={{ fill: '#7895b3', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #dfedfb',
                  borderRadius: '8px',
                }}
                labelFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString();
                }}
              />
              <Bar dataKey="count" fill="#7895b3" name="Weight Logs" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Content Creation Chart */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h4 className="text-xl font-bold text-[#435970] mb-6">Content Creation (Last 30 Days)</h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.content.creation}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dfedfb" />
              <XAxis
                dataKey="date"
                stroke="#7895b3"
                tick={{ fill: '#7895b3', fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis stroke="#7895b3" tick={{ fill: '#7895b3', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #dfedfb',
                  borderRadius: '8px',
                }}
                labelFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString();
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="blogs"
                stroke="#435970"
                strokeWidth={2}
                name="Blogs"
                dot={{ fill: '#435970', r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="medicines"
                stroke="#7895b3"
                strokeWidth={2}
                name="Medicines"
                dot={{ fill: '#7895b3', r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="notifications"
                stroke="#dfedfb"
                strokeWidth={2}
                name="Notifications"
                dot={{ fill: '#dfedfb', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h4 className="text-xl font-bold text-[#435970] mb-6">Medicine Category Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.content.categoryDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="medicines"
              >
                {stats.content.categoryDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #dfedfb',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Additional Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Medicines */}
        <Link href="/dashboard/medicines" className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
          </div>
          <h4 className="text-3xl font-bold text-[#435970] mb-1">{stats.content.medicines.total}</h4>
          <p className="text-sm text-[#7895b3]">Medicines</p>
          <p className="text-xs text-[#7895b3] mt-1">{stats.content.medicines.active} active</p>
        </Link>

        {/* Blogs */}
        <Link href="/dashboard/blogs" className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
          </div>
          <h4 className="text-3xl font-bold text-[#435970] mb-1">{stats.content.blogs.total}</h4>
          <p className="text-sm text-[#7895b3]">Blogs</p>
          <p className="text-xs text-[#7895b3] mt-1">{stats.content.blogs.published} published</p>
        </Link>

        {/* Notifications */}
        <Link href="/dashboard/notifications" className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
          </div>
          <h4 className="text-3xl font-bold text-[#435970] mb-1">{stats.content.notifications.total}</h4>
          <p className="text-sm text-[#7895b3]">Notifications</p>
          <p className="text-xs text-[#7895b3] mt-1">{stats.content.notifications.active} active</p>
        </Link>

        {/* FAQs */}
        <Link href="/dashboard/faqs" className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h4 className="text-3xl font-bold text-[#435970] mb-1">{stats.content.faqs.total}</h4>
          <p className="text-sm text-[#7895b3]">FAQs</p>
          <p className="text-xs text-[#7895b3] mt-1">{stats.content.faqs.active} active</p>
        </Link>
      </div>

      {/* Bottom Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Notifications */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h4 className="text-xl font-bold text-[#435970] mb-6">Top Notifications</h4>
          <div className="space-y-4">
            {stats.notifications.topNotifications.length === 0 ? (
              <p className="text-sm text-[#7895b3] text-center py-4">No notifications yet</p>
            ) : (
              stats.notifications.topNotifications.map((notif) => (
                <div key={notif.id} className="p-4 bg-[#dfedfb]/20 rounded-lg border border-[#dfedfb]">
                  <p className="text-sm font-semibold text-[#435970] mb-2">{notif.title}</p>
                  <div className="flex items-center justify-between text-xs text-[#7895b3]">
                    <span>👁️ {notif.viewCount} views</span>
                    <span>📤 {notif.receiverCount} sent</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activity Summary */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h4 className="text-xl font-bold text-[#435970] mb-6">Activity Summary</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-[#dfedfb]/20 rounded-lg">
              <span className="text-sm text-[#435970]">Weight Logs (7 days)</span>
              <span className="text-sm font-bold text-[#435970]">{stats.weightLogs.last7Days}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#dfedfb]/20 rounded-lg">
              <span className="text-sm text-[#435970]">Medication Logs (7 days)</span>
              <span className="text-sm font-bold text-[#435970]">{stats.medicationLogs.last7Days}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#dfedfb]/20 rounded-lg">
              <span className="text-sm text-[#435970]">Notification Views (Today)</span>
              <span className="text-sm font-bold text-[#435970]">{stats.notifications.viewsToday}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#dfedfb]/20 rounded-lg">
              <span className="text-sm text-[#435970]">Users with FCM Token</span>
              <span className="text-sm font-bold text-[#435970]">{stats.users.withFcmToken}</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h4 className="text-xl font-bold text-[#435970] mb-6">Quick Stats</h4>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-[#7895b3] mb-1">New Users (30 days)</p>
              <p className="text-2xl font-bold text-[#435970]">{stats.users.newLast30Days}</p>
            </div>
            <div>
              <p className="text-xs text-[#7895b3] mb-1">Total Weight Logs</p>
              <p className="text-2xl font-bold text-[#435970]">{stats.weightLogs.total.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-[#7895b3] mb-1">Unique Users Logging</p>
              <p className="text-2xl font-bold text-[#435970]">{stats.weightLogs.uniqueUsers}</p>
            </div>
            <div>
              <p className="text-xs text-[#7895b3] mb-1">Medicine Categories</p>
              <p className="text-2xl font-bold text-[#435970]">{stats.content.categories.total}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
