import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-gray-900">Klendoo</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/forgot-password')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Forgot password?
            </button>
            <button
              onClick={() => router.push('/host/onboarding')}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-purple-50 to-indigo-100">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
            Your own scheduling page.
            <br />
            Paid per interaction, not per seat.
          </h1>
          <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
            Klendoo gives you a private booking page at{' '}
            <span className="font-mono text-indigo-700">klendoo.com/you</span>. Clients request
            access, you approve them, and every booking, follow-up, or reminder draws from a
            prepaid credit balance — so you always know exactly what it's costing you.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <button
              onClick={() => router.push('/host/onboarding')}
              className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
            >
              Create your page
            </button>
            <button
              onClick={() => router.push('/admin/login')}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-white transition"
            >
              Admin login
            </button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-8">
          <div>
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold mb-4">
              1
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Set up your page</h3>
            <p className="text-gray-600 text-sm">
              Pick your slug, connect Google Calendar, and set your working hours. Your account
              is reviewed and approved before it goes live.
            </p>
          </div>
          <div>
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold mb-4">
              2
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Approve who reaches you</h3>
            <p className="text-gray-600 text-sm">
              Clients request access to your page. You approve each one, with a set number of
              interactions included — no unlimited free access.
            </p>
          </div>
          <div>
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold mb-4">
              3
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Track every cost</h3>
            <p className="text-gray-600 text-sm">
              Bookings, follow-ups, and reminders each draw a small, fixed amount from your
              prepaid balance. See exactly where it goes in your dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-gray-500">
          <span>&copy; {new Date().getFullYear()} Klendoo</span>
          <div className="flex gap-6">
            <button onClick={() => router.push('/host/onboarding')} className="hover:text-gray-900">
              Get Started
            </button>
            <button onClick={() => router.push('/forgot-password')} className="hover:text-gray-900">
              Forgot password
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
