import { Link } from 'react-router'
import { Phone, ArrowRight, Shield, Zap } from 'lucide-react'

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800/50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
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
            <Link to="/sign-up" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-emerald-600/10 text-emerald-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-emerald-500/20">
            <Phone size={14} />
            Phone OTP auth as a service
          </div>
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Phone auth for
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
              your apps
            </span>
          </h1>
          <p className="text-xl text-gray-400 leading-relaxed mb-10">
            Add SMS OTP authentication to any app in minutes.
            Create a project, paste your Twilio creds, and you're live.
          </p>
          <Link
            to="/sign-up"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3.5 rounded-xl text-lg font-medium transition-colors"
          >
            Start Building <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      <section className="border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6">
              <div className="text-emerald-400 mb-3"><Zap size={24} /></div>
              <h3 className="text-lg font-semibold mb-2">5-minute setup</h3>
              <p className="text-gray-400 text-sm">Create a project, add your NeonDB URL and Twilio credentials. Auth tables auto-created.</p>
            </div>
            <div className="p-6">
              <div className="text-emerald-400 mb-3"><Phone size={24} /></div>
              <h3 className="text-lg font-semibold mb-2">SMS OTP only</h3>
              <p className="text-gray-400 text-sm">No passwords, no social login. Just phone number + code. The simplest auth flow.</p>
            </div>
            <div className="p-6">
              <div className="text-emerald-400 mb-3"><Shield size={24} /></div>
              <h3 className="text-lg font-semibold mb-2">Your database</h3>
              <p className="text-gray-400 text-sm">Users and sessions live in your own NeonDB. Your backend reads them directly. No vendor lock-in.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
