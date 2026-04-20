import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectTo?: string;
}

const CollectionPublishAuthPrompt: React.FC<Props> = ({
  open,
  onOpenChange,
  redirectTo = '/create-collection',
}) => {
  const navigate = useNavigate();

  const goToAuth = (path: '/login' | '/register') => {
    const params = new URLSearchParams({
      redirect: redirectTo,
      publish: '1',
    });

    navigate(`${path}?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-0 rounded-2xl p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#1C5C23] via-[#25762D] to-[#103815] px-6 py-6 text-white">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-2xl font-semibold text-white">
              Sign in to publish
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-white/80">
              Your collection draft is saved. Sign in or create an account to publish it without losing any of your progress.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-6">
          <Button
            type="button"
            onClick={() => goToAuth('/login')}
            className="h-12 w-full rounded-xl bg-[#1C5C23] text-white hover:bg-[#174A1C]"
          >
            Sign In
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => goToAuth('/register')}
            className="h-12 w-full rounded-xl border-[#1C5C23]/20 text-[#1C5C23] hover:bg-[#1C5C23]/5"
          >
            Create Account
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-11 w-full rounded-xl text-gray-600 hover:bg-gray-100"
          >
            Continue Editing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CollectionPublishAuthPrompt;
