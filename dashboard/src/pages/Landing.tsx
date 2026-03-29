import { Link } from 'react-router'
import { Phone, Mail, ArrowRight, Shield, Zap, Database } from 'lucide-react'

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800/50 sticky top-0 bg-gray-950/70 backdrop-blur-xl z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Phone size={16} />
            </div>
            <span className="text-xl font-bold">VixAuth</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/sign-in" className="text-gray-400 hover:text-white text-sm font-medium transition-colors px-4 py-2">
              Sign In
            </Link>
            <Link to="/sign-up" className="bg-white text-gray-900 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-28 pb-24">
        <div className="max-w-2xl">
          <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-6">
            OTP auth
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
              as a service
            </span>
          </h1>
          <p className="text-xl text-gray-400 leading-relaxed mb-10">
            Add phone or email OTP authentication to any app. Create a project,
            connect your database, and ship passwordless auth in minutes. We even use our own OTP to sign you in.
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/sign-up"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3.5 rounded-xl text-lg font-medium transition-colors"
            >
              Start Building <ArrowRight size={20} />
            </Link>
          </div>

          <div className="flex items-center gap-6 mt-12">
            <div className="flex items-center gap-2 text-gray-500">
              <Phone size={16} />
              <span className="text-sm">SMS via Twilio</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Mail size={16} />
              <span className="text-sm">Email via Resend</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <div className="w-10 h-10 bg-emerald-600/10 rounded-xl flex items-center justify-center mb-4">
                <Zap size={20} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Two modes</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Phone OTP via Twilio or Email OTP via Resend. Choose per project. Switch anytime.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-emerald-600/10 rounded-xl flex items-center justify-center mb-4">
                <Database size={20} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Your database</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Users and sessions live in your own NeonDB. Your backend reads them directly. Zero vendor lock-in.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-emerald-600/10 rounded-xl flex items-center justify-center mb-4">
                <Shield size={20} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Built on BetterAuth</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Production-ready sessions, CSRF protection, and cookie management out of the box.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-gray-800/50 bg-gray-900/30">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <h2 className="text-2xl font-bold mb-12 text-center">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Create project', desc: 'Pick phone or email mode' },
              { step: '2', title: 'Add your DB', desc: 'Paste your NeonDB URL' },
              { step: '3', title: 'Add credentials', desc: 'Twilio or Resend keys' },
              { step: '4', title: 'Ship it', desc: 'Copy the client code' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 text-sm font-bold">{s.step}</div>
                <h3 className="font-semibold text-white mb-1">{s.title}</h3>
                <p className="text-gray-500 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to drop passwords?</h2>
          <p className="text-gray-400 mb-8">Free to start. Add OTP auth to your app today.</p>
          <Link
            to="/sign-up"
            className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3.5 rounded-xl text-lg font-medium transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto px-6 py-6 text-center text-sm text-gray-600">
          VixAuth
        </div>
      </footer>
    </div>
  )
}
