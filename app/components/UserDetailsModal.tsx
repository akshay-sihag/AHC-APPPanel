'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatWeight } from '@/lib/unit-utils';
import LogShotFormModal, { type LogShotFormValues } from './LogShotFormModal';
import ConfirmModal from './ConfirmModal';

type User = {
  id: string;
  name: string;
  email: string;
  customerName?: string | null;
  status: string;
  lastLogin: string;
  weight: string;
  initialWeight: string;
  initialWeightDate?: string | null;
  goal: string;
  joinDate: string;
  phone?: string;
  age?: number;
  height?: string;
  feet?: string;
  streak?: number;
  woocommerceCustomerId?: number;
};

type MedicationEntry = {
  id: string;
  medicationName: string;
  nextDate?: string | null;
  time: string;
};

type CheckInDay = {
  date: string;
  hasCheckIn: boolean;
  checkInCount: number;
  medications: MedicationEntry[];
};

type WeightLog = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  date: string;
  weight: number;
  previousWeight: number | null;
  change: number | null;
  changeType: 'increase' | 'decrease' | 'no-change' | null;
};

type UserDevice = {
  id: string;
  deviceId: string;
  platform: string;
  deviceName: string | null;
  appVersion: string | null;
  lastActiveAt: string;
  createdAt: string;
};

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
}

