import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { CalendarIcon } from '../components/icons/CalendarIcon';
import { UserGroupIcon } from '../components/icons/UserGroupIcon';
import { ClockIcon } from '../components/icons/ClockIcon';
import RequestDemoModal from '../components/RequestDemoModal';
import EmailCaptureForm from '../components/EmailCaptureForm';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-6 h-6 text-slate-900" />
                <span className="text-lg font-bold text-slate-900">Ordus ABA</span>
              </div>
              <span className="text-xs text-slate-600 ml-8">Smarter scheduling for ABA operations</span>
            </div>
            <div className="flex items-center gap-8">
              <a href="#features" className="text-slate-700 hover:text-slate-900 font-medium">Features</a>
              <a href="#workflow" className="text-slate-700 hover:text-slate-900 font-medium">Workflow</a>
              <a href="#demo" className="text-slate-700 hover:text-slate-900 font-medium">Demo</a>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Open demo
              </button>
              <button
                onClick={() => setShowDemoModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
              >
                Request access
                <SparklesIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl">
            <div className="mb-6">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <SparklesIcon className="w-4 h-4" />
                Built for ABA scheduling teams
              </span>
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif text-slate-900 mb-6 leading-tight">
              Valid schedules for your ABA clinic, generated{' '}
              <span className="text-blue-600">in under 1 minute.</span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-2xl">
              Ordus ABA is a credential-aware workspace for ABA operations. Ensure the right staff always matches the right insurance rules, anywhere in the country.
            </p>
            <div className="max-w-xl">
              <EmailCaptureForm source="hero_section" />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-4">
            <h2 className="text-4xl font-serif text-slate-900 mb-4">
              Built for the way ABA actually schedules
            </h2>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto">
              Keep clients, staff, locations, and supervision constraints in view—without losing the simplicity of a weekly grid.
            </p>
          </div>
          <div className="mt-12 text-right text-sm text-slate-500 mb-8">
            HIPAA-ready workflows (prototype)
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl border border-slate-200 hover:shadow-lg transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6 text-slate-700" />
                </div>
                <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded">Built for ABA</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Callout resolution</h3>
              <p className="text-slate-600 leading-relaxed">
                Instantly solve for staff or client callouts with automated re-scheduling and coverage matching.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl border border-slate-200 hover:shadow-lg transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                  <ClockIcon className="w-6 h-6 text-slate-700" />
                </div>
                <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded">Built for ABA</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Indirect time balancing</h3>
              <p className="text-slate-600 leading-relaxed">
                Balance non-billable time across your team based on a custom hierarchy you define.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl border border-slate-200 hover:shadow-lg transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                  <UserGroupIcon className="w-6 h-6 text-slate-700" />
                </div>
                <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded">Built for ABA</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Instant generation</h3>
              <p className="text-slate-600 leading-relaxed">
                Generate a complete, valid schedule for your entire clinic in under 60 seconds.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <SparklesIcon className="w-6 h-6 text-slate-700" />
              <h2 className="text-4xl font-serif text-slate-900">
                A clear workflow from intake to schedule
              </h2>
            </div>
            <p className="text-lg text-slate-600">
              Built for coordinators, not spreadsheets.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-xl border border-slate-200">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Try the interactive demo</h3>
              <p className="text-slate-600 mb-8">
                This is a front-end prototype. Interactions are real, data is demo-only.
              </p>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                      <ClockIcon className="w-6 h-6 text-slate-700" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 mb-1">Reduce gaps</h4>
                    <p className="text-slate-600">
                      Spot and fill empty blocks with one click suggestions.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                      <SparklesIcon className="w-6 h-6 text-slate-700" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 mb-1">Protect authorizations</h4>
                    <p className="text-slate-600">
                      See units, dates, and constraints right where scheduling happens.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                      <UserGroupIcon className="w-6 h-6 text-slate-700" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 mb-1">Match the right staff</h4>
                    <p className="text-slate-600">
                      Skills, availability, locations, and supervision rules in one view.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-8 flex gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                >
                  Launch demo
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Download one-pager
                </button>
              </div>
            </div>

            <div className="bg-white p-8 rounded-xl border border-slate-200">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold text-slate-900">Intake snapshot</h3>
                <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded">Read-only</span>
              </div>
              <p className="text-slate-600 mb-8">
                How constraints become a schedule.
              </p>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-slate-200">
                  <span className="text-slate-600">Client</span>
                  <span className="text-slate-900 font-medium">Mia R.</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-200">
                  <span className="text-slate-600">Insurance</span>
                  <span className="text-slate-900 font-medium">BlueCross</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-200">
                  <span className="text-slate-600">Status</span>
                  <span className="text-slate-900 font-medium">Active callout</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-200">
                  <span className="text-slate-600">Preferred times</span>
                  <span className="text-slate-900 font-medium">Mon/Wed/Fri mornings</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-200">
                  <span className="text-slate-600">Location</span>
                  <span className="text-slate-900 font-medium">Home + school</span>
                </div>
              </div>
              <div className="mt-8 p-6 bg-slate-50 rounded-lg">
                <h4 className="text-lg font-bold text-slate-900 mb-2">Operations control</h4>
                <p className="text-slate-600 mb-4">
                  Resolve callouts and balance indirect time instantly.
                </p>
                <button className="w-full px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors font-medium flex items-center justify-between">
                  <span>Resolve active callouts</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="demo" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-serif text-slate-900 mb-6">
            Ready to see how it works?
          </h2>
          <p className="text-xl text-slate-600 mb-8">
            Join ABA practices that are simplifying their scheduling operations.
          </p>
          <button
            onClick={() => setShowDemoModal(true)}
            className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg"
          >
            Request Access
          </button>
        </div>
      </section>

      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 mb-2">
              <SparklesIcon className="w-5 h-5 text-slate-700" />
              <span className="text-base font-bold text-slate-900">Ordus ABA</span>
            </div>
            <p className="text-slate-600 text-sm">
              Smarter scheduling for ABA operations
            </p>
          </div>
        </div>
      </footer>

      {showDemoModal && <RequestDemoModal onClose={() => setShowDemoModal(false)} />}
    </div>
  );
};

export default LandingPage;
