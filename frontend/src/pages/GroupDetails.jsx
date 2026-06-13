import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupApi, expenseApi, settlementApi } from '../api';
import { 
  Users, 
  Receipt, 
  HandCoins, 
  Plus, 
  Trash2, 
  Edit, 
  Check, 
  UserMinus, 
  Info,
  Calendar,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  X
} from 'lucide-react';

export default function GroupDetails() {
  const { id } = useParams();
  const groupId = parseInt(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('expenses'); // expenses, settlements, members
  const [selectedCurrency, setSelectedCurrency] = useState('INR');

  // Expense form states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expDesc, setExpDesc] = useState('');
  const [expAmt, setExpAmt] = useState('');
  const [expCurr, setExpCurr] = useState('INR');
  const [expPayerId, setExpPayerId] = useState('');
  const [expSplitType, setExpSplitType] = useState('EQUAL');
  const [expDate, setExpDate] = useState('2026-06-13');
  const [expNotes, setExpNotes] = useState('');
  const [expParticipants, setExpParticipants] = useState({}); // userId -> { amount, percentage, shares, selected: boolean }
  const [expFormError, setExpFormError] = useState(null);

  // Settlement form states
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlePayerId, setSettlePayerId] = useState('');
  const [settlePayeeId, setSettlePayeeId] = useState('');
  const [settleAmt, setSettleAmt] = useState('');
  const [settleCurr, setSettleCurr] = useState('INR');
  const [settleDate, setSettleDate] = useState('2026-06-13');

  // Member form states
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedAddUserId, setSelectedAddUserId] = useState('');
  const [memberJoinDate, setMemberJoinDate] = useState('2026-01-01');
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [removingUserId, setRemovingUserId] = useState(null);
  const [memberLeaveDate, setMemberLeaveDate] = useState('2026-03-29');

  // Explanatory breakdown state
  const [showBreakdownUser, setShowBreakdownUser] = useState(null); // User object to show breakdown

  // Queries
  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => groupApi.details(groupId),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['summary', groupId, selectedCurrency],
    queryFn: () => settlementApi.summary(groupId, selectedCurrency),
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', groupId],
    queryFn: () => expenseApi.list(groupId),
  });

  const { data: allUsers } = useQuery({
    queryKey: ['allUsers'],
    queryFn: groupApi.listAllUsers,
    enabled: showAddMemberModal,
  });

  // Mutations
  const addMemberMutation = useMutation({
    mutationFn: () => groupApi.addMember(groupId, parseInt(selectedAddUserId), new Date(memberJoinDate).toISOString()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['summary', groupId] });
      setShowAddMemberModal(false);
      setSelectedAddUserId('');
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: () => groupApi.removeMember(groupId, removingUserId, new Date(memberLeaveDate).toISOString()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['summary', groupId] });
      setShowRemoveMemberModal(false);
    }
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data) => expenseApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['summary', groupId] });
      setShowExpenseModal(false);
      resetExpenseForm();
    },
    onError: (err) => setExpFormError(err.message)
  });

  const editExpenseMutation = useMutation({
    mutationFn: ({ id, data }) => expenseApi.edit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['summary', groupId] });
      setShowExpenseModal(false);
      resetExpenseForm();
    },
    onError: (err) => setExpFormError(err.message)
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id) => expenseApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['summary', groupId] });
    }
  });

  const recordSettlementMutation = useMutation({
    mutationFn: (data) => settlementApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summary', groupId] });
      setShowSettleModal(false);
    }
  });

  const completeSettlementMutation = useMutation({
    mutationFn: (id) => settlementApi.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summary', groupId] });
    }
  });

  // Helpers
  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setExpDesc('');
    setExpAmt('');
    setExpCurr('INR');
    setExpPayerId(group?.members[0]?.userId || '');
    setExpSplitType('EQUAL');
    setExpDate('2026-06-13');
    setExpNotes('');
    setExpFormError(null);
    
    // Reset participants
    const parts = {};
    group?.members.forEach(m => {
      parts[m.userId] = { selected: m.status === 'ACTIVE', amount: '', percentage: '', shares: '1' };
    });
    setExpParticipants(parts);
  };

  const handleOpenNewExpense = () => {
    resetExpenseForm();
    setShowExpenseModal(true);
  };

  const handleOpenEditExpense = (exp) => {
    setEditingExpenseId(exp.id);
    setExpDesc(exp.description);
    setExpAmt(exp.amount);
    setExpCurr(exp.currency);
    setExpPayerId(exp.paidById);
    setExpSplitType(exp.splitType);
    setExpDate(new Date(exp.date).toISOString().slice(0, 10));
    setExpNotes(exp.notes || '');
    
    const parts = {};
    // Load members
    group.members.forEach(m => {
      const expPart = exp.participants.find(p => p.userId === m.userId);
      parts[m.userId] = {
        selected: !!expPart,
        amount: expPart ? expPart.amount : '',
        percentage: expPart ? expPart.percentage : '',
        shares: expPart && expPart.shares ? expPart.shares : '1',
      };
    });
    setExpParticipants(parts);
    setShowExpenseModal(true);
  };

  // Perform split calculation dynamically based on input total and type
  const calculateSplits = () => {
    const total = parseFloat(expAmt);
    if (isNaN(total) || total <= 0) return [];

    const selectedMembers = Object.keys(expParticipants).filter(uId => expParticipants[uId].selected);
    const count = selectedMembers.length;
    if (count === 0) return [];

    const splitData = [];

    if (expSplitType === 'EQUAL') {
      const eqAmt = Math.round((total / count) * 100) / 100;
      selectedMembers.forEach(uId => {
        splitData.push({
          userId: parseInt(uId),
          amount: eqAmt,
        });
      });
    } else if (expSplitType === 'PERCENTAGE') {
      selectedMembers.forEach(uId => {
        const pct = parseFloat(expParticipants[uId].percentage) || 0;
        const amt = Math.round((total * (pct / 100)) * 100) / 100;
        splitData.push({
          userId: parseInt(uId),
          amount: amt,
          percentage: pct,
        });
      });
    } else if (expSplitType === 'SHARE') {
      let totalShares = 0;
      selectedMembers.forEach(uId => {
        totalShares += parseFloat(expParticipants[uId].shares) || 0;
      });

      selectedMembers.forEach(uId => {
        const shares = parseFloat(expParticipants[uId].shares) || 0;
        const amt = totalShares > 0 ? Math.round((total * (shares / totalShares)) * 100) / 100 : 0;
        splitData.push({
          userId: parseInt(uId),
          amount: amt,
          shares,
        });
      });
    } else if (expSplitType === 'EXACT') {
      selectedMembers.forEach(uId => {
        const amt = parseFloat(expParticipants[uId].amount) || 0;
        splitData.push({
          userId: parseInt(uId),
          amount: amt,
        });
      });
    }

    return splitData;
  };

  const handleSaveExpense = (e) => {
    e.preventDefault();
    setExpFormError(null);

    const amount = parseFloat(expAmt);
    if (isNaN(amount) || amount <= 0) {
      setExpFormError('Amount must be greater than zero');
      return;
    }

    const splits = calculateSplits();
    if (splits.length === 0) {
      setExpFormError('At least one participant must be selected');
      return;
    }

    // Verify mathematical consistency
    const totalSplitAmt = splits.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(totalSplitAmt - amount) > 0.05) {
      setExpFormError(`Inconsistent split sum: sum is ${totalSplitAmt}, total must be ${amount}`);
      return;
    }

    const payload = {
      groupId,
      description: expDesc,
      amount,
      currency: expCurr,
      paidById: parseInt(expPayerId),
      splitType: expSplitType,
      date: new Date(expDate).toISOString(),
      notes: expNotes,
      participants: splits,
    };

    if (editingExpenseId) {
      editExpenseMutation.mutate({ id: editingExpenseId, data: payload });
    } else {
      createExpenseMutation.mutate(payload);
    }
  };

  const handleRecordSettlement = (e) => {
    e.preventDefault();
    recordSettlementMutation.mutate({
      groupId,
      payerId: parseInt(settlePayerId),
      payeeId: parseInt(settlePayeeId),
      amount: parseFloat(settleAmt),
      currency: settleCurr,
      date: new Date(settleDate).toISOString(),
      status: 'COMPLETED'
    });
  };

  const handleOpenSettle = (payerId, payeeId, amount) => {
    setSettlePayerId(payerId);
    setSettlePayeeId(payeeId);
    setSettleAmt(amount);
    setSettleCurr(selectedCurrency);
    setSettleDate('2026-06-13');
    setShowSettleModal(true);
  };

  const openRemoveMember = (userId) => {
    setRemovingUserId(userId);
    setShowRemoveMemberModal(true);
  };

  if (groupLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white">Group Not Found</h2>
        <button onClick={() => navigate('/groups')} className="mt-4 px-4 py-2 bg-brand-600 rounded">
          Back to Groups
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="glass-panel p-8 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-brand-400 font-bold tracking-wider uppercase">
            <Users className="w-4 h-4" /> Group ID: {group.id}
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">{group.name}</h1>
          <p className="text-slate-400 text-xs mt-2 max-w-2xl font-medium leading-relaxed">
            {group.description || 'No description provided.'}
          </p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          {activeTab === 'expenses' && (
            <button
              onClick={handleOpenNewExpense}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 transition-all glow-btn"
            >
              <Plus className="w-4 h-4" />
              Add Expense
            </button>
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-800">
        {[
          { id: 'expenses', label: 'Expenses Log', icon: Receipt },
          { id: 'settlements', label: 'Balances & Settlements', icon: HandCoins },
          { id: 'members', label: 'Group Members', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all ${
                isActive 
                  ? 'border-brand-500 text-brand-400' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: EXPENSES */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Expenses History</h2>
          </div>

          {expensesLoading ? (
            <div className="text-center py-12 text-slate-400">Loading expenses...</div>
          ) : expenses && expenses.length > 0 ? (
            <div className="space-y-4">
              {expenses.map((exp) => (
                <div
                  key={exp.id}
                  className="glass-panel p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-slate-800 hover:border-slate-700/60 transition-all"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-bold text-white text-sm tracking-tight">{exp.description}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase font-mono">
                        {exp.splitType}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-1.5 font-medium flex items-center gap-3">
                      <span>Paid by <strong className="text-slate-300">{exp.paidBy.name}</strong></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Date(exp.date).toLocaleDateString()}</span>
                    </p>
                    {exp.notes && (
                      <p className="text-[11px] text-brand-400/80 mt-2 bg-slate-900/30 px-3 py-1.5 rounded-lg border border-slate-800/40 italic">
                        Note: {exp.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between w-full md:w-auto gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
                    <div className="text-right">
                      <p className="text-base font-extrabold text-white">
                        {exp.currency === 'USD' ? '$' : '₹'}
                        {exp.amount.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase">
                        {exp.participants.length} Split-Involved
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenEditExpense(exp)}
                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all"
                        title="Edit Expense"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this expense?')) {
                            deleteExpenseMutation.mutate(exp.id);
                          }
                        }}
                        className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/30 text-rose-400 hover:text-rose-300 transition-all"
                        title="Delete Expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-panel p-12 rounded-2xl text-center text-slate-400 border border-dashed border-slate-800">
              No expenses recorded. Add an expense or import from CSV.
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: SETTLEMENTS & DEBT SIMPLIFICATION */}
      {activeTab === 'settlements' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Net Balances column */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Net balances</h2>
              <div className="flex gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg">
                {['INR', 'USD'].map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedCurrency(c)}
                    className={`text-[10px] px-2 py-1 rounded font-bold transition-all ${
                      selectedCurrency === c 
                        ? 'bg-brand-600 text-white' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {summaryLoading ? (
              <div className="text-slate-400">Computing...</div>
            ) : summary?.balances ? (
              <div className="space-y-3">
                {Object.values(summary.balances).map((mem) => {
                  const isCreditor = mem.netBalance > 0;
                  const isDebtor = mem.netBalance < 0;
                  return (
                    <div
                      key={mem.id}
                      onClick={() => setShowBreakdownUser(mem)}
                      className="glass-panel p-4 rounded-xl flex items-center justify-between cursor-pointer border border-slate-800/80 hover:border-brand-500/30 transition-all group"
                    >
                      <div>
                        <h4 className="font-bold text-white text-sm group-hover:text-brand-400 transition-colors flex items-center gap-1.5">
                          {mem.name}
                          <Info className="w-3.5 h-3.5 text-slate-500 group-hover:text-brand-400" />
                        </h4>
                        <span className="text-[10px] text-slate-500 font-semibold">{mem.email}</span>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-extrabold ${isCreditor ? 'text-emerald-400' : isDebtor ? 'text-rose-400' : 'text-slate-400'}`}>
                          {isCreditor ? '+' : ''}
                          {selectedCurrency === 'USD' ? '$' : '₹'}
                          {mem.netBalance.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wide font-bold">
                          {isCreditor ? 'Gets Back' : isDebtor ? 'Owes' : 'Settled'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Simplified Debts column */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Simplified Debt Graph <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">OPTIMIZED</span>
            </h2>

            {summaryLoading ? (
              <div className="text-slate-400">Optimizing...</div>
            ) : summary?.simplifiedDebts && summary.simplifiedDebts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summary.simplifiedDebts.map((debt, idx) => (
                  <div
                    key={idx}
                    className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-center text-xs font-semibold text-slate-400 mb-4">
                        <span>DEBT CARD</span>
                        <TrendingUp className="w-4 h-4 text-brand-400" />
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed font-medium">
                        <strong className="text-rose-400 text-base font-bold">{debt.payerName}</strong> owes <strong className="text-emerald-400 text-base font-bold">{debt.payeeName}</strong>
                      </p>
                      <h3 className="text-2xl font-black text-white mt-3">
                        {selectedCurrency === 'USD' ? '$' : '₹'}
                        {debt.amount.toLocaleString()}
                      </h3>
                    </div>

                    <button
                      onClick={() => handleOpenSettle(debt.payerId, debt.payeeId, debt.amount)}
                      className="mt-6 w-full py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-brand-600 hover:text-white hover:border-transparent text-slate-300 text-xs font-bold transition-all"
                    >
                      Record Payment
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-panel p-12 rounded-2xl text-center text-slate-400 border border-dashed border-slate-800">
                All debts are fully settled! No payments required.
              </div>
            )}

            {/* Settlements History */}
            <div className="mt-8 space-y-4 pt-4 border-t border-slate-800/80">
              <h3 className="text-base font-bold text-white">Settlement Logs</h3>
              {summary?.settlements && summary.settlements.length > 0 ? (
                <div className="space-y-3">
                  {summary.settlements.map((set) => (
                    <div
                      key={set.id}
                      className="glass-panel p-4 rounded-xl flex items-center justify-between text-xs border border-slate-900"
                    >
                      <div>
                        <p className="text-slate-300 font-semibold">
                          <strong>{set.payer.name}</strong> paid <strong>{set.payee.name}</strong>
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {new Date(set.date).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <p className="font-extrabold text-white text-sm">
                          {set.currency === 'USD' ? '$' : '₹'}
                          {set.amount.toLocaleString()}
                        </p>
                        
                        {set.status === 'COMPLETED' ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <Check className="w-3 h-3" /> Completed
                          </span>
                        ) : (
                          <button
                            onClick={() => completeSettlementMutation.mutate(set.id)}
                            className="px-3 py-1 rounded bg-brand-600 text-white font-bold hover:bg-brand-500 transition-all text-[10px]"
                          >
                            Mark Completed
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No settlement transfers logged yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: MEMBERS */}
      {activeTab === 'members' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Group Membership Timeline</h2>
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold hover:border-brand-500 hover:text-white transition-all"
              >
                <Plus className="w-4 h-4" /> Add Member
              </button>
            </div>

            <div className="space-y-3">
              {group.members.map((mem) => {
                const isActive = mem.status === 'ACTIVE';
                return (
                  <div
                    key={mem.id}
                    className="glass-panel p-4 rounded-xl flex items-center justify-between border border-slate-800"
                  >
                    <div>
                      <h4 className="font-bold text-white text-sm">{mem.user.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{mem.user.email}</p>
                    </div>

                    <div className="flex items-center gap-6 text-right">
                      <div className="text-xs">
                        <p className="text-slate-400 font-medium">Joined: <strong className="text-slate-300">{new Date(mem.joinedAt).toLocaleDateString()}</strong></p>
                        {mem.leftAt && (
                          <p className="text-slate-500 font-medium">Left: <strong className="text-rose-400/80">{new Date(mem.leftAt).toLocaleDateString()}</strong></p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive 
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                        }`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>

                        {isActive && group.createdById !== mem.userId && (
                          <button
                            onClick={() => openRemoveMember(mem.userId)}
                            className="p-1.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                            title="Remove Member"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BALANCES DETAILED EXPLANATION */}
      {showBreakdownUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl glass-panel p-8 rounded-3xl max-h-[85vh] flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">EXPLAINABLE BREAKDOWN</span>
                <h2 className="text-2xl font-black text-white tracking-tight mt-1">{showBreakdownUser.name}'s Ledger</h2>
                <p className="text-xs text-slate-400 font-medium mt-1">Every transaction contributing to the net balance of <strong>{selectedCurrency === 'USD' ? '$' : '₹'}{showBreakdownUser.netBalance.toLocaleString()}</strong></p>
              </div>
              <button onClick={() => setShowBreakdownUser(null)} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 mb-6">
              {showBreakdownUser.breakdown?.length > 0 ? (
                showBreakdownUser.breakdown.map((item, idx) => {
                  const isExp = item.type === 'expense';
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-900/60 border border-slate-850/50 flex flex-col md:flex-row justify-between md:items-center gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isExp ? 'bg-indigo-500/10 text-indigo-400' : 'bg-brand-500/10 text-brand-400'}`}>
                            {isExp ? 'EXPENSE' : 'SETTLEMENT'}
                          </span>
                          <strong className="text-slate-200">{item.description}</strong>
                        </div>
                        
                        <p className="text-slate-500 text-[10px] mt-1">
                          Date: {new Date(item.date).toLocaleDateString()} &middot; Paid By: {item.paidBy} &middot; Original: {item.originalCurrency === 'USD' ? '$' : '₹'}{item.originalAmount.toLocaleString()}
                        </p>
                      </div>

                      <div className="text-left md:text-right border-t md:border-t-0 pt-2 md:pt-0 border-slate-850">
                        <div className="grid grid-cols-2 md:block gap-1">
                          <div>
                            <span className="text-[10px] text-slate-500 md:hidden">Paid:</span>
                            <span className="text-slate-400 font-semibold">{selectedCurrency === 'USD' ? '$' : '₹'}{item.amountPaid.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 md:hidden">Owed:</span>
                            <span className="text-slate-400 font-semibold">-{selectedCurrency === 'USD' ? '$' : '₹'}{item.amountOwed.toLocaleString()}</span>
                          </div>
                        </div>

                        <p className={`font-bold mt-1 text-xs ${item.netEffect > 0 ? 'text-emerald-400' : item.netEffect < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                          Net: {item.netEffect > 0 ? '+' : ''}{selectedCurrency === 'USD' ? '$' : '₹'}{item.netEffect.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-slate-500 text-xs text-center py-6">No ledger actions recorded for this user.</p>
              )}
            </div>

            <button
              onClick={() => setShowBreakdownUser(null)}
              className="w-full py-3 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 transition-all text-xs"
            >
              Close Ledger
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ADD EXPENSE */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg glass-panel p-8 rounded-3xl max-h-[90vh] flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">
                {editingExpenseId ? 'Edit Expense' : 'Log New Expense'}
              </h2>
              <p className="text-slate-400 text-xs mb-6 font-medium">Record shared spending and split with roomates</p>

              {expFormError && (
                <div className="p-4 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                  {expFormError}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                  <input
                    type="text"
                    required
                    placeholder="February rent"
                    value={expDesc}
                    onChange={(e) => setExpDesc(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 text-sm focus:border-brand-500 focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Amount</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="48000"
                      value={expAmt}
                      onChange={(e) => setExpAmt(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 text-sm focus:border-brand-500 focus:outline-none transition-all"
                    />
                    <select
                      value={expCurr}
                      onChange={(e) => setExpCurr(e.target.value)}
                      className="w-24 px-2 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-sm focus:border-brand-500 focus:outline-none"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Paid By</label>
                  <select
                    value={expPayerId}
                    onChange={(e) => setExpPayerId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-sm focus:border-brand-500 focus:outline-none"
                  >
                    {group.members.map(m => (
                      <option key={m.userId} value={m.userId}>{m.user.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Meera skipped this"
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 text-sm focus:border-brand-500 focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Split Splitter Details</label>
                  <select
                    value={expSplitType}
                    onChange={(e) => setExpSplitType(e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs focus:outline-none"
                  >
                    <option value="EQUAL">Split Equally</option>
                    <option value="PERCENTAGE">Percentage %</option>
                    <option value="SHARE">Shares (1, 2, etc.)</option>
                    <option value="EXACT">Exact Amounts</option>
                  </select>
                </div>

                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {group.members.map(m => {
                    const uId = m.userId;
                    const isSelected = expParticipants[uId]?.selected;
                    return (
                      <div key={uId} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/30 border border-slate-850/60 text-xs">
                        <label className="flex items-center gap-3 text-slate-300 font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected || false}
                            onChange={(e) => setExpParticipants({
                              ...expParticipants,
                              [uId]: { ...expParticipants[uId], selected: e.target.checked }
                            })}
                            className="rounded border-slate-800 text-brand-600 focus:ring-brand-500 bg-slate-950"
                          />
                          {m.user.name}
                        </label>

                        {isSelected && (
                          <div className="flex items-center gap-2">
                            {expSplitType === 'PERCENTAGE' && (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  placeholder="25"
                                  value={expParticipants[uId]?.percentage || ''}
                                  onChange={(e) => setExpParticipants({
                                    ...expParticipants,
                                    [uId]: { ...expParticipants[uId], percentage: e.target.value }
                                  })}
                                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 text-white rounded text-center"
                                />
                                <span className="text-slate-500">%</span>
                              </div>
                            )}

                            {expSplitType === 'SHARE' && (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  placeholder="1"
                                  value={expParticipants[uId]?.shares || ''}
                                  onChange={(e) => setExpParticipants({
                                    ...expParticipants,
                                    [uId]: { ...expParticipants[uId], shares: e.target.value }
                                  })}
                                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 text-white rounded text-center"
                                />
                                <span className="text-slate-500">shares</span>
                              </div>
                            )}

                            {expSplitType === 'EXACT' && (
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500">{expCurr === 'USD' ? '$' : '₹'}</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0"
                                  value={expParticipants[uId]?.amount || ''}
                                  onChange={(e) => setExpParticipants({
                                    ...expParticipants,
                                    [uId]: { ...expParticipants[uId], amount: e.target.value }
                                  })}
                                  className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 text-white rounded text-center"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-350 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-500 transition-all glow-btn"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD SETTLEMENT */}
      {showSettleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md glass-panel p-8 rounded-3xl">
            <h2 className="text-xl font-bold text-white mb-2">Record Settlement</h2>
            <p className="text-slate-400 text-xs mb-6 font-medium">Log a direct payment between members to settle debts</p>

            <form onSubmit={handleRecordSettlement} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">From (Payer)</label>
                  <select
                    value={settlePayerId}
                    onChange={(e) => setSettlePayerId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-sm"
                  >
                    {group.members.map(m => (
                      <option key={m.userId} value={m.userId}>{m.user.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">To (Payee)</label>
                  <select
                    value={settlePayeeId}
                    onChange={(e) => setSettlePayeeId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-sm"
                  >
                    {group.members.map(m => (
                      <option key={m.userId} value={m.userId}>{m.user.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Settled Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={settleAmt}
                    onChange={(e) => setSettleAmt(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Currency</label>
                  <select
                    value={settleCurr}
                    onChange={(e) => setSettleCurr(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-sm"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Settlement Date</label>
                <input
                  type="date"
                  required
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-sm"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-350 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-500 transition-all glow-btn"
                >
                  Submit Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD MEMBER */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md glass-panel p-8 rounded-3xl">
            <h2 className="text-xl font-bold text-white mb-2">Add Member to Group</h2>
            <p className="text-slate-400 text-xs mb-6 font-medium">Select a system user to add and set their join date</p>

            <form onSubmit={(e) => { e.preventDefault(); addMemberMutation.mutate(); }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Select User</label>
                <select
                  required
                  value={selectedAddUserId}
                  onChange={(e) => setSelectedAddUserId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-sm"
                >
                  <option value="">-- Choose User --</option>
                  {allUsers && allUsers
                    .filter(u => !group.members.some(m => m.userId === u.id))
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))
                  }
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Joined Date</label>
                <input
                  type="date"
                  required
                  value={memberJoinDate}
                  onChange={(e) => setMemberJoinDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-sm"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-350 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMemberMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-500 transition-all glow-btn"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REMOVE MEMBER (SET LEAVE DATE) */}
      {showRemoveMemberModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md glass-panel p-8 rounded-3xl">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" /> Remove Group Member
            </h2>
            <p className="text-slate-400 text-xs mb-6 font-medium">Deactivate member and specify their departure date for expense splitting history</p>

            <form onSubmit={(e) => { e.preventDefault(); removeMemberMutation.mutate(); }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Leave Date</label>
                <input
                  type="date"
                  required
                  value={memberLeaveDate}
                  onChange={(e) => setMemberLeaveDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-sm"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRemoveMemberModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-350 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={removeMemberMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition-all"
                >
                  Deactivate Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