export default function UserDetailsModal({ isOpen, onClose, userId }: UserDetailsModalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [checkInDays, setCheckInDays] = useState<CheckInDay[]>([]);
  const [checkInOffset, setCheckInOffset] = useState(0);
  const [checkInStreak, setCheckInStreak] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [userDevices, setUserDevices] = useState<UserDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCheckIns, setLoadingCheckIns] = useState(false);
  const [loadingWeightLogs, setLoadingWeightLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weightLogsPagination, setWeightLogsPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Log-shot editing state (admin-only backfill / corrections)
  const [logShotModalOpen, setLogShotModalOpen] = useState(false);
  const [logShotMode, setLogShotMode] = useState<'create' | 'edit'>('create');
  const [editingLog, setEditingLog] = useState<{ id: string; values: LogShotFormValues } | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [deletingLog, setDeletingLog] = useState(false);

  // Reset state when modal closes or userId changes
  useEffect(() => {
    if (!isOpen) {
      setUser(null);
      setCheckInDays([]);
      setCheckInOffset(0);
      setCheckInStreak(0);
      setSelectedDate(null);
      setWeightLogs([]);
      setUserDevices([]);
      setError(null);
      setWeightLogsPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
      setLogShotModalOpen(false);
      setEditingLog(null);
      setDeletingLogId(null);
    }
  }, [isOpen]);

  // Escape key & body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Fetch user details
  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchUser = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/app-users/${userId}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to fetch user details');
        }
        const data = await response.json();
        setUser(data.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [isOpen, userId]);

  // Fetch devices
  useEffect(() => {
    if (!user) return;
    const fetchDevices = async () => {
      try {
        setLoadingDevices(true);
        const response = await fetch(`/api/app-users/${user.id}/devices`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setUserDevices(data.devices || []);
        }
      } catch (err) {
        console.error('Error fetching user devices:', err);
      } finally {
        setLoadingDevices(false);
      }
    };
    fetchDevices();
  }, [user]);

  // Fetch check-ins (monthly view)
  const refreshCheckIns = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingCheckIns(true);
      const response = await fetch(
        `/api/app-users/daily-checkin?userId=${user.id}&view=month&offset=${checkInOffset}`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setCheckInDays(data.data || []);
        setCheckInStreak(data.statistics?.currentStreak || 0);
      }
    } catch (err) {
      console.error('Error fetching daily check-ins:', err);
    } finally {
      setLoadingCheckIns(false);
    }
  }, [user, checkInOffset]);

  useEffect(() => {
    refreshCheckIns();
  }, [refreshCheckIns]);

  // Fetch weight logs
  useEffect(() => {
    if (!user) return;
    const fetchWeightLogs = async () => {
      try {
        setLoadingWeightLogs(true);
        const params = new URLSearchParams({
          page: weightLogsPagination.page.toString(),
          limit: weightLogsPagination.limit.toString(),
          search: user.email,
        });
        const response = await fetch(`/api/weight-logs?${params.toString()}`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch weight logs');
        const data = await response.json();
        setWeightLogs(data.logs || []);
        setWeightLogsPagination(data.pagination);
      } catch (err) {
        console.error('Error fetching weight logs:', err);
      } finally {
        setLoadingWeightLogs(false);
      }
    };
    fetchWeightLogs();
  }, [user, weightLogsPagination.page, weightLogsPagination.limit]);

  const handleWeightLogsPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= weightLogsPagination.totalPages) {
      setWeightLogsPagination({ ...weightLogsPagination, page: newPage });
    }
  };

  const openAddLogShot = () => {
    setLogShotMode('create');
    setEditingLog(null);
    setLogShotModalOpen(true);
  };

  const openEditLogShot = (entry: MedicationEntry) => {
    const timeDate = new Date(entry.time);
    const hh = String(timeDate.getUTCHours()).padStart(2, '0');
    const mm = String(timeDate.getUTCMinutes()).padStart(2, '0');
    const logDate = timeDate.toISOString().split('T')[0];
    setLogShotMode('edit');
    setEditingLog({
      id: entry.id,
      values: {
        date: logDate,
        time: `${hh}:${mm}`,
        medicationName: entry.medicationName === 'default' ? '' : entry.medicationName,
        nextDate: entry.nextDate ? entry.nextDate.split('T')[0] : '',
      },
    });
    setLogShotModalOpen(true);
  };

  const submitLogShot = async (values: LogShotFormValues) => {
    if (!user) throw new Error('User not loaded');

    if (logShotMode === 'create') {
      const url = `/api/app-users/daily-checkin?date=${values.date}&time=${values.time}`;
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          medicationName: values.medicationName,
          nextDate: values.nextDate || undefined,
          skipNotifications: true,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.alreadyCheckedIn) {
        throw new Error(data.error || (data.alreadyCheckedIn
          ? 'A log entry already exists for this date and medication.'
          : 'Failed to add log entry.'));
      }
    } else if (editingLog) {
      const response = await fetch('/api/app-users/daily-checkin', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingLog.id,
          date: values.date,
          time: values.time,
          medicationName: values.medicationName,
          nextDate: values.nextDate || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update log entry.');
      }
    }

    setLogShotModalOpen(false);
    setEditingLog(null);
    await refreshCheckIns();
  };

  const confirmDeleteLogShot = async () => {
    if (!deletingLogId) return;
    try {
      setDeletingLog(true);
      const response = await fetch(`/api/app-users/daily-checkin?id=${deletingLogId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete log entry.');
      }
      setDeletingLogId(null);
      await refreshCheckIns();
    } catch (err) {
      console.error('Delete log shot error:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete log entry.');
    } finally {
      setDeletingLog(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[90vw] lg:w-[70vw] max-w-[1400px] max-h-[90vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#dfedfb] flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-[#435970]">User Details</h3>
            <p className="text-sm text-[#7895b3]">Comprehensive user information and activity</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#fafcfe]">
          {loading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#435970]"></div>
                <p className="mt-4 text-[#7895b3]">Loading user details...</p>
              </div>
            </div>
          ) : error || !user ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <p className="text-red-500 mb-4">{error || 'User not found'}</p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-[#435970] text-white rounded-lg hover:bg-[#7895b3] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* User Profile Card */}
              <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
                <div className="flex items-center gap-6 pb-6 border-b border-[#dfedfb]">
                  <div className="w-20 h-20 bg-[#435970] rounded-full flex items-center justify-center text-white font-semibold text-2xl flex-shrink-0">
                    {(user.customerName || user.name).split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-2xl font-bold text-[#435970] mb-1 truncate">
                      {user.customerName || user.name}
                    </h4>
                    <p className="text-[#7895b3] mb-2 truncate">{user.email}</p>
                    <span
                      className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                        user.status === 'Active'
                          ? 'bg-[#dfedfb] text-[#435970]'
                          : 'bg-[#dfedfb]/50 text-[#7895b3]'
                      }`}
                    >
                      {user.status}
                    </span>
                  </div>
                </div>

                {/* User Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h5 className="text-lg font-semibold text-[#435970] mb-3">Basic Information</h5>
                    <div className="space-y-3">
                      {user.customerName && (
                        <div>
                          <p className="text-xs text-[#7895b3] mb-1">Customer Name</p>
                          <p className="text-sm font-medium text-[#435970]">{user.customerName}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-[#7895b3] mb-1">Username</p>
                        <p className="text-sm font-medium text-[#435970]">{user.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#7895b3] mb-1">Email Address</p>
                        <p className="text-sm font-medium text-[#435970] break-all">{user.email}</p>
                      </div>
                      {user.phone && (
                        <div>
                          <p className="text-xs text-[#7895b3] mb-1">Phone Number</p>
                          <p className="text-sm font-medium text-[#435970]">{user.phone}</p>
                        </div>
                      )}
                      {user.age && (
                        <div>
                          <p className="text-xs text-[#7895b3] mb-1">Age</p>
                          <p className="text-sm font-medium text-[#435970]">{user.age} years</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-[#7895b3] mb-1">Join Date</p>
                        <p className="text-sm font-medium text-[#435970]">
                          {new Date(user.joinDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      {user.woocommerceCustomerId && (
                        <div>
                          <p className="text-xs text-[#7895b3] mb-1">WooCommerce Customer ID</p>
                          <p className="text-sm font-medium text-[#435970]">
                            #{user.woocommerceCustomerId}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fitness Information */}
                  <div className="space-y-4">
                    <h5 className="text-lg font-semibold text-[#435970] mb-3">Fitness Information</h5>
                    <div className="space-y-3">
                      {(user.height || user.feet) && (
                        <div>
                          <p className="text-xs text-[#7895b3] mb-1">Height</p>
                          <p className="text-sm font-medium text-[#435970]">
                            {user.feet || user.height || 'N/A'}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-[#7895b3] mb-1">Starting Weight</p>
                        <p className="text-sm font-medium text-[#435970]">
                          {formatWeight(user.initialWeight)}
                          {user.initialWeightDate && (
                            <span className="text-xs text-[#7895b3] font-normal ml-1">
                              (on {new Date(user.initialWeightDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })})
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#7895b3] mb-1">Current Weight</p>
                        <p className="text-sm font-medium text-[#435970]">
                          {formatWeight(user.weight)}
                          {(() => {
                            const latestLog = weightLogs
                              .filter(log => log.previousWeight !== null || log.change !== null)
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                            return latestLog ? (
                              <span className="text-xs text-[#7895b3] font-normal ml-1">
                                (as of {new Date(latestLog.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })})
                              </span>
                            ) : null;
                          })()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#7895b3] mb-1">Goal Weight</p>
                        <p className="text-sm font-medium text-[#435970]">
                          {formatWeight(user.goal)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#7895b3] mb-1">Last Login</p>
                        <p className="text-sm font-medium text-[#435970]">{user.lastLogin}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Registered Devices */}
              <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h5 className="text-lg font-semibold text-[#435970]">Registered Devices</h5>
                    <span className="px-2 py-1 text-xs font-medium bg-[#dfedfb] text-[#435970] rounded-full">
                      {userDevices.length} device{userDevices.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {loadingDevices ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#435970]"></div>
                    <p className="ml-3 text-[#7895b3]">Loading devices...</p>
                  </div>
                ) : userDevices.length === 0 ? (
                  <p className="text-sm text-[#7895b3] text-center py-8">
                    No registered devices found. Devices will appear here when the user logs in from the app.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userDevices.map((device) => {
                      const name = (device.deviceName || '').toLowerCase();
                      const isIpad = name.includes('ipad');
                      const isIphone = device.platform === 'ios' && !isIpad;
                      const isAndroidTablet = device.platform === 'android' && (name.includes('tablet') || name.includes('tab') || name.includes('pad') || name.includes('sm-t') || name.includes('sm-x'));

                      let deviceLabel = 'Android Phone';
                      if (isIphone) deviceLabel = 'iPhone';
                      else if (isIpad) deviceLabel = 'iPad';
                      else if (isAndroidTablet) deviceLabel = 'Android Tablet';

                      return (
                        <div key={device.id} className="border border-[#dfedfb] rounded-lg p-4 hover:border-[#7895b3] transition-all">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${device.platform === 'ios' ? 'bg-blue-50' : 'bg-green-50'}`}>
                              {device.platform === 'ios' ? (
                                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                                </svg>
                              ) : (
                                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4483-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4483-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993 0 .5511-.4483.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3435-4.1021-2.6892-7.5743-6.1185-9.4396"/>
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="text-sm font-semibold text-[#435970] truncate">
                                  {device.deviceName || deviceLabel}
                                </p>
                                <span className={`flex-shrink-0 inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                  device.platform === 'ios' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                }`}>
                                  {deviceLabel}
                                </span>
                              </div>
                              <p className="text-xs text-[#7895b3] mb-1">
                                App version: {device.appVersion ? (
                                  <span className="font-medium text-[#435970]">v{device.appVersion}</span>
                                ) : (
                                  <span className="italic text-[#7895b3]/70">Unknown</span>
                                )}
                              </p>
                              <p className="text-xs text-[#7895b3]">
                                Last active: {new Date(device.lastActiveAt).toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </p>
                              <p className="text-xs text-[#7895b3]/60 mt-1">
                                Registered: {new Date(device.createdAt).toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Medication Log */}
              <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <h5 className="text-lg font-semibold text-[#435970]">Medication Log</h5>
                    {checkInStreak > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                        </svg>
                        {checkInStreak} day streak
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-[#7895b3]">
                      {checkInDays.filter(d => d.hasCheckIn).length} of {checkInDays.length} days logged
                    </div>
                    <button
                      onClick={openAddLogShot}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#435970] text-white text-xs font-medium rounded-lg hover:bg-[#7895b3] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Log (Backfill)
                    </button>
                  </div>
                </div>

                {loadingCheckIns ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#435970]"></div>
                    <p className="ml-3 text-[#7895b3]">Loading medication logs...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Calendar */}
                    <div className="border border-[#dfedfb] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <button
                          onClick={() => setCheckInOffset(checkInOffset + 1)}
                          className="p-2 text-[#7895b3] hover:text-[#435970] hover:bg-[#dfedfb]/30 rounded-lg transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <span className="text-base font-semibold text-[#435970]">
                          {checkInDays.length > 0 && new Date(checkInDays[0]?.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => setCheckInOffset(Math.max(0, checkInOffset - 1))}
                          disabled={checkInOffset === 0}
                          className="p-2 text-[#7895b3] hover:text-[#435970] hover:bg-[#dfedfb]/30 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>

                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <div key={day} className="text-center text-xs font-medium text-[#7895b3] py-1">
                            {day}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-1">
                        {(() => {
                          if (checkInDays.length === 0) return null;
                          const firstDate = new Date(checkInDays[0]?.date);
                          const startDayOfWeek = firstDate.getDay();
                          const emptyCells = Array.from({ length: startDayOfWeek }, (_, i) => (
                            <div key={`empty-${i}`} className="aspect-square" />
                          ));
                          const dayCells = checkInDays.map((day) => {
                            const date = new Date(day.date);
                            const dayNum = date.getDate();
                            const isToday = day.date === new Date().toISOString().split('T')[0];
                            const isSelected = day.date === selectedDate;
                            return (
                              <button
                                key={day.date}
                                onClick={() => setSelectedDate(day.date === selectedDate ? null : day.date)}
                                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all relative ${
                                  isSelected
                                    ? 'bg-[#435970] text-white'
                                    : isToday
                                    ? 'bg-[#dfedfb] text-[#435970] ring-2 ring-[#435970]'
                                    : day.hasCheckIn
                                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                    : 'hover:bg-[#dfedfb]/30 text-[#435970]'
                                }`}
                              >
                                <span className={`font-medium ${isSelected ? 'text-white' : ''}`}>{dayNum}</span>
                                {day.hasCheckIn && (
                                  <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                                    isSelected ? 'bg-white' : 'bg-green-500'
                                  }`} />
                                )}
                                {day.checkInCount > 1 && (
                                  <span className={`absolute top-0.5 right-0.5 text-[9px] font-bold ${
                                    isSelected ? 'text-white/80' : 'text-green-600'
                                  }`}>
                                    {day.checkInCount}
                                  </span>
                                )}
                              </button>
                            );
                          });
                          return [...emptyCells, ...dayCells];
                        })()}
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#dfedfb] flex items-center justify-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded bg-green-500"></div>
                          <span className="text-[#7895b3]">Logged</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded bg-[#dfedfb] ring-2 ring-[#435970]"></div>
                          <span className="text-[#7895b3]">Today</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded bg-[#435970]"></div>
                          <span className="text-[#7895b3]">Selected</span>
                        </div>
                      </div>
                    </div>

                    {/* Detail List */}
                    <div className="border border-[#dfedfb] rounded-lg p-4">
                      <h6 className="text-sm font-semibold text-[#435970] mb-3">
                        {selectedDate
                          ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                          : 'Recent Activity'
                        }
                      </h6>

                      {selectedDate ? (
                        (() => {
                          const dayData = checkInDays.find(d => d.date === selectedDate);
                          if (!dayData) return <p className="text-sm text-[#7895b3]">No data for this date.</p>;

                          return (
                            <div className="space-y-3">
                              {dayData.hasCheckIn && dayData.medications.length > 0 ? (
                                dayData.medications.map((med) => (
                                  <div key={med.id} className="bg-green-50 rounded-lg p-3 border border-green-100">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium text-green-700">
                                        {med.medicationName === 'default' ? 'Daily Check-in' : med.medicationName}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                                          {new Date(med.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <button
                                          onClick={() => openEditLogShot(med)}
                                          className="p-1 text-[#7895b3] hover:text-[#435970] hover:bg-white rounded transition-colors"
                                          title="Edit log entry"
                                          aria-label="Edit log entry"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => setDeletingLogId(med.id)}
                                          className="p-1 text-red-400 hover:text-red-600 hover:bg-white rounded transition-colors"
                                          title="Delete log entry"
                                          aria-label="Delete log entry"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                    {med.nextDate && (
                                      <div className="text-xs text-[#7895b3] flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Next: {new Date(med.nextDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </div>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <div className="text-center py-6">
                                  <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </div>
                                  <p className="text-sm text-[#7895b3]">No medications logged on this date</p>
                                </div>
                              )}
                              <button
                                onClick={() => setSelectedDate(null)}
                                className="w-full mt-2 text-xs text-[#7895b3] hover:text-[#435970] transition-colors"
                              >
                                Show all recent activity
                              </button>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="space-y-2 max-h-[320px] overflow-y-auto">
                          {[...checkInDays]
                            .filter(d => d.hasCheckIn)
                            .reverse()
                            .slice(0, 10)
                            .map((day) => {
                              const date = new Date(day.date);
                              const isToday = day.date === new Date().toISOString().split('T')[0];
                              return (
                                <button
                                  key={day.date}
                                  onClick={() => setSelectedDate(day.date)}
                                  className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-green-50 hover:bg-green-100 transition-all text-left"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-green-700">
                                        {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        {isToday && <span className="ml-1 text-xs text-[#435970]">(Today)</span>}
                                      </p>
                                      <p className="text-xs text-[#7895b3]">
                                        {day.checkInCount} medication{day.checkInCount > 1 ? 's' : ''}
                                      </p>
                                    </div>
                                  </div>
                                  <svg className="w-4 h-4 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              );
                            })}

                          {checkInDays.filter(d => d.hasCheckIn).length === 0 && (
                            <div className="text-center py-8">
                              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                              </div>
                              <p className="text-sm text-[#7895b3]">No medication logs this month</p>
                              <p className="text-xs text-[#7895b3] mt-1">Logs will appear when the user checks in from the app</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Weight Log Data */}
              <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
                <h5 className="text-lg font-semibold text-[#435970] mb-4">Weight Log Data</h5>
                {loadingWeightLogs ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#435970]"></div>
                    <p className="ml-3 text-[#7895b3]">Loading weight logs...</p>
                  </div>
                ) : weightLogs.length === 0 && !(user.initialWeight && user.initialWeight !== 'N/A') ? (
                  <p className="text-sm text-[#7895b3] text-center py-8">
                    No weight logs found. Weight logs will appear here when the user submits data from the app.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[#dfedfb]">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">Weight (lbs)</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">Previous Weight</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">Change</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dfedfb]">
                          {weightLogs
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((log) => (
                              <tr key={log.id} className="transition-colors hover:bg-[#dfedfb]/20">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-[#435970]">
                                  {new Date(log.date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-sm font-semibold text-[#435970]">{log.weight} lbs</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                                  {log.previousWeight ? `${log.previousWeight} lbs` : '-'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {log.change !== null && log.change !== 0 ? (
                                    <div className="flex items-center gap-2">
                                      {log.changeType === 'decrease' ? (
                                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                        </svg>
                                      ) : (
                                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7 7V3" />
                                        </svg>
                                      )}
                                      <span className={`text-sm font-semibold ${
                                        log.changeType === 'decrease' ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        {log.changeType === 'decrease' ? '-' : '+'}{Math.abs(log.change)} lbs
                                      </span>
                                    </div>
                                  ) : log.change === 0 ? (
                                    <span className="text-sm text-[#7895b3]">No change</span>
                                  ) : (
                                    <span className="text-sm text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {log.changeType ? (
                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                      log.changeType === 'decrease'
                                        ? 'bg-green-100 text-green-700'
                                        : log.changeType === 'increase'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-[#dfedfb] text-[#7895b3]'
                                    }`}>
                                      {log.changeType === 'decrease' ? 'Decreased' : log.changeType === 'increase' ? 'Increased' : 'No Change'}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          {user.initialWeight && user.initialWeight !== 'N/A' && weightLogsPagination.page >= weightLogsPagination.totalPages && (
                            <tr className="bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                                {user.initialWeightDate ? new Date(user.initialWeightDate).toLocaleDateString() : '-'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-sm font-semibold text-gray-400">{user.initialWeight} lbs</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">-</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-sm text-gray-400">-</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-400">
                                  Initial Weight
                                </span>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {weightLogs.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#dfedfb] flex items-center justify-between">
                        <div className="text-sm text-[#7895b3]">
                          Showing <span className="font-semibold text-[#435970]">
                            {((weightLogsPagination.page - 1) * weightLogsPagination.limit) + 1}
                          </span> to{' '}
                          <span className="font-semibold text-[#435970]">
                            {Math.min(weightLogsPagination.page * weightLogsPagination.limit, weightLogsPagination.total)}
                          </span> of{' '}
                          <span className="font-semibold text-[#435970]">{weightLogsPagination.total}</span> logs
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleWeightLogsPageChange(weightLogsPagination.page - 1)}
                            disabled={weightLogsPagination.page === 1}
                            className="px-3 py-1 text-sm border border-[#dfedfb] rounded-lg text-[#435970] hover:bg-[#dfedfb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <span className="text-sm text-[#7895b3]">
                            Page {weightLogsPagination.page} of {weightLogsPagination.totalPages}
                          </span>
                          <button
                            onClick={() => handleWeightLogsPageChange(weightLogsPagination.page + 1)}
                            disabled={weightLogsPagination.page >= weightLogsPagination.totalPages}
                            className="px-3 py-1 text-sm border border-[#dfedfb] rounded-lg text-[#435970] hover:bg-[#dfedfb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <LogShotFormModal
        isOpen={logShotModalOpen}
        mode={logShotMode}
        initialValues={logShotMode === 'edit' ? editingLog?.values : undefined}
        onClose={() => {
          setLogShotModalOpen(false);
          setEditingLog(null);
        }}
        onSubmit={submitLogShot}
      />

      <ConfirmModal
        isOpen={deletingLogId !== null}
        onClose={() => !deletingLog && setDeletingLogId(null)}
        onConfirm={confirmDeleteLogShot}
        title="Delete Medication Log"
        message="Are you sure you want to delete this medication log entry? This will also remove any scheduled reminder notifications tied to it. This action cannot be undone."
        confirmText="Delete"
        type="danger"
        isLoading={deletingLog}
      />
    </div>
  );
}
