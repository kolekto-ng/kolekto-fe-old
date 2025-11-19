import React, { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { X, Download, Smartphone } from 'lucide-react'
import { usePWAInstall } from '@/hooks/usePWAInstall'

interface PWAInstallPromptProps {
    variant?: 'banner' | 'button' | 'card'
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ variant = 'banner' }) => {
    const { isInstallable, isInstalled, promptInstall } = usePWAInstall()
    const [isDismissed, setIsDismissed] = useState(false)
    const [isInstalling, setIsInstalling] = useState(false)

    // Check if user has dismissed the prompt before
    useEffect(() => {
        const dismissed = localStorage.getItem('pwa-install-dismissed')
        if (dismissed === 'true') {
            setIsDismissed(true)
        }
    }, [])

    const handleInstall = async () => {
        setIsInstalling(true)
        const accepted = await promptInstall()
        setIsInstalling(false)

        if (accepted) {
            console.log('PWA installed successfully')
        } else {
            console.log('PWA installation cancelled')
        }
    }

    const handleDismiss = () => {
        setIsDismissed(true)
        localStorage.setItem('pwa-install-dismissed', 'true')
    }

    // Don't show if already installed, not installable, or dismissed
    if (isInstalled || !isInstallable || isDismissed) {
        return null
    }

    // Banner variant - Floating banner at bottom of page
    if (variant === 'banner') {
        return (
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-[#16a34a] to-[#15803d] text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="hidden sm:flex h-10 w-10 bg-white/20 rounded-lg items-center justify-center">
                            <Smartphone className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-sm sm:text-base">Install Kolekto App</p>
                            <p className="text-xs sm:text-sm text-white/90">
                                Access faster and work offline
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleInstall}
                            disabled={isInstalling}
                            size="sm"
                            className="bg-white text-[#16a34a] hover:bg-white/90 font-semibold"
                        >
                            <Download className="h-4 w-4 mr-1" />
                            {isInstalling ? 'Installing...' : 'Install'}
                        </Button>
                        <button
                            onClick={handleDismiss}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            aria-label="Dismiss"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Button variant - Simple install button
    if (variant === 'button') {
        return (
            <Button
                onClick={handleInstall}
                disabled={isInstalling}
                className="bg-[#16a34a] hover:bg-[#15803d] text-white"
            >
                <Download className="h-4 w-4 mr-2" />
                {isInstalling ? 'Installing...' : 'Install App'}
            </Button>
        )
    }

    // Card variant - Prominent card/section
    if (variant === 'card') {
        return (
            <div className="bg-gradient-to-br from-[#16a34a] to-[#15803d] text-white rounded-xl p-6 shadow-lg relative overflow-hidden">
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 p-2 hover:bg-white/10 rounded-lg transition-colors"
                    aria-label="Dismiss"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="flex items-start gap-4">
                    <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Smartphone className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold mb-2">Get the Kolekto App</h3>
                        <p className="text-white/90 mb-4">
                            Install our app for faster access, offline support, and a native app experience on your device.
                        </p>
                        <ul className="space-y-2 mb-4 text-sm text-white/90">
                            <li className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 bg-white/60 rounded-full" />
                                Works offline
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 bg-white/60 rounded-full" />
                                Faster loading
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 bg-white/60 rounded-full" />
                                Native app experience
                            </li>
                        </ul>
                        <Button
                            onClick={handleInstall}
                            disabled={isInstalling}
                            size="lg"
                            className="bg-white text-[#16a34a] hover:bg-white/90 font-semibold"
                        >
                            <Download className="h-5 w-5 mr-2" />
                            {isInstalling ? 'Installing...' : 'Install Now'}
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return null
}

export default PWAInstallPrompt

