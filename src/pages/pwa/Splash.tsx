import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'

const Splash: React.FC = () => {
    const navigate = useNavigate()
    const { user, isLoading } = useAuthStore() as any

    useEffect(() => {
        // Wait for auth check to complete
        if (isLoading) return

        const timer = setTimeout(() => {
            // Redirect based on auth state
            if (user) {
                navigate('/dashboard', { replace: true })
            } else {
                navigate('/login', { replace: true })
            }
        }, 1200)

        return () => clearTimeout(timer)
    }, [navigate, user, isLoading])

    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-4">
                <div className="h-20 w-20 rounded-2xl bg-[#16a34a]/10 grid place-items-center">
                    <div className="h-12 w-12 rounded-xl bg-[#16a34a]" />
                </div>
                <div className="text-center">
                    <p className="text-2xl font-bold text-[#16a34a]">Kolekto</p>
                    <p className="text-sm text-gray-500 mt-1">Smart Group Payment</p>
                </div>
                <div className="h-6 w-6 rounded-full border-2 border-[#16a34a] border-t-transparent animate-spin mt-4" />
            </div>
        </div>
    )
}

export default Splash


