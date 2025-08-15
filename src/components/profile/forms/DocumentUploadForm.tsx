import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, Camera, CheckCircle, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentUploadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  type: 'identity' | 'address';
}

export const DocumentUploadForm: React.FC<DocumentUploadFormProps> = ({
  open,
  onOpenChange,
  onSuccess,
  type
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [documentType, setDocumentType] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  }, []);

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

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

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsUploading(false);
            setStep(3);
          }, 500);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

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
        
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{step}/3</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Document Type</label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-medium">Upload Documents</label>
                
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports JPG, PNG, PDF (Max 5MB each)
                    </p>
                  </label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Selected Files</label>
                    {uploadedFiles.map((file, index) => (
                      <Card key={index}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{file.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({(file.size / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Document Requirements</h4>
                <ul className="text-sm text-blue-600 space-y-1">
                  <li>• Document must be clear and readable</li>
                  <li>• All four corners must be visible</li>
                  <li>• Document must be valid and not expired</li>
                  <li>• {type === 'address' ? 'Document must be dated within the last 3 months' : 'Photo must match your profile picture'}</li>
                </ul>
              </div>

              <Button 
                onClick={() => setStep(2)} 
                className="w-full"
                disabled={!documentType || uploadedFiles.length === 0}
              >
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-4">
                <h3 className="font-medium">Review Your Upload</h3>
                
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm"><strong>Document Type:</strong> {documentOptions.find(opt => opt.value === documentType)?.label}</p>
                  <p className="text-sm mt-1"><strong>Files:</strong> {uploadedFiles.length} file(s)</p>
                </div>

                {uploadedFiles.map((file, index) => (
                  <Card key={index}>
                    <CardContent className="p-3">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{file.name}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleUpload} className="flex-1" disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload Documents'
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-600" />
              </div>
              
              <div>
                <h3 className="font-medium text-lg">Upload Successful!</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Your documents have been uploaded successfully. Our verification team will review them within 24 hours.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-700">
                  <strong>What's next?</strong><br />
                  You'll receive an email notification once verification is complete. 
                  You can track the status in your profile.
                </p>
              </div>

              <Button onClick={handleComplete} className="w-full">
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};