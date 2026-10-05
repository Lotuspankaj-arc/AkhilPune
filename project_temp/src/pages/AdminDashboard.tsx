import React from 'react';
    import { motion } from 'framer-motion';
    import { 
      LayoutDashboard, Users, Calendar, UserCheck, 
      ShieldAlert, Activity, TrendingUp, Search,
      MoreVertical, Download
    } from 'lucide-react';
    import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

    const data = [
      { name: 'Jan', users: 400, events: 24 },
      { name: 'Feb', users: 600, events: 18 },
      { name: 'Mar', users: 800, events: 35 },
      { name: 'Apr', users: 1200, events: 42 },
      { name: 'May', users: 1500, events: 38 },
    ];

    const AdminDashboard = () => {
      return (
        <div className="min-h-screen bg-slate-50 flex">
          {/* Sidebar */}
          <aside className="w-64 bg-primary text-white hidden lg:flex flex-col p-6">
            <div className="flex items-center gap-2 mb-12">
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                <LayoutDashboard size={18} className="text-primary" />
              </div>
              <span className="text-xl font-serif font-bold text-secondary">OS Admin</span>
            </div>
            
            <nav className="flex-1 space-y-2">
              {[
                { icon: <LayoutDashboard size={20} />, label: "Dashboard", active: true },
                { icon: <Users size={20} />, label: "User Management" },
                { icon: <Calendar size={20} />, label: "Event Manager" },
                { icon: <UserCheck size={20} />, label: "Volunteers" },
                { icon: <ShieldAlert size={20} />, label: "Audit Logs" },
                { icon: <Activity size={20} />, label: "System Health" }
              ].map((item, i) => (
                <button 
                  key={i}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    item.active ? 'bg-secondary text-primary font-bold' : 'text-white/60 hover:bg-white/5'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="pt-6 border-t border-white/10">
              <div className="flex items-center gap-3 px-4">
                <div className="w-10 h-10 rounded-full bg-secondary/20 border border-secondary/30" />
                <div>
                  <p className="text-sm font-bold">Admin User</p>
                  <p className="text-xs text-white/40">Super Admin</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-8 overflow-y-auto">
            <header className="flex justify-between items-center mb-12">
              <div>
                <h1 className="text-3xl font-serif font-bold text-primary">Operational Overview</h1>
                <p className="text-primary/40">Welcome back, here's what's happening today.</p>
              </div>
              <div className="flex gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30" size={18} />
                  <input type="text" className="pl-10 pr-4 py-2 rounded-xl border border-primary/10 bg-white outline-none focus:ring-2 focus:ring-secondary/50" placeholder="Search records..." />
                </div>
                <button className="bg-white p-2 rounded-xl border border-primary/10 text-primary/60 hover:text-primary transition-all">
                  <Download size={20} />
                </button>
              </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {[
                { label: "Total Members", value: "12,482", trend: "+12%", icon: <Users className="text-blue-600" /> },
                { label: "Active Events", value: "8", trend: "+2", icon: <Calendar className="text-orange-600" /> },
                { label: "Pending Verifications", value: "142", trend: "-5%", icon: <UserCheck className="text-green-600" /> },
                { label: "Revenue (MTD)", value: "₹4.2L", trend: "+18%", icon: <TrendingUp className="text-purple-600" /> }
              ].map((stat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-primary/5"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-xl bg-slate-50">{stat.icon}</div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${stat.trend.startsWith('+') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {stat.trend}
                    </span>
                  </div>
                  <p className="text-primary/40 text-sm font-medium">{stat.label}</p>
                  <h3 className="text-2xl font-bold text-primary mt-1">{stat.value}</h3>
                </motion.div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-primary/5">
                <h3 className="text-xl font-bold text-primary mb-8">User Growth</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="users" fill="#4a0a13" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-primary/5">
                <h3 className="text-xl font-bold text-primary mb-8">Event Participation</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="events" stroke="#fbbf24" strokeWidth={4} dot={{ r: 6, fill: '#fbbf24', strokeWidth: 2, stroke: '#fff' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Recent Activity Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-primary/5 overflow-hidden">
              <div className="p-8 border-b border-primary/5 flex justify-between items-center">
                <h3 className="text-xl font-bold text-primary">Recent Activity</h3>
                <button className="text-secondary font-bold text-sm">View All Logs</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-primary/40 text-xs uppercase tracking-wider">
                      <th className="px-8 py-4 font-bold">User</th>
                      <th className="px-8 py-4 font-bold">Action</th>
                      <th className="px-8 py-4 font-bold">Status</th>
                      <th className="px-8 py-4 font-bold">Date</th>
                      <th className="px-8 py-4 font-bold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {[
                      { user: "Amit Sharma", action: "Profile Verification", status: "Pending", date: "2 mins ago" },
                      { user: "Sneha Patil", action: "Event Registration", status: "Completed", date: "15 mins ago" },
                      { user: "System", action: "Database Backup", status: "Success", date: "1 hour ago" },
                      { user: "Vikram Rao", action: "Payment Received", status: "Completed", date: "3 hours ago" }
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary font-bold text-xs">
                              {row.user[0]}
                            </div>
                            <span className="font-bold text-primary text-sm">{row.user}</span>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-sm text-primary/60">{row.action}</td>
                        <td className="px-8 py-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            row.status === 'Pending' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-sm text-primary/40">{row.date}</td>
                        <td className="px-8 py-4 text-right">
                          <button className="text-primary/20 hover:text-primary transition-colors">
                            <MoreVertical size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>
      );
    };

    export default AdminDashboard;