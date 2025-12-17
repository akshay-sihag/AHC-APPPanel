'use client';

import { useState } from 'react';

type WeightLog = {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  date: string;
  weight: number; // in lbs
  previousWeight?: number;
  change: number; // change in lbs
  changeType: 'increase' | 'decrease' | 'no-change';
};

export default function LogDataPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Sample weight log data
  const weightLogs: WeightLog[] = [
    { id: 1, userId: 1, userName: 'Sarah Johnson', userEmail: 'sarah.j@example.com', date: '2024-01-15', weight: 150.5, previousWeight: 152.0, change: -1.5, changeType: 'decrease' },
    { id: 2, userId: 1, userName: 'Sarah Johnson', userEmail: 'sarah.j@example.com', date: '2024-01-16', weight: 149.8, previousWeight: 150.5, change: -0.7, changeType: 'decrease' },
    { id: 3, userId: 1, userName: 'Sarah Johnson', userEmail: 'sarah.j@example.com', date: '2024-01-17', weight: 149.2, previousWeight: 149.8, change: -0.6, changeType: 'decrease' },
    { id: 4, userId: 2, userName: 'Michael Chen', userEmail: 'm.chen@example.com', date: '2024-01-15', weight: 180.0, previousWeight: 181.5, change: -1.5, changeType: 'decrease' },
    { id: 5, userId: 2, userName: 'Michael Chen', userEmail: 'm.chen@example.com', date: '2024-01-16', weight: 179.5, previousWeight: 180.0, change: -0.5, changeType: 'decrease' },
    { id: 6, userId: 3, userName: 'Emily Rodriguez', userEmail: 'emily.r@example.com', date: '2024-01-15', weight: 128.0, previousWeight: 127.5, change: 0.5, changeType: 'increase' },
    { id: 7, userId: 3, userName: 'Emily Rodriguez', userEmail: 'emily.r@example.com', date: '2024-01-16', weight: 128.5, previousWeight: 128.0, change: 0.5, changeType: 'increase' },
    { id: 8, userId: 4, userName: 'David Kim', userEmail: 'david.k@example.com', date: '2024-01-15', weight: 165.0, previousWeight: 166.0, change: -1.0, changeType: 'decrease' },
    { id: 9, userId: 5, userName: 'Lisa Anderson', userEmail: 'lisa.a@example.com', date: '2024-01-15', weight: 154.0, previousWeight: 154.0, change: 0, changeType: 'no-change' },
    { id: 10, userId: 5, userName: 'Lisa Anderson', userEmail: 'lisa.a@example.com', date: '2024-01-16', weight: 153.5, previousWeight: 154.0, change: -0.5, changeType: 'decrease' },
    { id: 11, userId: 7, userName: 'Maria Garcia', userEmail: 'maria.g@example.com', date: '2024-01-15', weight: 139.0, previousWeight: 140.0, change: -1.0, changeType: 'decrease' },
    { id: 12, userId: 8, userName: 'Robert Taylor', userEmail: 'robert.t@example.com', date: '2024-01-15', weight: 174.0, previousWeight: 175.5, change: -1.5, changeType: 'decrease' },
    { id: 13, userId: 10, userName: 'Christopher Lee', userEmail: 'chris.l@example.com', date: '2024-01-15', weight: 187.0, previousWeight: 188.0, change: -1.0, changeType: 'decrease' },
    { id: 14, userId: 10, userName: 'Christopher Lee', userEmail: 'chris.l@example.com', date: '2024-01-16', weight: 186.5, previousWeight: 187.0, change: -0.5, changeType: 'decrease' },
  ];

  const filteredLogs = weightLogs.filter(log =>
    log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group logs by user for better visualization
  const logsByUser = filteredLogs.reduce((acc, log) => {
    if (!acc[log.userId]) {
      acc[log.userId] = [];
    }
    acc[log.userId].push(log);
    return acc;
  }, {} as Record<number, WeightLog[]>);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-[#435970] mb-1">Weight Log Data</h3>
          <p className="text-[#7895b3]">Monitor daily weight updates from users</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
          />
          <div className="relative">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 px-4 py-2 pl-10 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7895b3]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Total Logs</p>
          <p className="text-2xl font-bold text-[#435970]">{weightLogs.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Users Logging</p>
          <p className="text-2xl font-bold text-[#435970]">{Object.keys(logsByUser).length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Avg Weight Loss</p>
          <p className="text-2xl font-bold text-[#435970]">
            {(
              weightLogs
                .filter(log => log.changeType === 'decrease')
                .reduce((sum, log) => sum + Math.abs(log.change), 0) /
              weightLogs.filter(log => log.changeType === 'decrease').length || 0
            ).toFixed(1)} lbs
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Today's Logs</p>
          <p className="text-2xl font-bold text-[#435970]">
            {weightLogs.filter(log => log.date === selectedDate).length}
          </p>
        </div>
      </div>

      {/* Weight Logs Table */}
      <div className="bg-white rounded-lg border border-[#dfedfb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#dfedfb]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Weight (lbs)
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Previous Weight
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Change
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfedfb]">
              {filteredLogs
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((log) => (
                  <tr key={log.id} className="hover:bg-[#dfedfb]/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-[#435970] rounded-full flex items-center justify-center text-white font-semibold text-sm mr-3">
                          {log.userName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[#435970]">{log.userName}</div>
                          <div className="text-sm text-[#7895b3]">{log.userEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#435970]">
                      {new Date(log.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-[#435970]">{log.weight} lbs</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#7895b3]">
                      {log.previousWeight ? `${log.previousWeight} lbs` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.change !== 0 ? (
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
                      ) : (
                        <span className="text-sm text-[#7895b3]">No change</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        log.changeType === 'decrease'
                          ? 'bg-green-100 text-green-700'
                          : log.changeType === 'increase'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-[#dfedfb] text-[#7895b3]'
                      }`}>
                        {log.changeType === 'decrease' ? 'Decreased' : log.changeType === 'increase' ? 'Increased' : 'No Change'}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-[#dfedfb] flex items-center justify-between">
          <div className="text-sm text-[#7895b3]">
            Showing <span className="font-semibold text-[#435970]">1</span> to{' '}
            <span className="font-semibold text-[#435970]">{filteredLogs.length}</span> of{' '}
            <span className="font-semibold text-[#435970]">{weightLogs.length}</span> logs
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm border border-[#dfedfb] rounded-lg text-[#435970] hover:bg-[#dfedfb] transition-colors">
              Previous
            </button>
            <button className="px-3 py-1 text-sm border border-[#dfedfb] rounded-lg text-[#435970] hover:bg-[#dfedfb] transition-colors">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

