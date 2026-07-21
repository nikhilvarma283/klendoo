import { useState } from 'react';
import { useRouter } from 'next/router';

type UserType = 'host' | 'client';

export default function ForgotPassword() {
  const router = useRouter();
  const [userType, setUserType] = useState<UserType>('host');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, userType }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to process request');
      }

      setSuccess(true);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password?</h1>
        <p className="text-gray-600 mb-6">
          No problem! We'll send you a link to reset your password.
        </p>

        {success ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm font-medium">✅ Email Sent!</p>
              <p className="text-green-700 text-sm mt-2">
                Check your email for a password reset link. The link expires in 1 hour.
              </p>
            </div>

            <button
              onClick={() => {
                setSuccess(false);
                setUserType('host');
                setEmail('');
              }}
              className="w-full px-4 py-2 text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition font-medium"
            >
              Send Another Link
            </button>

            <button
              onClick={() => {
                if (userType === 'host') {
                  router.push('/host/login');
                } else {
                  router.push('/login');
                }
              }}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                I am a:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setUserType('host');
                    setError('');
                  }}
                  className={`px-4 py-3 rounded-lg font-medium transition ${
                    userType === 'host'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📅 Host
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserType('client');
                    setError('');
                  }}
                  className={`px-4 py-3 rounded-lg font-medium transition ${
                    userType === 'client'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  👥 Client
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {userType === 'host'
                  ? 'I manage a Klendoo scheduling page'
                  : 'I book sessions with hosts'}
              </p>
            </div>

            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  userType === 'host'
                    ? 'your@email.com'
                    : 'visitor@email.com'
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition font-medium"
            >
              {loading ? 'Sending Link...' : 'Send Reset Link'}
            </button>

            {/* Back to Login */}
            <button
              type="button"
              onClick={() => {
                if (userType === 'host') {
                  router.push('/host/login');
                } else {
                  router.push('/login');
                }
              }}
              className="w-full px-4 py-2 text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition font-medium"
            >
              Back to Login
            </button>
          </form>
        )}

        {/* Security Info */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            🔒 <strong>For your security:</strong> Password reset links expire after 1 hour. If you don't request a
            password reset, you can ignore this email.
          </p>
        </div>
      </div>
    </div>
  );
}
