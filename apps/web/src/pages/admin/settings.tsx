import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface Setting {
  key: string;
  label: string;
  group: string;
  secret: boolean;
  configured: boolean;
  source: 'database' | 'environment' | 'unset';
  preview: string;
}

export default function AdminSettings() {
  const router = useRouter();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings');
      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const updates = Object.fromEntries(Object.entries(inputs).filter(([, v]) => v?.trim()));

    if (Object.keys(updates).length === 0) {
      setError('Enter at least one value to save');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Saved: ${data.updated.join(', ')}`);
        setInputs({});
        fetchSettings();
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-900 border-t-red-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  const groups = Array.from(new Set(settings.map((s) => s.group)));

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="bg-red-900 border-b border-red-800 shadow-lg">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">⚙️ Platform Settings</h1>
            <p className="text-red-200 text-sm">API keys and integrations</p>
          </div>
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg transition text-sm"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-900/50 border border-green-700 text-green-200 rounded-lg text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-8">
          {groups.map((group) => (
            <div key={group} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold mb-4">{group}</h2>
              <div className="space-y-4">
                {settings
                  .filter((s) => s.group === group)
                  .map((setting) => (
                    <div key={setting.key}>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        {setting.label}
                        {setting.configured ? (
                          <span className="ml-2 text-xs text-green-400">
                            ✓ configured ({setting.source}) — {setting.preview}
                          </span>
                        ) : (
                          <span className="ml-2 text-xs text-yellow-500">not set</span>
                        )}
                      </label>
                      <input
                        type={setting.secret ? 'password' : 'text'}
                        value={inputs[setting.key] || ''}
                        onChange={(e) => setInputs({ ...inputs, [setting.key]: e.target.value })}
                        placeholder={setting.configured ? 'Leave blank to keep current value' : `Enter ${setting.label.toLowerCase()}`}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-600"
                      />
                    </div>
                  ))}
              </div>
            </div>
          ))}

          <button
            type="submit"
            disabled={saving}
            className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>

        <div className="mt-8 p-4 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400">
          <p className="font-medium text-gray-300 mb-2">Where to get these:</p>
          <p className="mb-1">
            <strong>Google:</strong> Google Cloud Console → OAuth 2.0 Client ID (Web application).
            Add <code className="text-indigo-400">https://klendoo.com/api/auth/google-callback-host</code> as an
            authorized redirect URI.
          </p>
          <p>
            <strong>SendGrid:</strong> SendGrid dashboard → Settings → API Keys. The from-email
            must be a verified sender in your SendGrid account.
          </p>
        </div>
      </div>
    </div>
  );
}
