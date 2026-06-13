const API_URL = 'http://localhost:5000/api';

export async function fetchWithAuth(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export const authApi = {
  login: (email, password) => fetchWithAuth('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  register: (email, password, name) => fetchWithAuth('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  }),
  me: () => fetchWithAuth('/auth/me'),
};

export const groupApi = {
  list: () => fetchWithAuth('/groups'),
  details: (id) => fetchWithAuth(`/groups/${id}`),
  create: (name, description) => fetchWithAuth('/groups', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  }),
  addMember: (groupId, userId, joinedAt) => fetchWithAuth(`/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId, joinedAt }),
  }),
  removeMember: (groupId, userId, leftAt) => fetchWithAuth(`/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
    body: JSON.stringify({ leftAt }),
  }),
  listAllUsers: () => fetchWithAuth('/groups/users/all'),
};

export const expenseApi = {
  list: (groupId) => fetchWithAuth(`/expenses/group/${groupId}`),
  create: (expenseData) => fetchWithAuth('/expenses', {
    method: 'POST',
    body: JSON.stringify(expenseData),
  }),
  edit: (id, expenseData) => fetchWithAuth(`/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(expenseData),
  }),
  delete: (id) => fetchWithAuth(`/expenses/${id}`, {
    method: 'DELETE',
  }),
};

export const settlementApi = {
  create: (settlementData) => fetchWithAuth('/settlements', {
    method: 'POST',
    body: JSON.stringify(settlementData),
  }),
  complete: (id) => fetchWithAuth(`/settlements/${id}/complete`, {
    method: 'PATCH',
  }),
  summary: (groupId, currency = 'INR') => fetchWithAuth(`/settlements/group/${groupId}/summary?currency=${currency}`),
};

export const importApi = {
  upload: (csvContent, groupId, filename) => fetchWithAuth('/import/upload', {
    method: 'POST',
    body: JSON.stringify({ csvContent, groupId, filename }),
  }),
  commit: (jobId, groupId, resolutions) => fetchWithAuth(`/import/${jobId}/commit`, {
    method: 'POST',
    body: JSON.stringify({ groupId, resolutions }),
  }),
  recentJobs: () => fetchWithAuth('/import/jobs/recent'),
};

export const auditApi = {
  logs: () => fetchWithAuth('/audit/logs'),
  reports: (groupId) => fetchWithAuth(`/audit/reports?groupId=${groupId}`),
};
