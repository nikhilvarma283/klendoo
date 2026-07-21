import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface HostProfile {
  id: string;
  displayName: string;
  slug: string;
  timezone: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  profileImage?: string;
}

export default function HostPublicProfile() {
  const router = useRouter();
  const { hostSlug } = router.query;
  const [hostProfile, setHostProfile] = useState<HostProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!hostSlug) return;

    const fetchHostProfile = async () => {
      try {
        const response = await fetch(`/api/host/${hostSlug}/profile`);
        if (!response.ok) {
          throw new Error('Host not found');
        }
        const data = await response.json();
        setHostProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    // Check if user is authenticated to this host
    const clientEmail = localStorage.getItem(`client_email_${hostSlug}`);
    if (clientEmail) {
      setIsAuthenticated(true);
    }

    fetchHostProfile();
  }, [hostSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !hostProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'This profile does not exist.'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
              {hostProfile.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{hostProfile.displayName}</h1>
              <p className="text-gray-600 mt-1">
                📍 {hostProfile.timezone} | 🕒 {hostProfile.workingHoursStart} -{' '}
                {hostProfile.workingHoursEnd}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {isAuthenticated ? (
          // Authenticated Client View
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome!</h2>
            <p className="text-gray-600 mb-6">
              You have access to book sessions with {hostProfile.displayName}. Start by sending a message or checking availability.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => router.push(`/${hostSlug}/chat`)}
                className="p-6 border-2 border-indigo-300 rounded-lg hover:bg-indigo-50 transition"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">💬 Send Message</h3>
                <p className="text-sm text-gray-600">Chat with {hostProfile.displayName} to coordinate</p>
              </button>

              <button
                onClick={() => router.push(`/${hostSlug}/book`)}
                className="p-6 border-2 border-green-300 rounded-lg hover:bg-green-50 transition"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">📅 Book a Session</h3>
                <p className="text-sm text-gray-600">Check availability and schedule a meeting</p>
              </button>
            </div>
          </div>
        ) : (
          // Unauthenticated Client View
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Request Access</h2>
            <p className="text-gray-600 mb-6">
              To book a session with {hostProfile.displayName}, you need to request access. They can approve up to 5-10 interactions.
            </p>

            <button
              onClick={() => router.push(`/${hostSlug}/request-access`)}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium mb-4"
            >
              Request Access
            </button>

            <p className="text-sm text-gray-500 text-center">
              Already have access?{' '}
              <button
                onClick={() => router.push(`/${hostSlug}/login`)}
                className="text-indigo-600 hover:underline font-medium"
              >
                Sign in
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
