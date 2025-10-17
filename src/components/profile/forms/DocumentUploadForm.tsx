import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, CheckCircle, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@supabase/supabase-js';
import { axiosInstance } from '@/utils/axios';

// ✅ Supabase client (make sure env variables are set)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

interface DocumentUploadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  type: 'identity' | 'address';
  userId: string; // Link docs to user
}

export const DocumentUploadForm: React.FC<DocumentUploadFormProps> = ({
  open,
  onOpenChange,
  onSuccess,
  type,
  userId
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [documentType, setDocumentType] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Document options
  const documentOptions = type === 'identity'
    ? [
      { value: 'national_id', label: 'National ID Card' },
      { value: 'international_passport', label: 'International Passport' },
      { value: 'drivers_license', label: 'Driver\'s License' },
      { value: 'voters_card', label: 'Voter\'s Card' }
    ]
    : [
      { value: 'utility_bill', label: 'Utility Bill (NEPA, Water, etc.)' },
      { value: 'bank_statement', label: 'Bank Statement' },
      { value: 'tenancy_agreement', label: 'Tenancy Agreement' },
      { value: 'government_letter', label: 'Government Issued Letter' }
    ];

  // File selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  }, []);

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload handler
  const handleUpload = async () => {
    if (!documentType || uploadedFiles.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select document type and upload files.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Prepare form data for upload
      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("documentType", type); // e.g. "identity"
      formData.append("verificationType", documentType); // e.g. "NIN"
      uploadedFiles.forEach(file => {
        formData.append("files", file); // 'files' matches multer config
      });

      // API implementation only
      const res = await axiosInstance.post("/settings/kyc/upload-document", formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        }
      });

      const result = await res.data;
      if (result.success) {
        setUploadProgress(100);

        setTimeout(() => {
          setIsUploading(false);
          setStep(3);
        }, 500);
      }
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Upload Failed",
        description: error.message || "Something went wrong",
        variant: "destructive"
      });
      setIsUploading(false);
    }

    // Supabase implementation commented out
    /*
    try {
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const filePath = `${userId}/${Date.now()}-${file.name}`;

        // Upload to Supabase Storage
        const { error: storageError } = await supabase.storage
          .from('kyc-documents')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (storageError) throw storageError;

        // Save metadata to Supabase Database
        const { error: dbError } = await supabase
          .from('kyc_documents')
          .insert({
            user_id: userId,
            document_type: type,        // "identity" or "address"
            file_type: documentType,    // e.g. "national_id"
            file_path: filePath,        // store path, not public URL
            status: 'pending'
          });

        if (dbError) throw dbError;

        setUploadProgress(Math.round(((i + 1) / uploadedFiles.length) * 100));
      }

      setTimeout(() => {
        setIsUploading(false);
        setStep(3);
      }, 500);
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Upload Failed",
        description: error.message || "Something went wrong",
        variant: "destructive"
      });
      setIsUploading(false);
    }
    */
  };

  // Final success handler
  const handleComplete = () => {
    onSuccess();
    onOpenChange(false);
    toast({
      title: "Documents Uploaded Successfully",
      description: "Your documents are under review. You'll be notified within 24 hours.",
    });
  };

  const progress = (step / 3) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Upload {type === 'identity' ? 'Identity' : 'Address'} Documents
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <Progress value={progress} className="w-full mb-4" />

        {/* Step 1 - Select document type */}
        {step === 1 && (
          <div>
            <h3 className="text-lg font-medium mb-3">Select Document Type</h3>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a document type" />
              </SelectTrigger>
              <SelectContent>
                {documentOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-6 flex justify-end">
              <Button disabled={!documentType} onClick={() => setStep(2)}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 - Upload files */}
        {step === 2 && (
          <div>
            <h3 className="text-lg font-medium mb-3">Upload Documents</h3>
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-muted/50"
            >
              <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Click or drag files to upload</span>
            </label>

            {/* File preview list */}
            <div className="mt-4 space-y-2">
              {uploadedFiles.map((file, index) => (
                <Card key={index}>
                  <CardContent className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">{file.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {isUploading && (
              <div className="mt-4">
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-xs text-muted-foreground mt-1">
                  Uploading {uploadProgress}%
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button
                disabled={uploadedFiles.length === 0 || isUploading}
                onClick={handleUpload}
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 - Success */}
        {step === 3 && (
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Upload Complete</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your documents have been uploaded successfully and are pending verification.
            </p>
            <Button onClick={handleComplete}>Finish</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
