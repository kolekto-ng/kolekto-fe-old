import React, { useState } from 'react';
import { useFundraisingStore } from '@/store/useFundraisingStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const FundraisingGoals = () => {
    const navigate = useNavigate();
    const {
        minContribution, targetAmount, isOpenEnded, deadline,
        setField, nextStep, prevStep, reset
    } = useFundraisingStore();

    const handleNext = () => {
        // Validation
        if (!minContribution && !isOpenEnded) {
            // Is min contribution optional? Design says "0.00" placeholder.
            // Assuming user can leave it 0.
        }

        // Target amount logic
        if (!isOpenEnded && (!targetAmount || parseFloat(targetAmount) <= 0)) {
            toast.error('Please enter a target amount or specific Open-Ended.');
            return;
        }

        if (!deadline && !isOpenEnded) {
            // If not open ended, deadline might be required? 
            // The design shows a calendar so probably yes.
            // But "You can extend the deadline if needed" suggests it exists.
            // Let's enforce deadline unless open ended? Or just enforce it always as per design flow?
            // Design text: "Duration / Deadline".
            toast.error('Please select a deadline.');
            return;
        }

        nextStep();
    };

    const handleClose = () => {
        if (confirm("Exit campaign creation?")) {
            reset();
            navigate('/dashboard/collections');
        }
    }

    // Calendar Logic
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun

    const handleDateClick = (day: number) => {
        const selectedDate = new Date(currentYear, currentMonth, day);
        if (selectedDate < new Date().setHours(0, 0, 0, 0)) {
            toast.error("Cannot select past dates");
            return;
        }
        setField('deadline', selectedDate);
    };

    const nextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const prevMonth = () => {
        // Prevent going back past current month if it's the current month
        if (currentYear === today.getFullYear() && currentMonth === today.getMonth()) return;

        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const formatCurrency = (value: string) => {
        // Remove existing commas and non-digits
        const cleanValue = value.replace(/,/g, '').replace(/[^0-9.]/g, '');
        // Split integer and decimal parts
        const [intPart, decPart] = cleanValue.split('.');
        // Format integer part with commas
        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

        if (decPart !== undefined) {
            return `${formattedInt}.${decPart}`;
        }
        return formattedInt;
    };

    return (
        <div className="relative flex size-full min-h-screen md:min-h-[600px] flex-col justify-between overflow-x-hidden bg-background">
            <div className="p-6">
                {/* Header */}
                <header className="flex items-center justify-between pb-8">
                    <button onClick={handleClose} className="flex size-10 items-center justify-center rounded-full text-foreground hover:bg-secondary/10">
                        <X className="w-6 h-6" />
                    </button>
                    <h1 className="flex-1 text-center text-xl font-bold font-clash text-foreground">Fundraising goals</h1>
                    <div className="w-10"></div>
                </header>

                <main className="space-y-6">
                    {/* Min Contribution */}
                    <div>
                        <label className="text-base font-medium text-foreground" htmlFor="min-contribution">Minimum contribution amount</label>
                        <div className="relative mt-2">
                            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-muted-foreground">₦</span>
                            <input
                                id="min-contribution"
                                type="text"
                                placeholder="0.00"
                                value={minContribution}
                                onChange={(e) => setField('minContribution', formatCurrency(e.target.value))}
                                className="w-full rounded-xl border-border bg-background p-4 pl-8 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary focus:outline-none border"
                            />
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">This is the minimum amount each person can contribute to your collection.</p>
                    </div>

                    <hr className="border-border" />

                    {/* Target Amount & Open-ended */}
                    <div className="group">
                        {!isOpenEnded && (
                            <div className="target-amount-group mb-4">
                                <label className="text-base font-medium text-foreground" htmlFor="target-amount">Target amount</label>
                                <div className="relative mt-2">
                                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-muted-foreground">₦</span>
                                    <input
                                        id="target-amount"
                                        type="text"
                                        placeholder="0.00"
                                        value={targetAmount}
                                        onChange={(e) => setField('targetAmount', formatCurrency(e.target.value))}
                                        className="w-full rounded-xl border-border bg-background p-4 pl-8 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary focus:outline-none border"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <label className="text-base text-foreground" htmlFor="open-ended">Keep this open-ended (No target)</label>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    id="open-ended"
                                    type="checkbox"
                                    className="peer sr-only"
                                    checked={isOpenEnded}
                                    onChange={(e) => setField('isOpenEnded', e.target.checked)}
                                />
                                <div className="peer h-7 w-12 rounded-full bg-secondary/50 after:absolute after:start-[4px] after:top-[4px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20"></div>
                            </label>
                        </div>
                    </div>

                    <hr className="border-border" />

                    {/* Calendar */}
                    <div>
                        <h2 className="text-base font-medium text-foreground">Duration / Deadline</h2>
                        <div className="mt-4 rounded-xl bg-card p-4 shadow-sm border border-border">
                            <div className="flex items-center justify-between mb-4">
                                <button onClick={prevMonth} className="flex size-8 items-center justify-center rounded-full text-foreground hover:bg-secondary/10">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <p className="text-base font-semibold text-foreground">{monthNames[currentMonth]} {currentYear}</p>
                                <button onClick={nextMonth} className="flex size-8 items-center justify-center rounded-full text-foreground hover:bg-secondary/10">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-7 text-center mb-2">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                                    <p key={d} className="text-xs font-bold text-muted-foreground">{d}</p>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 gap-y-1 text-center">
                                {/* Empty cells for start of month */}
                                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                                    <div key={`empty-${i}`}></div>
                                ))}

                                {/* Days */}
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1;
                                    const date = new Date(currentYear, currentMonth, day);
                                    const isSelected = deadline &&
                                        date.getDate() === deadline.getDate() &&
                                        date.getMonth() === deadline.getMonth() &&
                                        date.getFullYear() === deadline.getFullYear();
                                    const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                                    const isPast = date < new Date().setHours(0, 0, 0, 0);

                                    return (
                                        <button
                                            key={day}
                                            onClick={() => handleDateClick(day)}
                                            disabled={isPast}
                                            className={`
                                flex h-10 w-full items-center justify-center rounded-full text-sm font-medium transition-colors
                                ${isSelected ? 'bg-primary text-white font-semibold' : ''}
                                ${!isSelected && !isPast ? 'text-foreground hover:bg-secondary/20' : ''}
                                ${isPast ? 'text-muted-foreground cursor-not-allowed opacity-50' : ''}
                                ${isToday && !isSelected ? 'border border-primary text-primary' : ''}
                            `}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">You can extend the deadline if needed.</p>
                    </div>
                </main>
            </div>

            <footer className="bg-white p-6 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] border-t border-border flex gap-4">
                <button
                    onClick={prevStep}
                    className="flex-1 rounded-xl bg-secondary/10 py-4 text-center text-base font-bold text-foreground transition-colors hover:bg-secondary/20"
                >
                    Back
                </button>
                <button
                    onClick={handleNext}
                    className="flex-[2] rounded-xl bg-primary py-4 text-center text-base font-bold text-white transition-colors hover:bg-primary/90 active:bg-primary/95"
                >
                    Next
                </button>
            </footer>
        </div>
    );
};

export default FundraisingGoals;
