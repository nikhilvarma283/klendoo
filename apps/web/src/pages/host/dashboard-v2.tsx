import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface HostData {
  displayName: string;
  slug: string;
  balance: number;
  totalCreditsPurchased: number;
  googleConnected: boolean;
}

interface ClientRequest {
  id: string;
  clientName: string;
  clientEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  interactionLimit: number;
  interactionUsed: number;
  requestedAt: string;
}

interface ActionCost {
  actionType: string;
  count: number;
  totalCost: number;
  percentage: number;
}

export default function HostDashboardV2() {
  const router = useRouter();
  const [hostData, setHostData] = useState<HostData | null>(null);
  const [clientRequests, setClientRequests] = useState<ClientRequest[]>([]);
  const [actionCosts, setActionCosts] = useState<ActionCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'analytics' | 'balance'>('overview');
  const [calendarNotice, setCalendarNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const { calendar, reason } = router.query;
    if (calendar === 'connected') {
      setCalendarNotice({ type: 'success', text: 'Google Calendar connected successfully.' });
      router.replace('/host/dashboard-v2', undefined, { shallow: true });
    } else if (calendar === 'error') {
      const messages: Record<string, string> = {
        not_configured: 'Google Calendar integration is not configured yet.',
        denied: 'You declined Google Calendar access.',
        state_mismatch: 'Security check failed. Please try connecting again.',
        token_exchange_failed: 'Google rejected the connection request. Please try again.',
      };
      setCalendarNotice({
        type: 'error',
        text: messages[reason as string] || 'Failed to connect Google Calendar.',
      });
      router.replace('/host/dashboard-v2', undefined, { shallow: true });
    }
  }, [router.isReady, router.query]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const hostSlug = localStorage.getItem('hostSlug');
        if (!hostSlug) {
          router.push('/host/login');
          return;
        }

        // Fetch host data
        const hostResponse = await fetch('/api/host/dashboard');
        if (hostResponse.status === 401) {
          localStorage.removeItem('hostSlug');
          router.push('/host/login');
          return;
        }
        if (hostResponse.ok) {
          const data = await hostResponse.json();
          setHostData(data);
        }

        // Fetch client requests
        const clientsResponse = await fetch('/api/host/clients');
        if (clientsResponse.ok) {
          const data = await clientsResponse.json();
          setClientRequests(data.requests);
        }

        // Fetch analytics
        const analyticsResponse = await fetch('/api/host/analytics-v2');
        if (analyticsResponse.ok) {
          const data = await analyticsResponse.json();
          setActionCosts(data.costBreakdown);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading || !hostData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const handleApproveClient = async (requestId: string) => {
    try {
      await fetch(`/api/host/clients/${requestId}/approve`, { method: 'POST' });
      // Refresh client requests
      const response = await fetch('/api/host/clients');
      const data = await response.json();
      setClientRequests(data.requests);
    } catch (error) {
      console.error('Failed to approve client:', error);
    }
  };

  const handleRejectClient = async (requestId: string) => {
    try {
      await fetch(`/api/host/clients/${requestId}/reject`, { method: 'POST' });
      const response = await fetch('/api/host/clients');
      const data = await response.json();
      setClientRequests(data.requests);
    } catch (error) {
      console.error('Failed to reject client:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{hostData.displayName}</h1>
            <p className="text-sm text-gray-600">klendoo.com/{hostData.slug}</p>
          </div>
          <div className="flex items-center gap-3">
            {hostData.googleConnected && (
              <span className="text-xs font-medium text-green-700 bg-green-100 px-3 py-1.5 rounded-full">
                ✓ Calendar connected
              </span>
            )}
            <button
              onClick={() => router.push(`/${hostData.slug}`)}
              className="px-4 py-2 text-sm text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition"
            >
              → View Public Page
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {calendarNotice && (
          <div
            className={`mb-6 p-4 rounded-lg text-sm ${
              calendarNotice.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}
          >
            {calendarNotice.text}
          </div>
        )}

        {!hostData.googleConnected && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-amber-900">Google Calendar not connected</p>
              <p className="text-xs text-amber-700 mt-1">
                Connect your calendar so client bookings sync automatically.
              </p>
            </div>
            <a
              href="/api/auth/google-connect"
              className="shrink-0 px-4 py-2 bg-white border border-amber-300 text-amber-900 text-sm font-medium rounded-lg hover:bg-amber-100 transition"
            >
              Connect Google Calendar
            </a>
          </div>
        )}

        <div className="flex gap-2 mb-8">
          {(['overview', 'clients', 'analytics', 'balance'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab === 'overview' && '📊 Overview'}
              {tab === 'clients' && '👥 Clients'}
              {tab === 'analytics' && '📈 Analytics'}
              {tab === 'balance' && '💰 Balance'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-indigo-500">
                <p className="text-sm text-gray-600">Account Balance</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">${hostData.balance.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-2">Spent of ${hostData.totalCreditsPurchased.toFixed(2)}</p>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
                <p className="text-sm text-gray-600">Pending Requests</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {clientRequests.filter((r) => r.status === 'pending').length}
                </p>
                <p className="text-xs text-gray-500 mt-2">Waiting for approval</p>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
                <p className="text-sm text-gray-600">Active Clients</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {clientRequests.filter((r) => r.status === 'approved').length}
                </p>
                <p className="text-xs text-gray-500 mt-2">Approved & active</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Actions</h2>
              <div className="space-y-3">
                {actionCosts.map((cost) => (
                  <div key={cost.actionType} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-gray-900">{cost.actionType}</p>
                      <p className="text-sm text-gray-600">{cost.count} actions</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">${cost.totalCost.toFixed(2)}</p>
                      <p className="text-sm text-gray-500">{cost.percentage}% of total</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Clients Tab */}
        {activeTab === 'clients' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Client Access Requests</h2>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                {clientRequests.filter((r) => r.status === 'pending').length} Pending
              </span>
            </div>

            {clientRequests.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <p className="text-gray-600">No client requests yet. Share your page to get started!</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/${hostData.slug}`);
                    alert('Link copied to clipboard!');
                  }}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Copy Share Link
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {clientRequests.map((request) => (
                  <div key={request.id} className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-gray-300">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">{request.clientName}</h3>
                        <p className="text-sm text-gray-600">{request.clientEmail}</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          request.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : request.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">
                        Interactions: {request.interactionUsed} / {request.interactionLimit}
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{
                            width: `${(request.interactionUsed / request.interactionLimit) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApproveClient(request.id)}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectClient(request.id)}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Cost Breakdown</h2>
            <div className="space-y-4">
              {actionCosts.map((cost) => (
                <div key={cost.actionType}>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium text-gray-900">{cost.actionType}</span>
                    <span className="text-gray-600">${cost.totalCost.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{ width: `${cost.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{cost.count} actions</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Balance Tab */}
        {activeTab === 'balance' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-600 mb-2">Current Balance</p>
              <p className="text-5xl font-bold text-indigo-600">${hostData.balance.toFixed(2)}</p>
              <p className="text-gray-500 mt-2">
                You've purchased ${hostData.totalCreditsPurchased.toFixed(2)} in credits
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { amount: 50, credits: '1000 interactions' },
                { amount: 100, credits: '2500 interactions' },
                { amount: 250, credits: '6500 interactions' },
              ].map((pkg) => (
                <div key={pkg.amount} className="bg-white rounded-lg shadow-sm p-6 text-center border-2 border-gray-200 hover:border-indigo-600 transition cursor-pointer">
                  <p className="text-2xl font-bold text-gray-900">${pkg.amount}</p>
                  <p className="text-sm text-gray-600 mt-2">{pkg.credits}</p>
                  <button className="w-full mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium">
                    Buy Now
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                💳 Each booking costs $0.05, follow-up $0.02, and reminder $0.03. Payments are deducted from your account balance.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
