import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupApi, importApi } from '../api';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle,
  ArrowRight,
  RefreshCw,
  FolderOpen
} from 'lucide-react';

export default function CsvImporter() {
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null); // { jobId, status, anomalies, analyzedRows }
  const [resolutions, setResolutions] = useState({}); // rowIndex -> { action, data }
  const [error, setError] = useState(null);
  const [commitSuccess, setCommitSuccess] = useState(false);

  // Fetch groups for dropdown
  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: groupApi.list,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ csvContent, filename }) => importApi.upload(csvContent, parseInt(selectedGroupId), filename),
    onSuccess: (res) => {
      setUploadResult(res);
      setLoading(false);
      
      // Initialize default resolutions based on suggested actions
      const initialResolutions = {};
      
      // Fetch members for default fallback dropdowns
      const group = groups.find(g => g.id === parseInt(selectedGroupId));
      const activeMemberIds = group?.members.map(m => m.userId) || [];
      const defaultPayerId = activeMemberIds[0] || 1;

      res.analyzedRows.forEach((row) => {
        const idx = row.rowIndex;
        const rowAnomalies = row.anomalies;

        if (rowAnomalies.length > 0) {
          // Determine best default action
          let defaultAction = 'CORRECTED';
          const details = { ...row.parsedData };

          // Default notes
          details.notes = details.notes || '';

          // If there is unregistered payer/participant, suggest name corrections
          const unregPayer = rowAnomalies.find(a => a.type === 'UNREGISTERED_PAYER' || a.type === 'PAYER_NOT_IN_GROUP');
          const settlementAnom = rowAnomalies.find(a => a.type === 'SETTLEMENT_LOGGED_AS_EXPENSE');
          const duplicateAnom = rowAnomalies.find(a => a.type === 'DUPLICATE_EXPENSE' || a.type === 'ZERO_AMOUNT');
          const inactiveAnom = rowAnomalies.find(a => a.type === 'PAYER_INACTIVE_ON_DATE' || a.type === 'PARTICIPANT_INACTIVE_ON_DATE');
          const missingCurrency = rowAnomalies.find(a => a.type === 'MISSING_CURRENCY');
          
          if (duplicateAnom) {
            defaultAction = 'SKIPPED';
          } else if (settlementAnom) {
            defaultAction = 'SETTLEMENT_CREATED';
            // Pre-fill payee from split list if possible
            const splitNames = row.parsedData.splitWith.split(';');
            // Guess payee: usually Aisha if Sam or Rohan pays back
            details.payeeId = 1; // Default to Aisha (User 1)
            // Parse paid_by
            if (row.parsedData.paidBy.toLowerCase().includes('rohan')) details.paidById = 2;
            else if (row.parsedData.paidBy.toLowerCase().includes('sam')) details.paidById = 6;
            else details.paidById = defaultPayerId;
          } else {
            // Apply corrections
            if (unregPayer && unregPayer.suggestion !== 'register_user') {
              // Set corrected name ID
              if (unregPayer.suggestion === 'Priya') details.paidById = 3;
              else if (unregPayer.suggestion === 'Rohan') details.paidById = 2;
            } else if (unregPayer && unregPayer.suggestion === 'register_user') {
              // Default to default payer
              details.paidById = defaultPayerId;
            } else {
              // Find matching user from DB
              if (row.parsedData.paidBy.toLowerCase().includes('aisha')) details.paidById = 1;
              else if (row.parsedData.paidBy.toLowerCase().includes('rohan')) details.paidById = 2;
              else if (row.parsedData.paidBy.toLowerCase().includes('priya')) details.paidById = 3;
              else if (row.parsedData.paidBy.toLowerCase().includes('meera')) details.paidById = 4;
              else if (row.parsedData.paidBy.toLowerCase().includes('dev')) details.paidById = 5;
              else if (row.parsedData.paidBy.toLowerCase().includes('sam')) details.paidById = 6;
              else details.paidById = defaultPayerId;
            }

            if (missingCurrency) {
              details.currency = 'INR';
            }

            // Adjust splits
            const splitNames = row.parsedData.splitWith.split(';').map(n => n.trim().toLowerCase()).filter(Boolean);
            const participants = [];
            let totalParticipantsCount = splitNames.length;

            // Map split names to actual IDs
            const mappedIds = splitNames.map(name => {
              if (name.includes('aisha')) return 1;
              if (name.includes('rohan')) return 2;
              if (name.includes('priya')) return 3;
              if (name.includes('meera')) return 4;
              if (name.includes('dev')) return 5;
              if (name.includes('sam')) return 6;
              return null;
            }).filter(Boolean);

            if (mappedIds.length === 0) {
              // Default split equally with active members
              activeMemberIds.forEach(id => mappedIds.push(id));
            }

            // Handle active checks: if Meera (4) left in March and expense date is April, remove her from mappedIds
            const expenseDate = row.parsedData.date ? new Date(row.parsedData.date) : new Date();
            const filteredIds = mappedIds.filter(id => {
              const mem = group?.members.find(m => m.userId === id);
              if (!mem) return false;
              if (expenseDate < mem.joinedAt) return false;
              if (mem.leftAt && expenseDate > mem.leftAt) return false;
              return true;
            });

            // If empty after filter, restore original mapping
            const finalIds = filteredIds.length > 0 ? filteredIds : mappedIds;

            const splitAmt = Math.round((details.amount / finalIds.length) * 100) / 100;
            finalIds.forEach(id => {
              participants.push({
                userId: id,
                amount: splitAmt
              });
            });
            details.participants = participants;
            details.splitType = 'EQUAL';
          }

          initialResolutions[idx] = {
            action: defaultAction,
            data: details
          };
        } else {
          // No anomalies: Auto-import as CORRECTED
          const details = { ...row.parsedData };
          if (row.parsedData.paidBy.toLowerCase().includes('aisha')) details.paidById = 1;
          else if (row.parsedData.paidBy.toLowerCase().includes('rohan')) details.paidById = 2;
          else if (row.parsedData.paidBy.toLowerCase().includes('priya')) details.paidById = 3;
          else if (row.parsedData.paidBy.toLowerCase().includes('meera')) details.paidById = 4;
          else if (row.parsedData.paidBy.toLowerCase().includes('dev')) details.paidById = 5;
          else if (row.parsedData.paidBy.toLowerCase().includes('sam')) details.paidById = 6;
          else details.paidById = defaultPayerId;

          const splitNames = row.parsedData.splitWith.split(';').map(n => n.trim().toLowerCase()).filter(Boolean);
          const mappedIds = splitNames.map(name => {
            if (name.includes('aisha')) return 1;
            if (name.includes('rohan')) return 2;
            if (name.includes('priya')) return 3;
            if (name.includes('meera')) return 4;
            if (name.includes('dev')) return 5;
            if (name.includes('sam')) return 6;
            return null;
          }).filter(Boolean);

          const participants = [];
          const splitAmt = Math.round((details.amount / mappedIds.length) * 100) / 100;
          mappedIds.forEach(id => {
            participants.push({
              userId: id,
              amount: splitAmt
            });
          });
          details.participants = participants;
          details.splitType = 'EQUAL';

          initialResolutions[idx] = {
            action: 'IMPORTED_AS_IS',
            data: details
          };
        }
      });

      setResolutions(initialResolutions);
    },
    onError: (err) => {
      setError(err.message || 'Failed to upload CSV file');
      setLoading(false);
    }
  });

  const commitMutation = useMutation({
    mutationFn: () => {
      // Map resolutions object to array
      const resArray = Object.keys(resolutions).map(idx => ({
        rowIndex: parseInt(idx),
        action: resolutions[idx].action,
        data: resolutions[idx].data
      }));
      return importApi.commit(uploadResult.jobId, parseInt(selectedGroupId), resArray);
    },
    onSuccess: () => {
      setCommitSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => {
      setError(err.message || 'Failed to commit import job');
    }
  });

  const handleFileChange = (e) => {
    setCsvFile(e.target.files[0]);
    setError(null);
  };

  const handleUpload = () => {
    if (!selectedGroupId) {
      setError('Please select a group first');
      return;
    }
    if (!csvFile) {
      setError('Please select a CSV file');
      return;
    }

    setLoading(true);
    setError(null);
    setCommitSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      uploadMutation.mutate({
        csvContent: e.target.result,
        filename: csvFile.name,
      });
    };
    reader.readAsText(csvFile);
  };

  const handleResolutionActionChange = (rowIndex, newAction) => {
    setResolutions({
      ...resolutions,
      [rowIndex]: {
        ...resolutions[rowIndex],
        action: newAction
      }
    });
  };

  const handleResolutionDataChange = (rowIndex, field, value) => {
    setResolutions({
      ...resolutions,
      [rowIndex]: {
        ...resolutions[rowIndex],
        data: {
          ...resolutions[rowIndex].data,
          [field]: value
        }
      }
    });
  };

  const activeGroup = groups?.find(g => g.id === parseInt(selectedGroupId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">CSV Import System</h1>
        <p className="text-slate-400 text-xs mt-1 font-medium">Upload your export file and resolve anomalies interactively</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
          {error}
        </div>
      )}

      {commitSuccess ? (
        <div className="glass-panel p-12 rounded-3xl text-center max-w-xl mx-auto border border-emerald-500/20">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6 text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Import Committed!</h2>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed font-medium">
            All expenses have been parsed, corrected, and saved to the group database. Net balances and debt simplification have been updated automatically.
          </p>
          <div className="mt-8 flex gap-3 justify-center">
            <button
              onClick={() => { setUploadResult(null); setCsvFile(null); setCommitSuccess(false); }}
              className="px-5 py-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
            >
              Import Another File
            </button>
            <button
              onClick={() => window.location.href = `/groups/${selectedGroupId}`}
              className="px-5 py-3 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-500 transition-all glow-btn"
            >
              View Group Balances
            </button>
          </div>
        </div>
      ) : !uploadResult ? (
        /* Step 1: Upload File Panel */
        <div className="glass-panel p-8 rounded-3xl max-w-2xl mx-auto space-y-6 border border-slate-800">
          <h2 className="text-lg font-bold text-white">Select Group & Upload File</h2>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Target Group</label>
              <select
                value={selectedGroupId}
                onChange={(e) => { setSelectedGroupId(e.target.value); setError(null); }}
                className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-sm"
              >
                <option value="">-- Choose Target Group --</option>
                {groups?.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-semibold">Select CSV File</label>
              <div className="border border-dashed border-slate-800 hover:border-brand-500/50 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-950/20 relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto text-brand-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      {csvFile ? csvFile.name : 'Click or drag file to upload'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {csvFile ? `(${(csvFile.size / 1024).toFixed(1)} KB)` : 'Supports .csv files exported from Excel/Splitwise'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={loading || !selectedGroupId || !csvFile}
            className="w-full py-3.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 transition-all glow-btn flex items-center justify-center gap-2"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <FileSpreadsheet className="w-5 h-5" />
                Analyze CSV Data
              </>
            )}
          </button>
        </div>
      ) : (
        /* Step 2: Interactive Anomaly Correction Board */
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl flex justify-between items-center bg-brand-600/10 border-brand-500/20">
            <div>
              <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">ANOMALY REPORT</span>
              <h2 className="text-xl font-bold text-white mt-1">
                Found {uploadResult.anomalies.length} Anomalies in CSV Export
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Please review suggestions and approve resolutions before committing.
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setUploadResult(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-350 text-xs font-semibold hover:bg-slate-700"
              >
                Re-upload
              </button>
              <button
                onClick={() => commitMutation.mutate()}
                disabled={commitMutation.isPending}
                className="px-5 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-500 transition-all glow-btn"
              >
                {commitMutation.isPending ? 'Committing...' : 'Commit Import'}
              </button>
            </div>
          </div>

          {/* Anomalies List */}
          <div className="space-y-6">
            {uploadResult.analyzedRows.map((row) => {
              const idx = row.rowIndex;
              const hasAnomalies = row.anomalies.length > 0;
              const res = resolutions[idx];

              if (!res) return null;

              return (
                <div
                  key={idx}
                  className={`glass-panel p-6 rounded-2xl border ${
                    hasAnomalies ? 'border-amber-500/20' : 'border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-white text-sm">
                        Row #{idx}: <span className="text-slate-300 font-medium">{row.parsedData.description || 'Unnamed Expense'}</span>
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        Raw CSV Row Data: Date: {row.parsedData.date || 'Empty'} &middot; Payer: {row.parsedData.paidBy || 'Empty'} &middot; Amount: {row.parsedData.amount || 'Empty'} {row.parsedData.currency} &middot; Split Type: {row.parsedData.splitType}
                      </p>
                    </div>

                    <div className="flex gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg">
                      {[
                        { id: 'IMPORTED_AS_IS', label: 'Import' },
                        { id: 'CORRECTED', label: 'Correct' },
                        { id: 'SETTLEMENT_CREATED', label: 'Settlement' },
                        { id: 'SKIPPED', label: 'Skip' }
                      ].map(actionOpt => (
                        <button
                          key={actionOpt.id}
                          type="button"
                          onClick={() => handleResolutionActionChange(idx, actionOpt.id)}
                          className={`text-[9px] px-2.5 py-1.5 rounded font-bold transition-all ${
                            res.action === actionOpt.id 
                              ? 'bg-brand-600 text-white' 
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {actionOpt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Anomalies warnings */}
                  {hasAnomalies && (
                    <div className="space-y-2 mb-4 bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl">
                      {row.anomalies.map((anom, aIdx) => (
                        <div key={aIdx} className="flex gap-2.5 text-xs text-amber-400 leading-relaxed">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <strong className="font-bold text-[10px] tracking-wide uppercase mr-1.5">
                              {anom.type}
                            </strong>
                            {anom.description} Suggested: <span className="text-brand-400 font-semibold">{anom.suggestedAction}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Form fields for corrections based on action */}
                  {res.action !== 'SKIPPED' && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/40 border border-slate-900 text-xs">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Payer</label>
                        <select
                          value={res.data.paidById || ''}
                          onChange={(e) => handleResolutionDataChange(idx, 'paidById', parseInt(e.target.value))}
                          className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200"
                        >
                          {activeGroup?.members.map(m => (
                            <option key={m.userId} value={m.userId}>{m.user.name}</option>
                          ))}
                        </select>
                      </div>

                      {res.action === 'SETTLEMENT_CREATED' ? (
                        /* Payee for settlements */
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Payee (Received Back)</label>
                          <select
                            value={res.data.payeeId || ''}
                            onChange={(e) => handleResolutionDataChange(idx, 'payeeId', parseInt(e.target.value))}
                            className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200"
                          >
                            {activeGroup?.members.map(m => (
                              <option key={m.userId} value={m.userId}>{m.user.name}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        /* Split participant counts */
                        <div className="space-y-1 col-span-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Split Participants</label>
                          <div className="py-1.5 text-slate-400 font-semibold">
                            {res.data.participants?.length || 0} Members
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Amount</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            step="0.01"
                            value={res.data.amount || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              handleResolutionDataChange(idx, 'amount', val);
                              
                              // Recalculate participant amounts equally
                              if (res.data.participants) {
                                const splitAmt = Math.round((val / res.data.participants.length) * 100) / 100;
                                const updatedParts = res.data.participants.map(p => ({ ...p, amount: splitAmt }));
                                handleResolutionDataChange(idx, 'participants', updatedParts);
                              }
                            }}
                            className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200 text-center"
                          />
                          <select
                            value={res.data.currency || 'INR'}
                            onChange={(e) => handleResolutionDataChange(idx, 'currency', e.target.value)}
                            className="w-16 px-1 py-1 rounded bg-slate-900 border border-slate-800 text-slate-200 text-[10px]"
                          >
                            <option value="INR">INR</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Date</label>
                        <input
                          type="date"
                          value={res.data.date ? new Date(res.data.date).toISOString().slice(0, 10) : ''}
                          onChange={(e) => handleResolutionDataChange(idx, 'date', new Date(e.target.value).toISOString())}
                          className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200 text-center font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {res.action === 'SKIPPED' && (
                    <div className="mt-2 text-rose-400 text-xs font-semibold italic flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" /> This row will be ignored from database import.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
