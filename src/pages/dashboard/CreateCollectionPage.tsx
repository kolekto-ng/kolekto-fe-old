
import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CreateCollectionForm from '@/components/collections/CreateCollectionForm';
import ContributionPreview from '@/components/collections/ContributionPreview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';

const CreateCollectionPage: React.FC = () => {
  const [collectionData, setCollectionData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("create");
  const tabsRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  const handlePreviewCollection = (data: any) => {
    setCollectionData(data);
    setActiveTab("preview");
    
    // Scroll to top when switching tabs
    if (tabsRef.current) {
      tabsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Create a New Collection</h1>
      
      <div ref={tabsRef}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="create">Create Collection</TabsTrigger>
            <TabsTrigger value="preview" disabled={!collectionData}>
              Preview Contribution
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="create">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">Collection Details</CardTitle>
              </CardHeader>
              <CardContent>
                <CreateCollectionForm onPreview={handlePreviewCollection} />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="preview">
            {collectionData && (
              <ContributionPreview collectionData={collectionData} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CreateCollectionPage;
