import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Shield, Zap, Monitor, Users, LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

export function EnhancedFeatures() {
    return (
        <section className="py-16 md:py-24">
            <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:max-w-6xl lg:px-8">
                <div className="mx-auto grid gap-4 lg:grid-cols-2">
                    <FeatureCard>
                        <CardHeader className="pb-3">
                            <CardHeading
                                icon={Shield}
                                title="Enterprise Security"
                                description="Military-grade encryption with automated access management for your RDP infrastructure."
                            />
                        </CardHeader>

                        <div className="relative mb-6 border-t border-dashed border-white/10 sm:mb-0">
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent"></div>
                            <div className="aspect-[76/59] p-6">
                                <div className="relative h-full w-full rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex space-x-1">
                                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        </div>
                                        <div className="text-xs text-white/60 font-mono">SECURE</div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-2 bg-green-500/30 rounded w-3/4"></div>
                                        <div className="h-2 bg-blue-500/30 rounded w-1/2"></div>
                                        <div className="h-2 bg-purple-500/30 rounded w-2/3"></div>
                                    </div>
                                    <div className="absolute bottom-4 right-4">
                                        <Shield className="h-6 w-6 text-green-400" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </FeatureCard>

                    <FeatureCard>
                        <CardHeader className="pb-3">
                            <CardHeading
                                icon={Zap}
                                title="Lightning Fast Deployment"
                                description="Instant RDP connections with optimized performance monitoring and real-time session management."
                            />
                        </CardHeader>

                        <CardContent>
                            <div className="relative mb-6 sm:mb-0">
                                <div className="absolute -inset-6 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
                                <div className="aspect-[76/59] border border-white/10 rounded-lg bg-gradient-to-br from-white/5 to-transparent p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="text-xs text-white/60 font-mono">DEPLOYMENT</div>
                                        <div className="flex items-center space-x-1">
                                            <div className="w-1 h-1 rounded-full bg-green-400 animate-pulse"></div>
                                            <div className="text-xs text-green-400">ACTIVE</div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                            <div className="text-xs text-white/80">GitHub Actions</div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                            <div className="text-xs text-white/80">Ngrok Tunnel</div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                                            <div className="text-xs text-white/80">RDP Server</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </FeatureCard>

                    <FeatureCard className="p-6 lg:col-span-2">
                        <p className="mx-auto my-6 max-w-md text-balance text-center text-xl font-semibold text-white">
                            Professional RDP automation with enterprise-grade security and monitoring.
                        </p>

                        <div className="flex justify-center gap-6 overflow-hidden">
                            <CircularUI
                                label="Security"
                                circles={[{ pattern: 'border' }, { pattern: 'primary' }]}
                            />

                            <CircularUI
                                label="Speed"
                                circles={[{ pattern: 'none' }, { pattern: 'success' }]}
                            />

                            <CircularUI
                                label="Monitoring"
                                circles={[{ pattern: 'warning' }, { pattern: 'none' }]}
                            />

                            <CircularUI
                                label="Analytics"
                                circles={[{ pattern: 'primary' }, { pattern: 'border' }]}
                                className="hidden sm:block"
                            />
                        </div>
                    </FeatureCard>
                </div>
            </div>
        </section>
    )
}

interface FeatureCardProps {
    children: ReactNode
    className?: string
}

const FeatureCard = ({ children, className }: FeatureCardProps) => (
    <Card className={cn('group relative rounded-lg shadow-lg border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-300', className)}>
        <CardDecorator />
        {children}
    </Card>
)

const CardDecorator = () => (
    <>
        <span className="absolute -left-px -top-px block size-2 border-l-2 border-t-2 border-white/30"></span>
        <span className="absolute -right-px -top-px block size-2 border-r-2 border-t-2 border-white/30"></span>
        <span className="absolute -bottom-px -left-px block size-2 border-b-2 border-l-2 border-white/30"></span>
        <span className="absolute -bottom-px -right-px block size-2 border-b-2 border-r-2 border-white/30"></span>
    </>
)

interface CardHeadingProps {
    icon: LucideIcon
    title: string
    description: string
}

const CardHeading = ({ icon: Icon, title, description }: CardHeadingProps) => (
    <div className="p-6">
        <span className="flex items-center gap-2 text-white/70">
            <Icon className="size-4" />
            {title}
        </span>
        <p className="mt-4 text-lg font-semibold text-white">{description}</p>
    </div>
)

interface CircleConfig {
    pattern: 'none' | 'border' | 'primary' | 'success' | 'warning'
}

interface CircularUIProps {
    label: string
    circles: CircleConfig[]
    className?: string
}

const CircularUI = ({ label, circles, className }: CircularUIProps) => (
    <div className={className}>
        <div className="bg-gradient-to-b from-white/20 to-transparent size-fit rounded-2xl p-px">
            <div className="bg-gradient-to-b from-black/50 to-black/80 relative flex aspect-square w-fit items-center -space-x-4 rounded-[15px] p-4">
                {circles.map((circle, i) => (
                    <div
                        key={i}
                        className={cn('size-7 rounded-full border sm:size-8', {
                            'border-white/30': circle.pattern === 'none',
                            'border-white/30 bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.1),rgba(255,255,255,0.1)_1px,transparent_1px,transparent_4px)]': circle.pattern === 'border',
                            'border-blue-400 bg-[repeating-linear-gradient(-45deg,rgb(96,165,250),rgb(96,165,250)_1px,transparent_1px,transparent_4px)]': circle.pattern === 'primary',
                            'border-green-400 bg-[repeating-linear-gradient(-45deg,rgb(74,222,128),rgb(74,222,128)_1px,transparent_1px,transparent_4px)]': circle.pattern === 'success',
                            'border-yellow-400 bg-[repeating-linear-gradient(-45deg,rgb(250,204,21),rgb(250,204,21)_1px,transparent_1px,transparent_4px)]': circle.pattern === 'warning',
                        })}></div>
                ))}
            </div>
        </div>
        <span className="mt-1.5 block text-center text-sm text-white/60">{label}</span>
    </div>
)
