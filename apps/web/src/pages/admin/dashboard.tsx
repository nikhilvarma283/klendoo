import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface HostAccount {
  id: string;
  email: string;
  displayName: string;
  slug: string;
  status: string;
  balance: number;
  createdAt: string;
  clientCount: number;
  totalBookings: number;
  totalCost: number;
}

interface PendingApproval {
  id: string;
  email: string;
  displayName: string;
  slug: string;
  requestedAt: string;
  timezone: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [hosts, setHosts] = useState<HostAccount[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'approvals' | 'create'>('overview');
  const [error, setError] = useState('');
  const [createForm, setCreateForm] = useState({
    email: '',
    displayName: '',
    slug: '',
    timezone: 'UTC',
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/check-auth');
        if (!response.ok) {
          router.push('/admin/login');
          return;
        }
        fetchData();
      } catch (err) {
        router.push('/admin/login');
      }
    };

    checkAuth();
  }, [router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [hostsRes, approvalsRes] = await Promise.all([
        fetch('/api/admin/hosts'),
        fetch('/api/admin/pending-approvals'),
      ]);

      if (hostsRes.ok) {
        const data = await hostsRes.json();
        setHosts(data.hosts);
      }

      if (approvalsRes.ok) {
        const data = await approvalsRes.json();
        setPendingApprovals(data.pending);
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      const response = await fetch(`/api/admin/approvals/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (response.ok) {
        setError('');
        fetchData();
      } else {
        const data = await response.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to approve');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      const response = await fetch(`/api/admin/approvals/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });

      if (response.ok) {
        setError('');
        fetchData();
      } else {
        const data = await response.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to reject');
    }
  };

  const handleCreateHost = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!createForm.email || !createForm.displayName || !createForm.slug) {
      setError('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch('/api/admin/create-host', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      if (response.ok) {
        setCreateForm({ email: '', displayName: '', slug: '', timezone: 'UTC' });
        setError('');
        fetchData();
        setActiveTab('overview');
      } else {
        const data = await response.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to create host');
    }
  };

  const handleDeleteHost = async (hostId: string) => {
    if (!confirm('Are you sure? This will delete all client data.')) return;

    try {
      const response = await fetch(`/api/admin/hosts/${hostId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchData();
      } else {
        const data = await response.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to delete host');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-900 border-t-red-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="bg-red-900 border-b border-red-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">🔐 Klendoo Admin</h1>
            <p className="text-red-200 text-sm">Super Admin Panel</p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('adminToken');
              router.push('/admin/login');
            }}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg transition text-sm"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Hosts</p>
          <p className="text-3xl font-bold mt-2">{hosts.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Pending Approvals</p>
          <p className="text-3xl font-bold text-yellow-500 mt-2">{pendingApprovals.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Clients</p>
          <p className="text-3xl font-bold mt-2">{hosts.reduce((sum, h) => sum + h.clientCount, 0)}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Volume</p>
          <p className="text-3xl font-bold text-green-500 mt-2">${hosts.reduce((sum, h) => sum + h.totalCost, 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-2 mb-6">
          {(['overview', 'approvals', 'create'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === tab
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab === 'overview' && '📊 Active Hosts'}
              {tab === 'approvals' && `⏳ Approvals (${pendingApprovals.length})`}
              {tab === 'create' && '➕ Create New'}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900 border border-red-700 text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {hosts.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                <p className="text-gray-400">No hosts yet. Create one to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Host</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Slug</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Clients</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Balance</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Volume</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Created</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hosts.map((host) => (
                      <tr key={host.id} className="border-b border-gray-700 hover:bg-gray-800">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium">{host.displayName}</p>
                            <p className="text-xs text-gray-500">{host.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <a
                            href={`https://klendoo.com/${host.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline text-sm"
                          >
                            /{host.slug}
                          </a>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              host.status === 'active'
                                ? 'bg-green-900 text-green-300'
                                : 'bg-gray-700 text-gray-300'
                            }`}
                          >
                            {host.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">{host.clientCount}</td>
                        <td className="px-6 py-4 text-sm font-mono">${host.balance.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm">${host.totalCost.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm text-gray-400">
                          {new Date(host.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => handleDeleteHost(host.id)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Approvals Tab */}
        {activeTab === 'approvals' && (
          <div className="space-y-4">
            {pendingApprovals.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                <p className="text-gray-400">No pending approvals. All caught up!</p>
              </div>
            ) : (
              pendingApprovals.map((approval) => (
                <div
                  key={approval.id}
                  className="bg-gray-800 rounded-lg p-6 border-l-4 border-yellow-600 border border-gray-700"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{approval.displayName}</h3>
                      <p className="text-sm text-gray-400">{approval.email}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Requested: {new Date(approval.requestedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Slug: <span className="font-mono">{approval.slug}</span></p>
                      <p className="text-sm text-gray-400">Timezone: {approval.timezone}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(approval.id)}
                      className="flex-1 px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg transition text-sm font-medium"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => handleReject(approval.id)}
                      className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg transition text-sm font-medium"
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Create Tab */}
        {activeTab === 'create' && (
          <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 max-w-2xl">
            <h2 className="text-2xl font-bold mb-6">Manually Create Host Account</h2>

            <form onSubmit={handleCreateHost} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="host@example.com"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
                <input
                  type="text"
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Unique Slug</label>
                <div className="flex items-center">
                  <span className="text-gray-400 mr-2">klendoo.com/</span>
                  <input
                    type="text"
                    value={createForm.slug}
                    onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value.toLowerCase() })}
                    placeholder="john"
                    className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Timezone</label>
                <select
                  value={createForm.timezone}
                  onChange={(e) => setCreateForm({ ...createForm, timezone: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Asia/Kolkata">India</option>
                </select>
              </div>

              <div className="bg-gray-700 rounded-lg p-4 mt-6">
                <p className="text-sm text-gray-300">
                  ℹ️ Host will be created with:
                </p>
                <ul className="text-sm text-gray-400 mt-2 space-y-1">
                  <li>• Balance: $0 (manual top-up needed)</li>
                  <li>• Status: Active</li>
                  <li>• Google OAuth: Not connected (they can do this later)</li>
                  <li>• Email notification sent to host</li>
                </ul>
              </div>

              <button
                type="submit"
                className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition mt-6"
              >
                Create Host Account
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
