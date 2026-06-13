import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { groupApi, auditApi } from '../api';
import { 
  FileText, 
  Printer, 
  BarChart3, 
  TrendingUp, 
  FileCheck, 
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

export default function Reports() {
  const [selectedGroupId, setSelectedGroupId] = useState('');

  // Fetch groups
  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: groupApi.list,
  });

  // Fetch reports data
  const { data: report, isLoading } = useQuery({
    queryKey: ['reports', selectedGroupId],
    queryFn: () => auditApi.reports(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const handlePrint = () => {
    window.print();
  };

  const COLORS = ['#4d73ff', '#ec4899', '#a855f7', '#f59e0b', '#10b981', '#ef4444'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">System Reports</h1>
          <p className="text-slate-400 text-xs mt-1 font-medium">Generate audited balances, settlements, and importer summaries</p>
        </div>

        <div className="flex gap-3">
          {report && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold hover:border-brand-500 hover:text-white transition-all"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>
          )}
        </div>
      </div>

      {/* Select Group Dropdown - print hidden */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-850 print:hidden max-w-xl">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Select Target Group</label>
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm"
        >
          <option value="">-- Select Group --</option>
          {groups?.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : report ? (
        <div className="space-y-6 print:space-y-12">
          {/* Print Only Header */}
          <div className="hidden print:block text-center border-b border-slate-800 pb-6">
            <h1 className="text-3xl font-black text-white">Spreetail Shared Expenses Ledger</h1>
            <p className="text-slate-400 text-xs mt-2">Audit Report for Group: <strong>{report.groupName}</strong> &middot; Generated on: 2026-06-13</p>
          </div>

          {/* Aggregate KPI Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total System Spend</span>
              <h3 className="text-xl font-black text-white mt-1">₹{report.balanceReport.inrExpensesSum.toLocaleString()}</h3>
              <p className="text-[9px] text-brand-400 mt-1 font-semibold">Aggregate converted to INR</p>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Average Per Member</span>
              <h3 className="text-xl font-black text-white mt-1">₹{report.balanceReport.averageExpensePerMember.toLocaleString()}</h3>
              <p className="text-[9px] text-slate-500 mt-1 font-semibold">Total split shares</p>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Anomalies Detected</span>
              <h3 className="text-xl font-black text-white mt-1">{report.importReport.totalAnomalies}</h3>
              <p className="text-[9px] text-amber-400 mt-1 font-semibold">{report.anomalyReport.resolutionPercentage}% resolved</p>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Settlements</span>
              <h3 className="text-xl font-black text-white mt-1">₹{report.settlementReport.completedSettlementsSumInr.toLocaleString()}</h3>
              <p className="text-[9px] text-emerald-400 mt-1 font-semibold">{report.settlementReport.totalSettlementsCount} transfers logged</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Import & Anomaly Report Chart */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between min-h-[350px]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  Importer Anomaly Report
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Aggregate breakdown of raw CSV import anomalies</p>
              </div>

              <div className="h-56 mt-4 flex items-center justify-center">
                {Object.keys(report.anomalyReport.anomalyTypeStats).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.keys(report.anomalyReport.anomalyTypeStats).map(key => ({
                          name: key.replace(/_/g, ' '),
                          value: report.anomalyReport.anomalyTypeStats[key]
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {Object.keys(report.anomalyReport.anomalyTypeStats).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0c0f24', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <span className="text-xs text-slate-500">No anomalies recorded for this group.</span>
                )}
              </div>
            </div>

            {/* Settlement Report Panel */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between min-h-[350px]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-400" />
                  Settlement & Audit Report
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Audit trail of verified settlements</p>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto max-h-56 custom-scrollbar pr-2 space-y-2.5">
                {report.settlementReport.recentSettlements.length > 0 ? (
                  report.settlementReport.recentSettlements.map((set, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-850/60 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                          <ArrowDownLeft className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-slate-200 font-semibold">{set.payer} paid {set.payee}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">{new Date(set.date).toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <strong className="text-white">{set.currency === 'USD' ? '$' : '₹'}{set.amount.toLocaleString()}</strong>
                        <span className="block text-[8px] uppercase tracking-wider text-emerald-400 font-bold mt-0.5">{set.status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-xs text-center py-12">No recent settlement transfers verified.</p>
                )}
              </div>
            </div>
          </div>

          {/* Table Breakdown of Anomaly Types */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="text-base font-bold text-white mb-4">Anomaly Breakdown Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="text-[10px] text-slate-400 uppercase tracking-wider bg-slate-900/40">
                  <tr>
                    <th className="px-6 py-3 rounded-l-lg">Anomaly Type</th>
                    <th className="px-6 py-3">Occurrences</th>
                    <th className="px-6 py-3 rounded-r-lg">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {Object.keys(report.anomalyReport.anomalyTypeStats).map((type, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/10">
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-350">{type}</td>
                      <td className="px-6 py-4 font-bold text-white">{report.anomalyReport.anomalyTypeStats[type]}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold text-[10px] border border-emerald-500/20">
                          RESOLVED
                        </span>
                      </td>
                    </tr>
                  ))}
                  {Object.keys(report.anomalyReport.anomalyTypeStats).length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-6 py-4 text-center text-slate-500">No anomalies logged.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-16 rounded-3xl text-center text-slate-400 max-w-xl mx-auto border border-dashed border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-6 text-slate-500">
            <FileText className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white">Generate Audited Report</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed font-medium">
            Please choose a target expense group from the dropdown menu to compile multi-dimensional balance sheets and import histories.
          </p>
        </div>
      )}
    </div>
  );
}
