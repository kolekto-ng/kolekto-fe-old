import React from 'react';
import { useAuthStore } from '@/store';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const AuthStatus: React.FC = () => {
    const { user, isLoading, signOut } = useAuthStore();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/');
    };

    if (isLoading) {
        return <div className="text-center p-4">Loading...</div>;
    }

    if (!user) {
        return (
            <div className="text-center p-4 space-y-2">
                <p className="text-gray-600">Not signed in</p>
                <Button onClick={() => navigate('/login')} className="bg-kolekto">
                    Sign In
                </Button>
            </div>
        );
    }

    return (
        <div className="text-center p-4 space-y-2">
            <p className="text-green-600">Signed in as: {user.email}</p>
            <div className="space-x-2">
                <Button onClick={() => navigate('/dashboard')} className="bg-kolekto">
                    Go to Dashboard
                </Button>
                <Button onClick={handleSignOut} variant="outline">
                    Sign Out
                </Button>
            </div>
        </div>
    );
};

export default AuthStatus;
