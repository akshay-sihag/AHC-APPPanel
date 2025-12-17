export default function DashboardPage() {
  return (
    <div className="space-y-6">

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Active Users Today */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-[#435970] bg-[#dfedfb] px-2 py-1 rounded">+8%</span>
          </div>
          <h4 className="text-4xl font-bold text-[#435970] mb-1">1,247</h4>
          <p className="text-sm text-[#7895b3]">Active Users Today</p>
          <p className="text-xs text-[#7895b3] mt-1">Logged in last 24h</p>
        </div>

        {/* Total Users */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-[#435970] bg-[#dfedfb] px-2 py-1 rounded">Total</span>
          </div>
          <h4 className="text-4xl font-bold text-[#435970] mb-1">8,542</h4>
          <p className="text-sm text-[#7895b3]">Total Registered Users</p>
          <p className="text-xs text-[#7895b3] mt-1">All time</p>
        </div>

        {/* Daily Tasks Completed */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <span className="text-xs font-medium text-[#435970] bg-[#dfedfb] px-2 py-1 rounded">Today</span>
          </div>
          <h4 className="text-4xl font-bold text-[#435970] mb-1">3,891</h4>
          <p className="text-sm text-[#7895b3]">Daily Tasks Completed</p>
          <div className="mt-3 w-full bg-[#dfedfb] rounded-full h-2">
            <div className="bg-[#7895b3] h-2 rounded-full" style={{ width: '78%' }}></div>
          </div>
        </div>

        {/* Weight Goals Tracking */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-[#435970] bg-[#dfedfb] px-2 py-1 rounded">Active</span>
          </div>
          <h4 className="text-4xl font-bold text-[#435970] mb-1">6,234</h4>
          <p className="text-sm text-[#7895b3]">Users with Weight Goals</p>
          <p className="text-xs text-[#7895b3] mt-1">73% of total users</p>
        </div>
      </div>

      {/* User Monitoring Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent User Logins */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 border border-[#dfedfb]">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-xl font-bold text-[#435970]">Recent User Logins</h4>
            <button className="text-sm text-[#7895b3] hover:text-[#435970] transition-colors font-medium">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {[
              { name: 'Sarah Johnson', email: 'sarah.j@example.com', time: '2 minutes ago', status: 'active' },
              { name: 'Michael Chen', email: 'm.chen@example.com', time: '15 minutes ago', status: 'active' },
              { name: 'Emily Rodriguez', email: 'emily.r@example.com', time: '1 hour ago', status: 'active' },
              { name: 'David Kim', email: 'david.k@example.com', time: '2 hours ago', status: 'active' },
              { name: 'Lisa Anderson', email: 'lisa.a@example.com', time: '3 hours ago', status: 'active' },
            ].map((user, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-[#dfedfb]/20 rounded-lg hover:bg-[#dfedfb]/40 transition-colors border border-[#dfedfb]">
                <div className="w-10 h-10 bg-[#435970] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#435970]">{user.name}</p>
                  <p className="text-xs text-[#7895b3] mt-0.5">{user.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#7895b3]">{user.time}</p>
                  <span className="inline-block mt-1 w-2 h-2 bg-[#7895b3] rounded-full"></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weight Goals Overview */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h4 className="text-xl font-bold text-[#435970] mb-6">Weight Goals Overview</h4>
          <div className="space-y-5">
            {[
              { label: 'Users with Goals', value: '6,234 / 8,542', progress: 73 },
              { label: 'On Track', value: '4,521 users', progress: 72 },
              { label: 'Goal Achieved', value: '892 users', progress: 14 },
            ].map((stat, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#435970]">{stat.label}</span>
                  <span className="text-xs text-[#7895b3]">{stat.value}</span>
                </div>
                <div className="w-full bg-[#dfedfb] rounded-full h-2">
                  <div
                    className="bg-[#7895b3] h-2 rounded-full transition-all"
                    style={{ width: `${stat.progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Tasks & User Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Tasks Completion */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h4 className="text-xl font-bold text-[#435970] mb-6">Daily Tasks Completion</h4>
          <div className="space-y-4">
            {[
              { task: 'Workout Logged', completed: 2847, total: 8542, percentage: 33 },
              { task: 'Meal Logged', completed: 5123, total: 8542, percentage: 60 },
              { task: 'Weight Updated', completed: 1245, total: 8542, percentage: 15 },
              { task: 'Progress Checked', completed: 3891, total: 8542, percentage: 46 },
            ].map((task, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#435970]">{task.task}</span>
                  <span className="text-xs text-[#7895b3]">{task.completed.toLocaleString()} / {task.total.toLocaleString()}</span>
                </div>
                <div className="w-full bg-[#dfedfb] rounded-full h-2.5">
                  <div
                    className="bg-[#7895b3] h-2.5 rounded-full transition-all"
                    style={{ width: `${task.percentage}%` }}
                  ></div>
                </div>
                <p className="text-xs text-[#7895b3] mt-1">{task.percentage}% completion rate</p>
              </div>
            ))}
          </div>
        </div>

        {/* User Weight Tracking */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h4 className="text-xl font-bold text-[#435970] mb-6">User Weight Tracking</h4>
          <div className="space-y-4">
            {[
              { user: 'Sarah Johnson', current: '68kg', goal: '65kg', progress: 75, trend: 'down' },
              { user: 'Michael Chen', current: '82kg', goal: '78kg', progress: 60, trend: 'down' },
              { user: 'Emily Rodriguez', current: '58kg', goal: '60kg', progress: 45, trend: 'up' },
              { user: 'David Kim', current: '75kg', goal: '72kg', progress: 80, trend: 'down' },
            ].map((user, index) => (
              <div key={index} className="p-4 bg-[#dfedfb]/20 rounded-lg border border-[#dfedfb]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[#435970]">{user.user}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    user.trend === 'down' 
                      ? 'bg-[#dfedfb] text-[#435970]' 
                      : 'bg-[#dfedfb] text-[#435970]'
                  }`}>
                    {user.trend === 'down' ? '↓' : '↑'} {user.trend === 'down' ? 'Losing' : 'Gaining'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#7895b3] mb-2">
                  <span>Current: {user.current}</span>
                  <span>Goal: {user.goal}</span>
                </div>
                <div className="w-full bg-[#dfedfb] rounded-full h-2">
                  <div
                    className="bg-[#7895b3] h-2 rounded-full transition-all"
                    style={{ width: `${user.progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

