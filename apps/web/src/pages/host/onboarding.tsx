import { useState } from 'react';
import { useRouter } from 'next/router';

interface OnboardingStep {
  step: 1 | 2 | 3;
  title: string;
}

export default function HostOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    slug: '',
    timezone: 'UTC',
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const steps: OnboardingStep[] = [
    { step: 1, title: 'Account Details' },
    { step: 2, title: 'Google Calendar Setup' },
    { step: 3, title: 'Availability Settings' },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateSlug = async (slug: string) => {
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError('Slug must contain only lowercase letters, numbers, and dashes');
      return false;
    }

    try {
      const response = await fetch(`/api/host/check-slug?slug=${slug}`);
      const data = await response.json();
      if (!data.available) {
        setError('This slug is already taken');
        return false;
      }
    } catch (err) {
      setError('Failed to check slug availability');
      return false;
    }

    return true;
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.email || !formData.displayName || !formData.slug) {
      setError('Please fill in all fields');
      return;
    }

    const isValidSlug = await validateSlug(formData.slug);
    if (!isValidSlug) return;

    setStep(2);
  };

  const handleGoogleOAuth = async () => {
    setLoading(true);
    try {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const redirectUri = `${window.location.origin}/auth/google-callback-host`;
      const scope = 'openid email profile https://www.googleapis.com/auth/calendar';

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(scope)}`;

      window.location.href = authUrl;
    } catch (err) {
      setError('Failed to initiate Google OAuth');
      setLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Assume OAuth was completed, move to step 3
    setStep(3);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/host/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          workingDays: [1, 2, 3, 4, 5], // Mon-Fri by default
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Onboarding failed');
      }

      const data = await response.json();
      localStorage.setItem('hostId', data.hostId);
      localStorage.setItem('hostSlug', data.slug);

      // Redirect to host dashboard
      router.push(`/host/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to Klendoo</h1>
          <p className="text-gray-600 mt-1">Set up your professional scheduling page in 3 steps</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex justify-between mb-8">
          {steps.map((s) => (
            <div
              key={s.step}
              className={`flex items-center ${s.step < steps.length ? 'flex-1' : ''}`}
            >
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                  s.step <= step
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {s.step}
              </div>
              <div className="ml-3">
                <p className="text-sm font-semibold text-gray-900">{s.title}</p>
              </div>
              {s.step < steps.length && (
                <div
                  className={`flex-1 h-1 mx-4 ${
                    s.step < step ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Account Details */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Your Account</h2>

            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="you@example.com"
                  className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Display Name</label>
                <input
                  type="text"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  placeholder="Nikhil Varma"
                  className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Your Subdomain</label>
                <div className="mt-1 flex items-center">
                  <span className="text-gray-600">klendoo.com/</span>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleInputChange}
                    placeholder="nikhil"
                    className="flex-1 ml-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  This is your unique URL. Clients will visit klendoo.com/nikhil to book with you.
                </p>
              </div>

              {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}

              <button
                type="submit"
                className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
              >
                Next: Google Calendar
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Google Calendar */}
        {step === 2 && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Connect Google Calendar</h2>
            <p className="text-gray-600 mb-6">
              Connect your Google Calendar so clients can see your availability and book meetings.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Why connect Google Calendar?</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✓ Clients see your real availability</li>
                <li>✓ Events automatically sync to your calendar</li>
                <li>✓ Avoid double-bookings</li>
                <li>✓ Send meeting invites to clients</li>
              </ul>
            </div>

            <form onSubmit={handleStep2Submit} className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleOAuth}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition font-medium disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                </svg>
                {loading ? 'Connecting...' : 'Connect with Google'}
              </button>

              <p className="text-sm text-gray-500 text-center">
                We'll request access to your calendar and profile. You can revoke access anytime.
              </p>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                >
                  Next: Availability
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Availability Settings */}
        {step === 3 && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Set Your Availability</h2>
            <p className="text-gray-600 mb-6">
              Clients can only book during your working hours.
            </p>

            <form onSubmit={handleFinalSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Timezone</label>
                <select
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleInputChange}
                  className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                  <option value="Asia/Kolkata">India</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Working Hours Start</label>
                  <input
                    type="time"
                    name="workingHoursStart"
                    value={formData.workingHoursStart}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Working Hours End</label>
                  <input
                    type="time"
                    name="workingHoursEnd"
                    value={formData.workingHoursEnd}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  ✓ Clients can book from <span className="font-semibold">{formData.workingHoursStart}</span> to{' '}
                  <span className="font-semibold">{formData.workingHoursEnd}</span> in your timezone.
                </p>
              </div>

              {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50"
                >
                  {loading ? 'Setting up...' : 'Complete Setup'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
