import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { groupApi, auditApi, importApi } from '../api';
import { 
  Users, 
  DollarSign, 
  ShieldCheck, 
  AlertTriangle,
  History,
  TrendingUp,
  ChevronRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  BarChart,
  Bar
} from 'recharts';

export default function Dashboard() {
  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: groupApi.list,
  });

  const { data: recentJobs } = useQuery({
    queryKey: ['recentJobs'],
    queryFn: importApi.recentJobs,
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: auditApi.logs,
  });

  // Calculate high-level stats
  const totalGroupsCount = groups?.length || 0;
  
  // Static mock trends data for the chart to show spending trends
  const trendData = [
    { name: 'Jan', spend: 40000 },
    { name: 'Feb', spend: 58000 },
    { name: 'Mar', spend: 89000 },
    { name: 'Apr', spend: 64000 },
    { name: 'May', spend: 45000 },
    { name: 'Jun', spend: 52000 },
  ];

  // Currency breakdown data
  const currencyData = [
    { name: 'INR', amount: 154000 },
    { name: 'USD', amount: 804 * 83 }, // convert USD Goa expenses to INR
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="glass-panel p-8 rounded-3xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-brand-500/10 blur-[100px]"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Welcome to Spreetail</h1>
          <p className="text-slate-400 text-xs mt-1.5 font-medium max-w-xl leading-relaxed">
            Audit shared flat accounts, manage roommate memberships, process CSV exports, and resolve validation anomalies.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="glass-panel p-5 rounded-2xl border border-slate-850 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">My Groups</span>
            <h3 className="text-xl font-black text-white mt-0.5">{totalGroupsCount}</h3>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-850 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Active Currencies</span>
            <h3 className="text-xl font-black text-white mt-0.5">INR, USD</h3>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-850 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pending Audits</span>
            <h3 className="text-xl font-black text-white mt-0.5">
              {recentJobs?.filter(j => j.status === 'PENDING').length || 0} Jobs
            </h3>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-850 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">System Health</span>
            <h3 className="text-xl font-black text-white mt-0.5">100% OK</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spending Trend Area Chart */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-850 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-400" />
              Monthly Spending Trends
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-1">Total aggregated spending across all roommate groups</p>
          </div>

          <div className="h-64 mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4d73ff" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4d73ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.2} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0c0f24', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="spend" stroke="#4d73ff" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSpend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Currency Breakdown Bar Chart */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-850 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-400" />
              Currency Distribution
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-1">Spending split by base currency (converted to INR)</p>
          </div>

          <div className="h-64 mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.2} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0c0f24', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="amount" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Groups List */}
        <div className="lg:col-span-1 glass-panel p-6 rounded-2xl border border-slate-850 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-4">Select Group</h3>
            {groupsLoading ? (
              <div className="text-xs text-slate-500">Loading groups...</div>
            ) : groups && groups.length > 0 ? (
              <div className="space-y-3">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => window.location.href = `/groups/${group.id}`}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-brand-500/40 cursor-pointer flex items-center justify-between transition-all group"
                  >
                    <div>
                      <p className="font-bold text-xs text-white group-hover:text-brand-400 transition-colors">{group.name}</p>
                      <span className="text-[10px] text-slate-500">{group.members?.length || 0} members</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No active groups found.</p>
            )}
          </div>
        </div>

        {/* Audit Log Activities */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-850 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-brand-400" />
              Recent Actions Trail
            </h3>
            
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar text-xs">
              {auditLogs && auditLogs.length > 0 ? (
                auditLogs.slice(0, 10).map((log) => {
                  const details = JSON.parse(log.details);
                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-900/40 border border-slate-850/50 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-semibold text-slate-300">
                          <span className="text-brand-400 font-bold font-mono mr-2">{log.action}</span>
                          by {log.user?.name || 'System'}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          {new Date(log.createdAt).toLocaleString()} &middot; ID: {log.id}
                        </p>
                      </div>
                      
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-900 truncate max-w-xs">
                        {details.filename || details.description || details.amount || JSON.stringify(details).substring(0,25)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-slate-500 py-6 text-center">No recent actions logged.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
