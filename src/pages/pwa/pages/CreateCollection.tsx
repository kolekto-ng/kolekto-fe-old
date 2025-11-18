import React, { useState, useRef } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import CreateCollectionForm from "@/components/collections/CreateCollectionForm";
import ContributionPreview from "@/components/collections/ContributionPreview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PwaCreateCollection: React.FC = () => {
    const [collectionData, setCollectionData] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<string>("create");
    const tabsRef = useRef<HTMLDivElement | null>(null);

    const handlePreviewCollection = (data: any) => {
        setCollectionData(data);
        setActiveTab("preview");

        // scroll preview into view in the PWA layout
        if (tabsRef.current) {
            tabsRef.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    return (
        <div className="p-4 mb-24 md:mb-0">
            <div ref={tabsRef} className="mb-12">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="mb-4">
                        <TabsTrigger value="create">Create</TabsTrigger>
                        <TabsTrigger value="preview" disabled={!collectionData}>
                            Preview
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="create">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-medium">
                                    Create Collection
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CreateCollectionForm onPreview={handlePreviewCollection} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="preview">
                        {collectionData ? (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg font-medium">
                                        Contribution Preview
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ContributionPreview collectionData={collectionData} />
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="text-sm text-center text-neutral-500">
                                No preview available. Complete the form to see a preview.
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default PwaCreateCollection;