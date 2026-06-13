import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupApi } from '../api';
import { Link } from 'react-router-dom';
import { Plus, Users, ArrowRight, FolderPlus } from 'lucide-react';

export default function GroupsList() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);

  // Fetch groups
  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: groupApi.list,
  });

  // Create group mutation
  const createMutation = useMutation({
    mutationFn: () => groupApi.create(name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setShowCreateModal(false);
      setName('');
      setDescription('');
    },
    onError: (err) => {
      setError(err.message || 'Failed to create group');
    }
  });

  const handleCreate = (e) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Your Expense Groups</h1>
          <p className="text-slate-400 text-xs mt-1 font-medium">Create or select a group to manage shared expenses</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 transition-all glow-btn"
        >
          <Plus className="w-4 h-4" />
          Create Group
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : groups && groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <div
              key={group.id}
              className="glass-panel glass-panel-hover rounded-3xl p-6 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-4 text-brand-400">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">{group.name}</h3>
                <p className="text-slate-400 text-xs mt-2 line-clamp-2 min-h-[32px] font-medium leading-relaxed">
                  {group.description || 'No description provided.'}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">
                  {group.members?.length || 0} Members
                </span>
                <Link
                  to={`/groups/${group.id}`}
                  className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300 transition-all group"
                >
                  Manage
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel p-16 rounded-3xl text-center max-w-xl mx-auto mt-12 border border-dashed border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-6 text-slate-500">
            <FolderPlus className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">No Groups Found</h2>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed font-medium">
            You are not a member of any shared expenses group yet. Create one or ask an admin to add you.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 px-6 py-3 rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold hover:bg-slate-700 transition-all"
          >
            Create Your First Group
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md glass-panel p-8 rounded-3xl">
            <h2 className="text-xl font-bold text-white mb-2">Create New Group</h2>
            <p className="text-slate-400 text-xs mb-6 font-medium">Set up a new shared flat or trip expense list</p>

            {error && (
              <div className="p-4 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Flat 204"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 text-sm focus:border-brand-500 focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Shared expenses for rent and utility bills"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="3"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 text-sm focus:border-brand-500 focus:outline-none transition-all"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 transition-all glow-btn"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
