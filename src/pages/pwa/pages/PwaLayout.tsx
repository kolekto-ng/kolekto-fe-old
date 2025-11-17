import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store';
import { Loader2 } from 'lucide-react';

interface PwaLayoutProps {
    children: React.ReactNode;
}

const PwaLayout: React.FC<PwaLayoutProps> = ({ children }) => {
    const navigate = useNavigate();
    const { user, isLoading: authLoading } = useAuthStore();

    useEffect(() => {
        // Redirect to login if not authenticated
        if (!authLoading && !user) {
            navigate('/login', { replace: true });
        }
    }, [user, authLoading, navigate]);

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return <>{children}</>;
};

export default PwaLayout;