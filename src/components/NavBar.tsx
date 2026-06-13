import React from "react";
import { Link } from "react-router-dom";
import Logo from "./Logo";
import { Button } from "@/components/ui/button";

import { LogIn, LogOut, LayoutDashboard, User, PlusCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuthStore } from "@/store";

const NavBar: React.FC = () => {
  let { user, isLoading, signOut } = useAuthStore();
  const isAuthenticated = !!user;

  const handleSignOut = async () => {
    await signOut();
  };

  const MobileNav = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <LayoutDashboard className="h-5 w-5" />
          <span className="sr-only">Open dashboard menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[250px] sm:w-[300px]">
        <div className="flex flex-col gap-4 py-4">
          <Link to="/" className="flex items-center">
            <Logo size="md" />
          </Link>
          <div className="flex flex-col gap-2 mt-4">
            {isAuthenticated ? (
              <>
                <Link to="/create-collection">
                  <Button className="w-full justify-start bg-green-900 text-white hover:bg-green-800">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Collection
                  </Button>
                </Link>
                <Link to="/dashboard">
                  <Button variant="ghost" className="w-full justify-start">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
                <Link to="/dashboard/profile">
                  <Button variant="ghost" className="w-full justify-start">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Button>
                </Link>
                <Button variant="outline" onClick={handleSignOut} className="w-full justify-start">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/create-collection">
                  <Button className="w-full justify-start bg-green-900 text-white hover:bg-green-800">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Collection
                  </Button>
                </Link>

                {/* Kolekto on Campus entry point temporarily disabled */}
                {/* <Link
                  to='/kolekto-campus'
                  className='bg-green-900 text-white w-full max-w-s text-center px-4 py-3 rounded-md text-base font-medium hover:bg-green-700 transition-colors duration-200'

                >
                  Kolekto Campus
                </Link> */}
                <Link to="/login">
                  <Button variant="ghost" className="w-full justify-start">
                    <LogIn className="mr-2 h-4 w-4" />
                    Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="default" className="w-full justify-start bg-kolekto hover:bg-kolekto/90">Sign Up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <nav className="border-b py-3 bg-white">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <Link to="/" className="flex items-center">
          <Logo size="md" />
        </Link>
        <div>
          {/* Kolekto on Campus entry point temporarily disabled */}
          {/* <Link
            to='/kolekto-campus'
            className='bg-green-900 inline md:hidden text-white w-full max-w-fit text-center px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors duration-200'
          >
            <BookOpen className="mr-2 h-4 w-4 inline" />

            Kolekto On campus
          </Link> */}
          <MobileNav />
        </div>

        <div className="hidden md:flex items-center gap-4">
          {isLoading ? (
            <div className="h-10 w-20 bg-gray-100 animate-pulse rounded-md"></div>
          ) : isAuthenticated ? (
            <>
              <Link to="/create-collection">
                <Button className="bg-green-900 text-white hover:bg-green-800">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create Collection
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="ghost">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link to="/dashboard/profile">
                <Button variant="ghost">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Button>
              </Link>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/create-collection">
                <Button className="bg-green-900 text-white hover:bg-green-800 transition-colors duration-200">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create Collection
                </Button>
              </Link>
              {/* Kolekto on Campus entry point temporarily disabled */}
              {/* <Link to="/kolekto-campus">
                <Button className="bg-green-900 text-white hover:bg-green-700 transition-colors duration-200 ">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Kolekto On Campus
                </Button>
              </Link> */}

              <Link to="/login">
                <Button variant="ghost">
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button
                  variant="default"
                  className="bg-kolekto hover:bg-kolekto/90"
                >
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
