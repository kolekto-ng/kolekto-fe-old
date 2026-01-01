import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target, Trophy, Clock, Users, Ban } from 'lucide-react';

interface FundraisingOverviewProps {
    campaign: any;
    donations: any[];
}

const FundraisingOverview: React.FC<FundraisingOverviewProps> = ({ campaign, donations }) => {
    // Calculate metrics
    const totalRaised = donations.reduce((sum, d) => sum + (d.amount || 0), 0);
    const goalAmount = campaign.target_amount || campaign.amount || 0;
    const percentRaised = goalAmount > 0 ? Math.min((totalRaised / goalAmount) * 100, 100) : 0;
    const remaining = Math.max(goalAmount - totalRaised, 0);
    const donorCount = donations.length;

    const isActive = campaign.status === 'active';
    const isCompleted = campaign.status === 'completed';
    const isPaused = campaign.status === 'paused';

    // Deadline calculation
    const deadlineDate = campaign.deadline ? new Date(campaign.deadline) : null;
    const now = new Date();
    const daysLeft = deadlineDate
        ? Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

    return (
        <div className="space-y-6">
            {/* Main Progress Card */}
            <Card className="border-kolekto/20 overflow-hidden">
                <div className="h-2 bg-gray-100 w-full">
                    <div
                        className="h-full bg-kolekto transition-all duration-1000 ease-out"
                        style={{ width: `${percentRaised}%` }}
                    />
                </div>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                        <div>
                            <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Total Raised</p>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-4xl font-bold text-gray-900">₦{totalRaised.toLocaleString()}</h2>
                                {goalAmount > 0 && (
                                    <span className="text-gray-500">of ₦{goalAmount.toLocaleString()} goal</span>
                                )}
                            </div>
                        </div>
                        {goalAmount > 0 && (
                            <div className="text-right">
                                <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Progress</p>
                                <div className="text-2xl font-bold text-kolekto">{percentRaised.toFixed(1)}%</div>
                            </div>
                        )}
                    </div>

                    {goalAmount > 0 && (
                        <p className="text-sm text-gray-600">
                            <span className="font-medium text-gray-900">₦{remaining.toLocaleString()}</span> needed to reach your goal
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Donors</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{donorCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Unique contributions
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Time Remaining</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {daysLeft !== null
                                ? (daysLeft > 0 ? `${daysLeft} Days` : 'Ended')
                                : 'No Deadline'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {deadlineDate ? deadlineDate.toLocaleDateString() : 'Ongoing campaign'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Status</CardTitle>
                        {isActive && <Target className="h-4 w-4 text-green-600" />}
                        {isCompleted && <Trophy className="h-4 w-4 text-blue-600" />}
                        {isPaused && <Ban className="h-4 w-4 text-yellow-600" />}
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold capitalize ${isActive ? 'text-green-600' :
                            isCompleted ? 'text-blue-600' :
                                isPaused ? 'text-yellow-600' : 'text-gray-600'
                            }`}>
                            {campaign.status}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Current campaign state
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default FundraisingOverview;
