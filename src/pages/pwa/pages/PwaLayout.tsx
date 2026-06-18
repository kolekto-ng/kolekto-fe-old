import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store';
import { DashboardHomeSkeleton } from '@/components/ui/page-skeletons';

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
        return <DashboardHomeSkeleton />;
    }

    if (!user) {
        return null;
    }

    return <>{children}</>;
};

export default PwaLayout;
