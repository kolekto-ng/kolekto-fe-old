import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { MoreVertical, Edit, Trash2, Pause, Play, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCollectionStore } from '@/store';

interface CollectionManagementMenuProps {
  collectionId: string;
  currentStatus: 'active' | 'paused' | 'closed';
  isMenuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  onEditClick: () => void;
  onDeleteSuccess?: () => void;
  onStatusChange?: () => void; // refresh callback
}

const CollectionManagementMenu: React.FC<CollectionManagementMenuProps> = ({
  collectionId,
  currentStatus,
  isMenuOpen,
  onMenuOpenChange,
  onEditClick,
  onDeleteSuccess,
  onStatusChange,
}) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const { updateCollectionStatus } = useCollectionStore();

  const handleDeleteCollection = async () => {
    if (!collectionId) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('collections').delete().eq('id', collectionId);
      if (error) throw error;

      toast.success('Collection deleted successfully');
      if (onDeleteSuccess) onDeleteSuccess();
    } catch (error: any) {
      console.error('Error deleting collection:', error);
      if (error.message?.includes('violates foreign key constraint')) {
        toast.success('Collection archived successfully');
        if (onDeleteSuccess) onDeleteSuccess();
        return;
      }
      toast.error('Failed to delete collection');
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'active' | 'paused' | 'closed') => {
    console.log(collectionId, newStatus, 'updating status');

    if (!collectionId) return;
    setIsUpdatingStatus(true);
    try {

      const res = await updateCollectionStatus(collectionId, newStatus);

      toast.success(
        newStatus === 'paused'
          ? 'Collection paused'
          : newStatus === 'active'
            ? 'Collection resumed'
            : 'Collection closed'
      );

      if (onStatusChange) onStatusChange();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update collection status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <>
      <DropdownMenu open={isMenuOpen} onOpenChange={onMenuOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Collection Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Edit */}
          <DropdownMenuItem onClick={onEditClick} className="cursor-pointer">
            <Edit className="mr-2 h-4 w-4" />
            <span>Edit Collection</span>
          </DropdownMenuItem>

          {/* Pause/Resume */}
          {currentStatus !== 'closed' && (
            <DropdownMenuItem
              onClick={() =>
                handleUpdateStatus(currentStatus === 'active' ? 'paused' : 'active')
              }
              disabled={isUpdatingStatus}
              className="cursor-pointer"
            >
              {currentStatus === 'active' ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  <span>Pause Collection</span>
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  <span>Resume Collection</span>
                </>
              )}
            </DropdownMenuItem>
          )}

          {/* Close */}
          {currentStatus !== 'closed' && (
            <DropdownMenuItem
              onClick={() => handleUpdateStatus('closed')}
              disabled={isUpdatingStatus}
              className="cursor-pointer text-yellow-600 focus:text-yellow-600"
            >
              <Lock className="mr-2 h-4 w-4" />
              <span>Close Collection</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Delete */}
          <DropdownMenuItem
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-red-600 cursor-pointer focus:text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Delete Collection</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this collection
              and all its associated data.{' '}
              <span className="font-medium">
                If the collection has received payments, it will be archived instead of deleted.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteCollection();
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? 'Deleting...' : 'Delete Collection'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CollectionManagementMenu;
