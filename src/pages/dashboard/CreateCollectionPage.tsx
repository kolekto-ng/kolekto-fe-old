import React from 'react';
import CreateCollectionWizard from '@/components/collections/wizard/CreateCollectionWizard';

const CreateCollectionPage: React.FC = () => {
  return (
    <div className="px-2 py-6 sm:px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Create a Collection</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Set up your collection in a few simple steps
        </p>
      </div>
      <CreateCollectionWizard cancelPath="/dashboard/collections" redirectToAuthPath="/create-collection" />
    </div>
  );
};

export default CreateCollectionPage;
