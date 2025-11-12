import React from 'react'
import ResetPasswordForm from '../../../components/auth/ResetPasswordForm'

const PwaResetPassword: React.FC = () => {
    return (
        <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold mt-2">Set new password</h1>
                    <p className="text-gray-600 mt-1">Create a secure new password</p>
                </div>
                <div className="bg-white shadow-sm rounded-xl p-6 border">
                    <ResetPasswordForm />
                </div>
            </div>
        </div>
    )
}

export default PwaResetPassword


