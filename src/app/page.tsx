'use client';

import { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Monitor, Github, Zap, Shield, ArrowRight, CheckCircle, LogOut, Server, Plus } from 'lucide-react';
import SetupWizard from '@/components/SetupWizard';
import LiveRDPDashboard from '@/components/LiveRDPDashboard';
import { EnhancedFeatures } from '@/components/EnhancedFeatures';
import { Logo } from '@/components/Logo';
import { DottedSurface } from '@/components/ui/dotted-surface';
import { Button } from '@/components/ui/button';

type ViewMode = 'home' | 'wizard' | 'dashboard';

export default function Home() {
  const { data: session, status } = useSession();
  const [currentView, setCurrentView] = useState<ViewMode>('home');

  if (currentView === 'wizard' && session) {
    return <SetupWizard onBack={() => setCurrentView('home')} session={session} />;
  }

  if (currentView === 'dashboard' && session) {
    return (
      <div className="min-h-screen bg-black text-white relative overflow-hidden">
        {/* Dotted Surface Background */}
        <DottedSurface />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/70 to-black/90 pointer-events-none z-0" />

        {/* Content Container */}
        <div className="relative z-10">
          <header className="border-b border-gray-800/50 bg-black/30 backdrop-blur-md">
            <div className="container-custom py-6">
              <div className="flex items-center justify-between">
                <Button
                  onClick={() => setCurrentView('home')}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800/50 bg-transparent"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  <span>Back to Home</span>
                </Button>
                <div className="flex items-center space-x-3">
                  <Server className="h-6 w-6 text-blue-400" />
                  <div>
                    <h1 className="text-lg font-semibold text-white">
                      RDP Dashboard
                    </h1>
                    <div className="text-xs text-gray-400">Live connection monitor</div>
                  </div>
                </div>
                <Button
                  onClick={() => setCurrentView('wizard')}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0"
                >
                  <Plus className="h-4 w-4" />
                  <span>NEW DEPLOYMENT</span>
                </Button>
              </div>
            </div>
          </header>
          <main className="container-custom py-8">
            <LiveRDPDashboard onBack={() => setCurrentView('home')} session={session} />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Dotted Surface Background */}
      <DottedSurface />

      {/* Gradient Overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/70 to-black/90 pointer-events-none z-0" />

      {/* Content Container */}
      <div className="relative z-10">
        <header className="border-b border-gray-800/50 bg-black/30 backdrop-blur-md">
          <div className="container-custom py-6">
            <div className="flex items-center justify-between">
              <Logo />
              <div className="flex items-center space-x-4">
                {session ? (
                  <div className="flex items-center space-x-4">
                    <div className="card px-4 py-2 bg-white/5 backdrop-blur-sm border-white/10">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <img
                            src={session.user?.image || ''}
                            alt={session.user?.name || ''}
                            className="h-8 w-8 rounded-full border-2 border-blue-400"
                          />
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full"></div>
                        </div>
                        <div className="hidden sm:block">
                          <div className="text-sm font-medium text-white">
                            {session.user?.name}
                          </div>
                          <div className="text-xs text-gray-300">Authenticated</div>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => signOut()}
                      variant="outline"
                      size="sm"
                      className="text-red-400 border-red-400/50 hover:bg-red-500/10 bg-transparent"
                    >
                      <div className="flex items-center space-x-2">
                        <LogOut className="h-4 w-4" />
                        <span className="hidden sm:inline">Sign Out</span>
                      </div>
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3 card px-4 py-2 bg-white/5 backdrop-blur-sm border-white/10">
                    <Github className="h-5 w-5 text-blue-400" />
                    <span className="text-sm text-gray-300 hidden sm:inline">Powered by GitHub Actions</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="container-custom py-16">
          <div className="text-center mb-20">
            <div className="mb-8">
              <div className="inline-block px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-6">
                <span className="text-blue-400 text-xs font-medium tracking-wider">TUNNELRDP v2.1</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
                <span className="bg-gradient-to-r from-white via-gray-200 to-white bg-clip-text text-transparent">
                  Deploy Professional RDP Servers
                </span>
                <br />
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Enterprise Ready
                </span>
              </h2>
            </div>

            <p className="text-lg text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
              <span className="text-green-400 font-semibold">Private RDP in one click</span> -
              <span className="text-blue-400 font-semibold"> Free forever!</span>
              <br />
              <span className="text-gray-400">No traces, no complex setup - authenticate and deploy instantly.</span>
            </p>

            {session ? (
              <div className="flex flex-col sm:flex-row gap-6 items-center justify-center">
                <Button
                  onClick={() => setCurrentView('wizard')}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 shadow-lg shadow-blue-500/25"
                >
                  <Zap className="h-5 w-5" />
                  <span>INITIATE DEPLOYMENT</span>
                  <ArrowRight className="h-5 w-5" />
                </Button>

                <Button
                  onClick={() => setCurrentView('dashboard')}
                  variant="outline"
                  size="lg"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800/50 bg-transparent"
                >
                  <Server className="h-5 w-5" />
                  <span>ACCESS DASHBOARD</span>
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => signIn('github')}
                size="lg"
                className="bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white border border-gray-600 shadow-lg"
              >
                <Github className="h-5 w-5" />
                <span>AUTHENTICATE VIA GITHUB</span>
                <ArrowRight className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Enhanced Features Section */}
          <EnhancedFeatures />

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
                        <p className="text-foreground text-sm">One-click deployment of instant Windows RDP servers.</p>
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

        <footer className="border-t border-gray-800/50 mt-16 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-50"></div>
          <div className="container-custom py-12 text-center">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-8 relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-lg"></div>
              <div className="relative">
                <p className="text-gray-300 mb-3 text-sm">
                  Powered by <span className="text-blue-400 font-semibold hover:text-blue-300 transition-colors">Next.js</span>,
                  <span className="text-green-400 font-semibold hover:text-green-300 transition-colors"> GitHub Actions</span>, and
                  <span className="text-yellow-400 font-semibold hover:text-yellow-300 transition-colors"> Ngrok tunneling</span>
                </p>
                <p className="text-gray-500 text-sm font-mono">
                  Open source stealth deployment system
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
