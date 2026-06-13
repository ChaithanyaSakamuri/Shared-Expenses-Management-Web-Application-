import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../api';
import { Activity, Search, ShieldAlert, History } from 'lucide-react';

export default function AuditLogs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: auditApi.logs,
  });

  const filteredLogs = logs?.filter(log => {
    const actionMatch = filterAction === 'ALL' || log.action === filterAction;
    
    const detailsStr = log.details.toLowerCase();
    const nameMatch = log.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) || false;
    const searchMatch = !searchTerm || nameMatch || log.action.toLowerCase().includes(searchTerm.toLowerCase()) || detailsStr.includes(searchTerm.toLowerCase());

    return actionMatch && searchMatch;
  });

  // Unique actions for filters
  const uniqueActions = ['ALL', ...new Set(logs?.map(l => l.action) || [])];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Audit Trail Ledger</h1>
          <p className="text-slate-400 text-xs mt-1 font-medium">Full historical change log and file import decisions trail</p>
        </div>
      </div>

      {/* Filters board */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-850 flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by action, user, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs focus:border-brand-500 focus:outline-none transition-all"
          />
        </div>

        {/* Action Filter */}
        <div className="w-full md:w-56 space-y-1">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-350 text-xs focus:border-brand-500 focus:outline-none"
          >
            {uniqueActions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredLogs && filteredLogs.length > 0 ? (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            let details = {};
            try {
              details = JSON.parse(log.details);
            } catch (err) {}

            return (
              <div
                key={log.id}
                className="glass-panel p-5 rounded-2xl border border-slate-850 flex flex-col md:flex-row justify-between md:items-center gap-4 text-xs hover:border-slate-800 transition-all"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-brand-400 bg-brand-500/10 border border-brand-500/10 px-2 py-0.5 rounded text-[10px] tracking-wide uppercase">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Timestamp: {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-300 font-medium mt-2">
                    Action executed by <strong className="text-slate-200">{log.user?.name || 'System'}</strong> ({log.user?.email || 'system@internal'})
                  </p>
                </div>

                <div className="md:text-right">
                  <span className="inline-block text-[10px] font-mono text-slate-400 bg-slate-950 px-3 py-2 rounded-xl border border-slate-900 max-w-lg truncate">
                    {JSON.stringify(details)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel p-12 rounded-2xl text-center text-slate-400 border border-dashed border-slate-800">
          No audit entries match the search filters.
        </div>
      )}
    </div>
  );
}
