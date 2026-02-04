'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ConfirmModal from '@/app/components/ConfirmModal';
import NotificationModal from '@/app/components/NotificationModal';

type BugReport = {
  id: string;
  title: string;
  description: string;
  image: string | null;
  status: string;
  platform: string | null;
  osVersion: string | null;
  deviceName: string | null;
  appVersion: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  appUserId: string | null;
  appUser: {
    id: string;
    name: string | null;
    displayName: string | null;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type Stats = {
  total: number;
  open: number;
  resolved: number;
};

export default function BugReportsPage() {
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState<Stats>({ total: 0, open: 0, resolved: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Delete confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingReport, setDeletingReport] = useState<BugReport | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Notification modal
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  // Fetch bug reports
  const fetchBugReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('page', page.toString());
      params.append('limit', '20');

      const response = await fetch(`/api/bug-reports?${params.toString()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setBugReports(data.bugReports);
        setStats(data.stats);
        setTotalPages(data.pagination.totalPages);
      } else {
        console.error('Failed to fetch bug reports');
      }
    } catch (error) {
      console.error('Error fetching bug reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBugReports();
  }, [searchTerm, statusFilter, page]);

  // Update status
  const handleStatusToggle = async (report: BugReport) => {
    const newStatus = report.status === 'open' ? 'resolved' : 'open';
    try {
      const response = await fetch(`/api/bug-reports/${report.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setNotification({
          isOpen: true,
          title: 'Status Updated',
          message: `Bug report marked as ${newStatus}`,
          type: 'success',
        });
        fetchBugReports();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setNotification({
        isOpen: true,
        title: 'Error',
        message: 'Failed to update status',
        type: 'error',
      });
    }
  };

  // Delete
  const handleDeleteClick = (report: BugReport) => {
    setDeletingReport(report);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingReport) return;
    setDeleting(true);

    try {
      const response = await fetch(`/api/bug-reports/${deletingReport.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setDeleteModalOpen(false);
        setDeletingReport(null);
        setNotification({
          isOpen: true,
          title: 'Deleted',
          message: 'Bug report deleted successfully',
          type: 'success',
        });
        fetchBugReports();
      } else {
        const data = await response.json();
        setNotification({
          isOpen: true,
          title: 'Error',
          message: data.error || 'Failed to delete bug report',
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error deleting bug report:', error);
      setNotification({
        isOpen: true,
        title: 'Error',
        message: 'Failed to delete bug report',
        type: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  const getDeviceInfo = (report: BugReport) => {
    const parts = [];
    if (report.deviceName) parts.push(report.deviceName);
    if (report.osVersion) parts.push(report.osVersion);
    if (parts.length === 0 && report.platform) parts.push(report.platform);
    return parts.join(' - ') || '-';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#435970]">Bug Reports</h1>
          <p className="text-[#7895b3] text-sm">Manage bug reports submitted by app users</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#435970]/10 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#435970]">{stats.total}</p>
              <p className="text-xs text-[#7895b3]">Total Reports</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{stats.open}</p>
              <p className="text-xs text-[#7895b3]">Open</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
              <p className="text-xs text-[#7895b3]">Resolved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7895b3]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by title, description, reporter..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#435970]/20 focus:border-[#435970] transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {['all', 'open', 'resolved'].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-[#435970] text-white shadow-lg shadow-[#435970]/20'
                    : 'bg-gray-100 text-[#435970] hover:bg-gray-200'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bug Reports Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#435970]"></div>
        </div>
      ) : bugReports.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 bg-[#435970]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#435970] mb-2">No bug reports found</h3>
          <p className="text-[#7895b3]">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'No bug reports have been submitted yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-4 text-xs font-semibold text-[#7895b3] uppercase tracking-wider">Report</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-[#7895b3] uppercase tracking-wider">Reporter</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-[#7895b3] uppercase tracking-wider">Device / OS</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-[#7895b3] uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-[#7895b3] uppercase tracking-wider">Date</th>
                  <th className="text-right px-5 py-4 text-xs font-semibold text-[#7895b3] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bugReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Report */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {report.image ? (
                          <img
                            src={report.image}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          </div>
                        )}
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/bug-reports/${report.id}`}
                            className="font-semibold text-[#435970] text-sm hover:underline block truncate max-w-[250px]"
                          >
                            {report.title}
                          </Link>
                          <p className="text-xs text-[#7895b3] truncate max-w-[250px]">{report.description}</p>
                        </div>
                      </div>
                    </td>
                    {/* Reporter */}
                    <td className="px-5 py-4">
                      <div className="text-sm text-[#435970]">
                        {report.reporterName || report.appUser?.displayName || report.appUser?.name || '-'}
                      </div>
                      <div className="text-xs text-[#7895b3]">
                        {report.reporterEmail || report.appUser?.email || '-'}
                      </div>
                    </td>
                    {/* Device/OS */}
                    <td className="px-5 py-4">
                      <div className="text-sm text-[#435970]">{getDeviceInfo(report)}</div>
                      {report.appVersion && (
                        <div className="text-xs text-[#7895b3]">v{report.appVersion}</div>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                          report.status === 'open'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          report.status === 'open' ? 'bg-orange-500' : 'bg-green-500'
                        }`}></span>
                        {report.status === 'open' ? 'Open' : 'Resolved'}
                      </span>
                    </td>
                    {/* Date */}
                    <td className="px-5 py-4">
                      <div className="text-sm text-[#435970]">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-[#7895b3]">
                        {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/dashboard/bug-reports/${report.id}`}
                          className="p-2 text-[#435970] hover:bg-[#435970]/10 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleStatusToggle(report)}
                          className={`p-2 rounded-lg transition-colors ${
                            report.status === 'open'
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-orange-600 hover:bg-orange-50'
                          }`}
                          title={report.status === 'open' ? 'Mark as Resolved' : 'Reopen'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {report.status === 'open' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            )}
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(report)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <p className="text-sm text-[#7895b3]">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm font-medium text-[#435970] bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm font-medium text-[#435970] bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Bug Report"
        message={`Are you sure you want to delete "${deletingReport?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingReport(null);
        }}
        isLoading={deleting}
      />

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ ...notification, isOpen: false })}
      />
    </div>
  );
}
