import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { CalendarIcon } from '../components/icons/CalendarIcon';
import { UserGroupIcon } from '../components/icons/UserGroupIcon';
import { ClockIcon } from '../components/icons/ClockIcon';
import RequestDemoModal from '../components/RequestDemoModal';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-8 h-8 text-blue-400" />
              <span className="text-xl font-bold text-white">Fiddler Scheduler</span>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Login
            </button>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8 flex justify-center">
            <SparklesIcon className="w-20 h-20 text-blue-400 animate-pulse" />
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            Intelligent Therapy
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              Scheduling Made Simple
            </span>
          </h1>
          <p className="text-xl sm:text-2xl text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Optimize your therapy practice with AI-powered scheduling that learns from your preferences
            and maximizes team efficiency.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setShowDemoModal(true)}
              className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold text-lg shadow-lg hover:shadow-blue-500/50 hover:scale-105"
            >
              Request a Demo
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all font-semibold text-lg"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-4">
            Why Choose Fiddler Scheduler?
          </h2>
          <p className="text-slate-300 text-center mb-16 text-lg">
            Built specifically for therapy practices, by people who understand scheduling challenges
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-900/50 p-8 rounded-xl border border-slate-700 hover:border-blue-500 transition-all">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                <SparklesIcon className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI-Powered Optimization</h3>
              <p className="text-slate-300 leading-relaxed">
                Our intelligent algorithm learns from your scheduling patterns and preferences to create
                optimal schedules that minimize conflicts and maximize coverage.
              </p>
            </div>

            <div className="bg-slate-900/50 p-8 rounded-xl border border-slate-700 hover:border-blue-500 transition-all">
              <div className="w-12 h-12 bg-cyan-500/10 rounded-lg flex items-center justify-center mb-4">
                <UserGroupIcon className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Team Management</h3>
              <p className="text-slate-300 leading-relaxed">
                Easily manage therapists, clients, and teams. Track availability, specializations,
                and preferences all in one intuitive interface.
              </p>
            </div>

            <div className="bg-slate-900/50 p-8 rounded-xl border border-slate-700 hover:border-blue-500 transition-all">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
                <ClockIcon className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Save Time & Reduce Stress</h3>
              <p className="text-slate-300 leading-relaxed">
                What used to take hours now takes minutes. Generate complete schedules with a single
                click and spend more time on what matters most.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-16">
            Powerful Features for Your Practice
          </h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Smart Scheduling</h3>
                <p className="text-slate-300">
                  Generate optimized schedules that consider therapist availability, client needs,
                  team assignments, and historical preferences.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                  <UserGroupIcon className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Client & Therapist Profiles</h3>
                <p className="text-slate-300">
                  Maintain comprehensive profiles with specializations, availability, preferences,
                  and scheduling history.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <SparklesIcon className="w-5 h-5 text-purple-400" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Learning Algorithm</h3>
                <p className="text-slate-300">
                  Rate generated schedules to train the AI. The system continuously improves based
                  on your feedback.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <ClockIcon className="w-5 h-5 text-green-400" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Callout Management</h3>
                <p className="text-slate-300">
                  Handle last-minute changes with ease. Quick callout tracking and automatic
                  schedule adjustments.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-cyan-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Scheduling?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join therapy practices that have saved hundreds of hours with intelligent scheduling.
          </p>
          <button
            onClick={() => setShowDemoModal(true)}
            className="px-8 py-4 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-all font-semibold text-lg shadow-xl hover:scale-105"
          >
            Request Your Demo Today
          </button>
        </div>
      </section>

      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <SparklesIcon className="w-6 h-6 text-blue-400" />
            <span className="text-lg font-bold text-white">Fiddler Scheduler</span>
          </div>
          <p className="text-slate-400">
            Intelligent scheduling for therapy practices
          </p>
        </div>
      </footer>

      {showDemoModal && <RequestDemoModal onClose={() => setShowDemoModal(false)} />}
    </div>
  );
};

export default LandingPage;
