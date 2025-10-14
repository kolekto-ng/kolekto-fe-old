import React from 'react'
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store';
import { Bell, Search, ChevronDown, Users } from 'lucide-react';

const DashboardNavbar: React.FC = () =>{

    const user = useAuthStore((state) => state.user);




  return (
    <div className='space-y-6 mt-3'>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Account overview</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for a collection"
              className="pl-10 pr-4 bg-[#D9D9D9] placeholder:font-semibold"
            />
            </div>

            <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
          </Button>

          {/* Account Dropdown */}
          <Button variant="outline" className="flex items-center gap-2">
            <Users />
            <span className="text-sm">{user?.name || 'User'}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

    </div>
    </div>
  )
};

export default DashboardNavbar
