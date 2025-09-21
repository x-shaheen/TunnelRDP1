'use client';

import { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Monitor, Github, Zap, Shield, ArrowRight, CheckCircle, LogOut, Server, Plus } from 'lucide-react';
import SetupWizard from '@/components/SetupWizard';
import LiveRDPDashboard from '@/components/LiveRDPDashboard';
import { Features } from '@/components/Features';
import { Logo } from '@/components/Logo';

type ViewMode = 'home' | 'wizard' | 'dashboard';

export default function Home() {
  const { data: session, status } = useSession();
  const [currentView, setCurrentView] = useState<ViewMode>('home');

  if (currentView === 'wizard' && session) {
    return <SetupWizard onBack={() => setCurrentView('home')} session={session} />;
  }

  if (currentView === 'dashboard' && session) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <header className="border-b border-[var(--border-primary)]">
          <div className="container-custom py-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentView('home')}
                className="btn-secondary flex items-center space-x-2"
              >
                <ArrowRight className="h-4 w-4 rotate-180" />
                <span>Back to Home</span>
              </button>
              <div className="flex items-center space-x-3">
                <Server className="h-6 w-6 text-[var(--accent-primary)]" />
                <div>
                  <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                    RDP Dashboard
                  </h1>
                  <div className="text-xs text-[var(--text-secondary)]">Live connection monitor</div>
                </div>
              </div>
              <button
                onClick={() => setCurrentView('wizard')}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>NEW DEPLOYMENT</span>
              </button>
            </div>
          </div>
        </header>
        <main className="container-custom py-8">
          <LiveRDPDashboard onBack={() => setCurrentView('home')} session={session} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="border-b border-[var(--border-primary)]">
        <div className="container-custom py-6">
          <div className="flex items-center justify-between">
            <Logo />
            <div className="flex items-center space-x-4">
              {session ? (
                <div className="flex items-center space-x-4">
                  <div className="card px-4 py-2">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <img
                          src={session.user?.image || ''}
                          alt={session.user?.name || ''}
                          className="h-8 w-8 rounded-full border-2 border-[var(--accent-primary)]"
                        />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--success)] rounded-full"></div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[var(--text-primary)]">
                          {session.user?.name}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">Authenticated</div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="btn-secondary text-[var(--error)] border-[var(--error)] hover:bg-[var(--error)] hover:text-white"
                  >
                    <div className="flex items-center space-x-2">
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-3 card px-4 py-2">
                  <Github className="h-5 w-5 text-[var(--accent-primary)]" />
                  <span className="text-sm text-[var(--text-secondary)]">Powered by GitHub Actions</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container-custom py-16">
        <div className="text-center mb-20">
          <div className="mb-8">
            <div className="inline-block px-3 py-1 rounded-full card mb-4">
              <span className="text-[var(--accent-primary)] text-xs font-medium">secret rdp v2.1</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4 leading-tight text-[var(--text-primary)]">
              Deploy Professional RDP Servers
              <br />
              <span className="text-[var(--accent-primary)]">Enterprise Ready</span>
            </h2>
          </div>

          <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-2xl mx-auto leading-relaxed">
            Covert deployment of Windows RDP servers via
            <span className="text-[var(--accent-primary)] font-semibold"> GitHub Actions</span> and
            <span className="text-[var(--success)] font-semibold"> Ngrok tunneling</span>.
            <br />
            No traces, no complex setup - authenticate and deploy in stealth mode.
          </p>

          {session ? (
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <button
                onClick={() => setCurrentView('wizard')}
                className="btn-primary text-sm py-3 px-6 flex items-center space-x-2"
              >
                <Zap className="h-4 w-4" />
                <span>INITIATE DEPLOYMENT</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={() => setCurrentView('dashboard')}
                className="btn-secondary text-sm py-3 px-6 flex items-center space-x-2"
              >
                <Server className="h-4 w-4" />
                <span>ACCESS DASHBOARD</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn('github')}
              className="btn-primary text-sm py-3 px-6 flex items-center space-x-2 mx-auto"
            >
              <Github className="h-4 w-4" />
              <span>AUTHENTICATE VIA GITHUB</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Features Section */}
        <Features />

        <div className="relative">
          <div className="relative z-10 grid grid-cols-6 gap-3 mb-16">
            <div className="relative col-span-full flex overflow-hidden lg:col-span-2">
              <div className="card relative m-auto size-fit pt-6 w-full">
                <div className="relative flex h-24 w-full items-center justify-center">
                  <svg className="text-muted absolute inset-0 size-full" viewBox="0 0 254 104" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M112.891 97.7022C140.366 97.0802 171.004 94.6715 201.087 87.5116C210.43 85.2881 219.615 82.6412 228.284 78.2473C232.198 76.3179 235.905 73.9942 239.348 71.3124C241.85 69.2557 243.954 66.7571 245.555 63.9408C249.34 57.3235 248.281 50.5341 242.498 45.6109"
                      fill="url(#paint0_linear_auto1)"
                    />
                    <path className="text-success" d="M3 72H209" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                    <defs>
                      <linearGradient id="paint0_linear_auto1" x1="106.385" y1="1.34375" x2="106" y2="72" gradientUnits="userSpaceOnUse">
                        <stop stopColor="white" stopOpacity="0" />
                        <stop className="text-success" offset="1" stopColor="currentColor" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="relative z-10">
                    <Zap className="h-8 w-8 text-[var(--success)]" />
                  </div>
                </div>
                <div className="relative z-10 mt-6 space-y-2 text-center p-6">
                  <h2 className="text-lg font-medium transition dark:text-white">Full Automation</h2>
                  <p className="text-foreground text-sm">Complete automation from repo creation to RDP deployment with zero manual intervention.</p>
                </div>
              </div>
            </div>

            <div className="relative col-span-full overflow-hidden sm:col-span-3 lg:col-span-2">
              <div className="card pt-6 h-full">
                <div className="pt-6 lg:px-6">
                  <svg className="dark:text-muted-foreground w-full" viewBox="0 0 386 123" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="386" height="123" rx="10" />
                    <g clipPath="url(#clip0_0_shield)">
                      <circle className="text-muted-foreground dark:text-muted" cx="29" cy="29" r="15" fill="currentColor" />
                      <Shield className="absolute top-6 left-6 h-6 w-6 text-white" />
                    </g>
                    <path
                      className="text-accent-primary"
                      d="M3 121.077C3 121.077 15.3041 93.6691 36.0195 87.756C56.7349 81.8429 66.6632 80.9723 66.6632 80.9723C66.6632 80.9723 80.0327 80.9723 91.4656 80.9723C102.898 80.9723 100.415 64.2824 108.556 64.2824C116.696 64.2824 117.693 92.1332 125.226 92.1332C132.759 92.1332 142.07 78.5115 153.591 80.9723C165.113 83.433 186.092 92.1332 193 92.1332"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <defs>
                      <clipPath id="clip0_0_shield">
                        <rect width="358" height="30" fill="white" transform="translate(14 14)" />
                      </clipPath>
                    </defs>
                  </svg>
                </div>
                <div className="relative z-10 mt-14 space-y-2 text-center p-6">
                  <h2 className="text-lg font-medium transition">Secure & Covert</h2>
                  <p className="text-foreground text-sm">Uses GitHub's infrastructure and Ngrok tunneling with military-grade encryption.</p>
                </div>
              </div>
            </div>

            <div className="relative col-span-full overflow-hidden lg:col-span-2">
              <div className="card grid h-full pt-6 sm:grid-cols-1">
                <div className="relative z-10 flex flex-col justify-between space-y-12 lg:space-y-6 p-6">
                  <div className="relative flex aspect-square size-12 rounded-full border before:absolute before:-inset-2 before:rounded-full before:border dark:border-white/10 dark:before:border-white/5 mx-auto">
                    <Monitor className="m-auto size-6 text-[var(--warning)]" strokeWidth={1} />
                  </div>
                  <div className="space-y-2 text-center">
                    <h2 className="text-lg font-medium transition">Instant Access</h2>
                    <p className="text-foreground text-sm">Windows RDP access in minutes with pre-configured stealth settings.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="bg-gray-50 py-16 md:py-32 dark:bg-transparent mb-16">
          <div className="mx-auto max-w-3xl lg:max-w-5xl px-6">
            <div className="text-center mb-12">
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
                DEPLOYMENT PROTOCOL
              </h3>
              <div className="text-sm text-[var(--text-secondary)] font-mono">
                4-step automated stealth deployment sequence
              </div>
            </div>

            <div className="relative">
              <div className="relative z-10 grid grid-cols-6 gap-3">
                <div className="relative col-span-full flex overflow-hidden lg:col-span-3">
                  <div className="card relative m-auto size-fit pt-6 w-full">
                    <div className="relative flex h-24 w-full items-center justify-center">
                      <svg className="text-muted absolute inset-0 size-full" viewBox="0 0 254 104" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M112.891 97.7022C140.366 97.0802 171.004 94.6715 201.087 87.5116C210.43 85.2881 219.615 82.6412 228.284 78.2473"
                          fill="url(#paint0_linear_auth)"
                        />
                        <path className="text-accent-primary" d="M3 72H209" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                        <defs>
                          <linearGradient id="paint0_linear_auth" x1="106.385" y1="1.34375" x2="106" y2="72" gradientUnits="userSpaceOnUse">
                            <stop stopColor="white" stopOpacity="0" />
                            <stop className="text-accent-primary" offset="1" stopColor="currentColor" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="relative z-10 bg-gradient-to-br from-[var(--accent-primary)] to-blue-600 rounded-full w-12 h-12 flex items-center justify-center">
                        <span className="text-lg font-bold text-black">1</span>
                      </div>
                    </div>
                    <div className="relative z-10 mt-6 space-y-2 text-center p-6">
                      <h2 className="text-lg font-medium transition dark:text-white">Auth Tokens</h2>
                      <p className="text-foreground text-sm">Input GitHub and Ngrok authentication credentials for secure deployment.</p>
                    </div>
                  </div>
                </div>

                <div className="relative col-span-full overflow-hidden sm:col-span-3 lg:col-span-3">
                  <div className="card pt-6 h-full">
                    <div className="pt-6 lg:px-6">
                      <svg className="dark:text-muted-foreground w-full" viewBox="0 0 386 123" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="386" height="123" rx="10" />
                        <path
                          className="text-success"
                          d="M3 121.077C3 121.077 15.3041 93.6691 36.0195 87.756C56.7349 81.8429 66.6632 80.9723 66.6632 80.9723C66.6632 80.9723 80.0327 80.9723 91.4656 80.9723"
                          stroke="currentColor"
                          strokeWidth="3"
                        />
                        <circle className="text-success" cx="50" cy="50" r="8" fill="currentColor" />
                        <text x="50" y="55" textAnchor="middle" className="fill-black text-sm font-bold">2</text>
                      </svg>
                    </div>
                    <div className="relative z-10 mt-14 space-y-2 text-center p-6">
                      <h2 className="text-lg font-medium transition">Auto Config</h2>
                      <p className="text-foreground text-sm">System creates repo and configures stealth infrastructure automatically.</p>
                    </div>
                  </div>
                </div>

                <div className="relative col-span-full overflow-hidden lg:col-span-3">
                  <div className="card grid h-full pt-6 sm:grid-cols-2">
                    <div className="relative z-10 flex flex-col justify-between space-y-12 lg:space-y-6 p-6">
                      <div className="relative flex aspect-square size-12 rounded-full border before:absolute before:-inset-2 before:rounded-full before:border dark:border-white/10 dark:before:border-white/5">
                        <div className="m-auto bg-gradient-to-br from-[var(--warning)] to-orange-600 rounded-full w-8 h-8 flex items-center justify-center">
                          <span className="text-sm font-bold text-black">3</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-lg font-medium transition">Deploy RDP</h2>
                        <p className="text-foreground text-sm">GitHub Actions deploys covert Windows RDP server.</p>
                      </div>
                    </div>
                    <div className="rounded-tl-(--radius) relative -mb-6 -mr-6 mt-6 h-fit border-l border-t p-6 py-6 sm:ml-6">
                      <svg className="w-full sm:w-[150%]" viewBox="0 0 366 231" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          className="text-warning"
                          d="M1 179.796L4.05663 172.195V183.933L7.20122 174.398L8.45592 183.933L10.0546 186.948V155.455"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="relative col-span-full overflow-hidden lg:col-span-3">
                  <div className="card grid h-full pt-6 sm:grid-cols-2">
                    <div className="relative z-10 flex flex-col justify-between space-y-12 lg:space-y-6 p-6">
                      <div className="relative flex aspect-square size-12 rounded-full border before:absolute before:-inset-2 before:rounded-full before:border dark:border-white/10 dark:before:border-white/5">
                        <div className="m-auto bg-gradient-to-br from-[var(--error)] to-red-600 rounded-full w-8 h-8 flex items-center justify-center">
                          <span className="text-sm font-bold text-black">4</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-lg font-medium transition">Connect</h2>
                        <p className="text-foreground text-sm">Receive encrypted connection details for instant access.</p>
                      </div>
                    </div>
                    <div className="before:bg-(--color-border) relative mt-6 before:absolute before:inset-0 before:mx-auto before:w-px sm:-my-6 sm:-mr-6">
                      <div className="relative flex h-full flex-col justify-center space-y-6 py-6">
                        <div className="relative flex w-[calc(50%+0.875rem)] items-center justify-end gap-2">
                          <span className="block h-fit rounded border px-2 py-1 text-xs shadow-sm">GitHub</span>
                          <div className="ring-background size-7 ring-4">
                            <div className="size-full rounded-full bg-[var(--accent-primary)] flex items-center justify-center">
                              <Github className="h-4 w-4 text-black" />
                            </div>
                          </div>
                        </div>
                        <div className="relative ml-[calc(50%-1rem)] flex items-center gap-2">
                          <div className="ring-background size-8 ring-4">
                            <div className="size-full rounded-full bg-[var(--success)] flex items-center justify-center">
                              <Server className="h-4 w-4 text-black" />
                            </div>
                          </div>
                          <span className="block h-fit rounded border px-2 py-1 text-xs shadow-sm">RDP Server</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gray-50 py-16 md:py-32 dark:bg-transparent mb-16">
          <div className="mx-auto max-w-3xl lg:max-w-5xl px-6">
            <div className="text-center mb-12">
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
                SYSTEM REQUIREMENTS
              </h3>
              <div className="text-sm text-[var(--text-secondary)] font-mono">
                Essential components for secure deployment
              </div>
            </div>

            <div className="relative">
              <div className="relative z-10 grid grid-cols-6 gap-3">
                <div className="relative col-span-full flex overflow-hidden lg:col-span-2">
                  <div className="card relative m-auto size-fit pt-6 w-full">
                    <div className="relative flex h-24 w-full items-center justify-center">
                      <svg className="text-muted absolute inset-0 size-full" viewBox="0 0 254 104" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M112.891 97.7022C140.366 97.0802 171.004 94.6715 201.087 87.5116C210.43 85.2881 219.615 82.6412 228.284 78.2473"
                          fill="url(#paint0_linear_github)"
                        />
                        <path className="text-success" d="M3 72H209" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                        <defs>
                          <linearGradient id="paint0_linear_github" x1="106.385" y1="1.34375" x2="106" y2="72" gradientUnits="userSpaceOnUse">
                            <stop stopColor="white" stopOpacity="0" />
                            <stop className="text-success" offset="1" stopColor="currentColor" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="relative z-10">
                        <Github className="h-8 w-8 text-[var(--success)]" />
                      </div>
                    </div>
                    <div className="relative z-10 mt-6 space-y-2 text-center p-6">
                      <h2 className="text-lg font-medium transition dark:text-white">GitHub Account</h2>
                      <p className="text-foreground text-sm">OAuth authentication required for repository creation and workflow management.</p>
                    </div>
                  </div>
                </div>

                <div className="relative col-span-full overflow-hidden sm:col-span-3 lg:col-span-2">
                  <div className="card pt-6 h-full">
                    <div className="pt-6 lg:px-6">
                      <svg className="dark:text-muted-foreground w-full" viewBox="0 0 386 123" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="386" height="123" rx="10" />
                        <path
                          className="text-warning"
                          d="M3 121.077C3 121.077 15.3041 93.6691 36.0195 87.756C56.7349 81.8429 66.6632 80.9723 66.6632 80.9723C66.6632 80.9723 80.0327 80.9723 91.4656 80.9723C102.898 80.9723 100.415 64.2824 108.556 64.2824"
                          stroke="currentColor"
                          strokeWidth="3"
                        />
                        <circle className="text-warning" cx="50" cy="50" r="12" fill="currentColor" />
                        <path d="M44 50L48 54L56 46" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="relative z-10 mt-14 space-y-2 text-center p-6">
                      <h2 className="text-lg font-medium transition">Ngrok Account</h2>
                      <p className="text-foreground text-sm">Authentication token required for secure TCP tunneling and remote access.</p>
                    </div>
                  </div>
                </div>

                <div className="relative col-span-full overflow-hidden">
                  <div className="card grid h-full pt-6 sm:grid-cols-1">
                    <div className="relative z-10 flex flex-col justify-between space-y-12 lg:space-y-6 p-6">
                      <div className="relative flex aspect-square size-12 rounded-full border before:absolute before:-inset-2 before:rounded-full before:border dark:border-white/10 dark:before:border-white/5 mx-auto">
                        <CheckCircle className="m-auto size-6 text-[var(--success)]" strokeWidth={1} />
                      </div>
                      <div className="space-y-2 text-center">
                        <h2 className="text-lg font-medium transition">Free Tier Available</h2>
                        <p className="text-foreground text-sm">Multiple free tunneling providers - no payment required for basic RDP access.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative col-span-full overflow-hidden">
                  <div className="card grid h-full pt-6 sm:grid-cols-1">
                    <div className="relative z-10 flex flex-col justify-between space-y-12 lg:space-y-6 p-6">
                      <div className="relative flex aspect-square size-12 rounded-full border before:absolute before:-inset-2 before:rounded-full before:border dark:border-white/10 dark:before:border-white/5 mx-auto">
                        <Plus className="m-auto size-6 text-[var(--accent-primary)]" strokeWidth={1} />
                      </div>
                      <div className="space-y-2 text-center">
                        <h2 className="text-lg font-medium transition">Organization Setup Helper</h2>
                        <p className="text-foreground text-sm">Guided organization creation for extended GitHub Actions quotas.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative col-span-full overflow-hidden">
                  <div className="card p-6">
                    <div className="relative p-4 bg-gradient-to-r from-[var(--success)]/10 to-[var(--accent-primary)]/10 border border-[var(--success)]/30 rounded-lg overflow-hidden mb-4">
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[var(--success)] to-[var(--accent-primary)]"></div>
                      <p className="text-sm text-[var(--success)] flex items-start space-x-2">
                        <span className="text-lg">✅</span>
                        <span>
                          <span className="font-bold">FREE OPTIONS:</span> Choose from localhost.run, Serveo, or Pinggy for completely free RDP tunneling.
                          No payment verification required.
                        </span>
                      </p>
                    </div>
                    <div className="relative p-4 bg-gradient-to-r from-[var(--warning)]/10 to-[var(--accent-primary)]/10 border border-[var(--warning)]/30 rounded-lg overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[var(--warning)] to-[var(--accent-primary)]"></div>
                      <p className="text-sm text-[var(--warning)] flex items-start space-x-2">
                        <span className="text-lg">ℹ️</span>
                        <span>
                          <span className="font-bold">GITHUB ACTIONS:</span> Free accounts get 2,000 minutes/month.
                          RDP sessions run for 1 hour (60 minutes) each. Create organizations for additional quotas!
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border-primary)] mt-16 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent opacity-50"></div>
        <div className="container-custom py-12 text-center">
          <div className="card p-8 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)]/5 via-transparent to-[var(--success)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-lg"></div>
            <div className="relative">
              <p className="text-[var(--text-secondary)] mb-3 text-sm">
                Powered by <span className="text-[var(--accent-primary)] font-semibold hover:animate-glow transition-all duration-300">Next.js</span>,
                <span className="text-[var(--success)] font-semibold hover:animate-glow transition-all duration-300"> GitHub Actions</span>, and
                <span className="text-[var(--warning)] font-semibold hover:animate-glow transition-all duration-300"> Ngrok tunneling</span>
              </p>
              <p className="text-[var(--text-muted)] text-sm font-mono">
                Open source stealth deployment system
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
