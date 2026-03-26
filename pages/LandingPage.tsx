import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import RequestDemoModal from '../components/RequestDemoModal';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <div className="min-h-screen bg-blue-400">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-blue-400/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-6 h-6 text-white" />
              <span className="text-lg font-bold text-white">Ordus ABA</span>
            </div>
            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate('/login')}
                className="text-white hover:text-white/80 font-medium transition-colors"
              >
                Schedule
              </button>
              <button
                onClick={() => setShowDemoModal(true)}
                className="px-6 py-2 bg-white text-slate-800 rounded-full hover:bg-white/90 transition-colors font-semibold text-sm uppercase tracking-wide"
              >
                Book a Demo
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-8 leading-tight">
            Scheduling in ABA is Broken.
          </h1>
          <p className="text-lg sm:text-xl text-white/90 max-w-4xl mx-auto leading-relaxed mb-4">
            Spreadsheets, manual fixes, and human memory can't keep up with clinical, compliance, and
            workforce complexity.{' '}
            <span className="font-bold underline decoration-2 underline-offset-4">
              When scheduling fails, everything else suffers. Lost Revenue,
              denied claims, burned-out therapists, and constant operational fire drills.
            </span>
          </p>
        </div>
      </section>

      {/* Meet Ordus ABA + Product Mockup */}
      <section className="pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl sm:text-5xl font-bold italic text-yellow-400 mb-6">
                Meet Ordus ABA
              </h2>
              <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
                Intelligent Workforce Optimization for ABA Therapy Clinics
              </h3>
            </div>
            {/* iMac Mockup */}
            <div className="flex justify-center">
              <div className="w-full max-w-lg">
                {/* Screen */}
                <div className="bg-slate-900 rounded-t-xl border-4 border-slate-700 p-2 shadow-2xl">
                  <div className="bg-slate-800 rounded p-2">
                    {/* Top bar */}
                    <div className="flex items-center justify-between mb-2 px-2">
                      <div className="flex items-center gap-2">
                        <SparklesIcon className="w-3 h-3 text-blue-400" />
                        <span className="text-[8px] text-white font-medium">Ordus ABA</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[7px] text-slate-400">SCHEDULER</span>
                        <span className="text-[7px] text-slate-500">02/03 2025</span>
                      </div>
                      <div className="flex gap-1">
                        <span className="px-1.5 py-0.5 bg-green-500 rounded text-[6px] text-white">Generate Schedule</span>
                        <span className="px-1.5 py-0.5 bg-blue-500 rounded text-[6px] text-white">Bonus Controls</span>
                      </div>
                    </div>
                    {/* Schedule rows */}
                    <div className="space-y-1">
                      {[
                        { name: 'B. Sullivan', colors: ['bg-purple-500', 'bg-orange-400', 'bg-slate-600', 'bg-pink-400'] },
                        { name: 'C. Mock', colors: ['bg-cyan-500', 'bg-emerald-500', 'bg-amber-400'] },
                        { name: 'S. Nelson', colors: ['bg-green-500', 'bg-blue-500', 'bg-red-400', 'bg-orange-500'] },
                        { name: 'I. Alvarez', colors: ['bg-yellow-400', 'bg-purple-400', 'bg-pink-500', 'bg-teal-500'] },
                        { name: 'P. Williams', colors: ['bg-blue-400', 'bg-rose-400', 'bg-emerald-400', 'bg-amber-500'] },
                        { name: 'M. Anderson', colors: ['bg-indigo-400', 'bg-green-400', 'bg-orange-400'] },
                        { name: 'R. Foster', colors: ['bg-teal-400', 'bg-pink-400', 'bg-cyan-400', 'bg-violet-400'] },
                        { name: 'A. Grossman', colors: ['bg-rose-500', 'bg-blue-400', 'bg-amber-400'] },
                        { name: 'S. Miyazaki', colors: ['bg-emerald-500', 'bg-purple-500', 'bg-orange-400', 'bg-pink-400'] },
                        { name: 'L. Monroe', colors: ['bg-red-400', 'bg-cyan-500', 'bg-yellow-400', 'bg-green-400'] },
                      ].map((row, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <span className="text-[6px] text-slate-300 w-14 truncate">{row.name}</span>
                          <div className="flex-1 flex gap-0.5">
                            {row.colors.map((color, j) => (
                              <div
                                key={j}
                                className={`${color} h-2.5 rounded-sm`}
                                style={{ width: `${20 + Math.random() * 30}%` }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Stand */}
                <div className="flex justify-center">
                  <div className="w-24 h-4 bg-gradient-to-b from-slate-600 to-slate-500 rounded-b-sm" />
                </div>
                <div className="flex justify-center">
                  <div className="w-36 h-2 bg-gradient-to-b from-slate-500 to-slate-400 rounded-b-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Book a Demo CTA */}
      <section className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center">
          <button
            onClick={() => setShowDemoModal(true)}
            className="px-12 py-4 bg-white text-slate-800 rounded-full hover:bg-white/90 transition-colors font-semibold text-lg uppercase tracking-wide shadow-lg"
          >
            Book a Demo
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Optimization Powered by Real-World ABA Constraints
            </h2>
            <p className="text-lg text-white/80 max-w-4xl mx-auto">
              Ordus evaluates thousands of schedule combinations to deliver clinically valid, compliant, and staff
              friendly-schedules.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-xl font-bold text-blue-500 mb-4 leading-snug">
                Intelligent Schedule Generation
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Optimized for billable hours, travel efficiency, and therapist wellbeing.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-xl font-bold text-blue-500 mb-4 leading-snug">
                Constraint and Compliance Engine
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Insurance credentialing, supervision ratios, labor rules — enforced in real time.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-xl font-bold text-blue-500 mb-4 leading-snug">
                Adaptive Schedule Re-Optimization
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Lock what matters, re-optimize the rest when cancellations or call-outs happen.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-xl font-bold text-blue-500 mb-4 leading-snug">
                Visual, Interactive Scheduling
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Gantt-style views, drag-and-drop adjustments, instant validation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Scrolling Marquee Ticker */}
      <section className="bg-blue-300/60 py-5 overflow-hidden">
        <div className="animate-marquee whitespace-nowrap flex items-center">
          {[1, 2].map((set) => (
            <div key={set} className="flex items-center">
              <span className="text-2xl sm:text-3xl font-bold text-white mx-6">Turn hours of scheduling into minutes</span>
              <span className="text-2xl sm:text-3xl font-bold text-white/60 mx-4">&gt;</span>
              <span className="text-2xl sm:text-3xl font-bold text-white mx-6">Schedules your therapists won't hate</span>
              <span className="text-2xl sm:text-3xl font-bold text-white/60 mx-4">&gt;</span>
              <span className="text-2xl sm:text-3xl font-bold text-white mx-6">Stop denied claims before they happen</span>
              <span className="text-2xl sm:text-3xl font-bold text-white/60 mx-4">&gt;</span>
            </div>
          ))}
        </div>
      </section>

      {/* Operational Efficiency Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-indigo-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block relative">
              <h2 className="text-4xl sm:text-5xl font-bold italic text-white">
                Put Scheduling on Autopilot
              </h2>
              {/* Decorative underline */}
              <svg className="absolute -bottom-3 left-0 w-full" viewBox="0 0 400 12" fill="none">
                <path d="M2 8C80 2 200 2 398 8" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">The Problem</h3>
              <p className="text-white/80 leading-relaxed text-lg">
                Schedulers spend 10-20 hours per week manually adjusting schedules. A single cancellation
                can trigger cascading conflicts.
              </p>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-yellow-400 mb-4">Ordus Solution</h3>
              <p className="text-white/80 leading-relaxed text-lg">
                Ordus' proprietary algorithm generates valid daily schedules in seconds, dynamically
                recalculating when changes occur.
              </p>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-yellow-400 mb-4">The Result</h3>
              <p className="text-white/80 leading-relaxed text-lg">
                Reduce administrative overhead by 80%, decrease therapist burnout, and ensure your clinic runs at maximum billable capacity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 sm:px-6 lg:px-8 bg-indigo-950">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 mb-2">
            <SparklesIcon className="w-5 h-5 text-white" />
            <span className="text-base font-bold text-white">Ordus ABA</span>
          </div>
          <p className="text-white/60 text-sm">
            Smarter scheduling for ABA operations
          </p>
        </div>
      </footer>

      {showDemoModal && <RequestDemoModal onClose={() => setShowDemoModal(false)} />}
    </div>
  );
};

export default LandingPage;
