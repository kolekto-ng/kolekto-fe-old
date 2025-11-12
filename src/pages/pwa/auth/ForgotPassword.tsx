import React from 'react'
import ForgotPasswordForm from '../../../components/auth/ForgotPasswordForm'

const PwaForgotPassword: React.FC = () => {
    return (
        <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold mt-2">Reset your password</h1>
                    <p className="text-gray-600 mt-1">Receive a reset link by email</p>
                </div>
                <div className="bg-white shadow-sm rounded-xl p-6 border">
                    <ForgotPasswordForm />
                </div>
            </div>
        </div>
    )
}

export default PwaForgotPassword


