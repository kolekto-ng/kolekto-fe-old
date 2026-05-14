import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, CheckCircle, X, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@supabase/supabase-js';
import { axiosInstance } from '@/utils/axios';

// ✅ Supabase client (make sure env variables are set)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

// ─── Client-side validation constants ──────────────────────────────────────
// Mirror the backend limits from routes/settings/kyc.js exactly so the user
// sees the error BEFORE the upload starts instead of after a slow round-trip.
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_FILE_SIZE_LABEL = "5 MB";
const MAX_FILES_PER_UPLOAD = 5;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const ALLOWED_MIME_LABEL = "JPEG, PNG, WEBP, or PDF";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): { ok: boolean; reason?: string } {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      ok: false,
      reason: `"${file.name}" is not a supported file type. Use ${ALLOWED_MIME_LABEL}.`,
    };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      reason: `"${file.name}" is ${formatBytes(file.size)} — files must be ${MAX_FILE_SIZE_LABEL} or smaller.`,
    };
  }
  return { ok: true };
}

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
  // Persistent inline error message so the user can read what went wrong
  // even after the toast disappears. Cleared whenever they pick new files
  // or hit Upload again.
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  // File selection: validate each picked file IMMEDIATELY so the user sees
  // "this file is too big" before they kick off a long upload that the
  // server would just reject anyway.
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;

    const rejected: string[] = [];
    const accepted: File[] = [];
    for (const f of picked) {
      const v = validateFile(f);
      if (v.ok) accepted.push(f);
      else if (v.reason) rejected.push(v.reason);
    }

    setUploadedFiles((prev) => {
      const combined = [...prev, ...accepted];
      // Enforce the 5-file cap so the user knows BEFORE submitting.
      if (combined.length > MAX_FILES_PER_UPLOAD) {
        rejected.push(
          `Maximum ${MAX_FILES_PER_UPLOAD} files per upload — the rest were skipped.`
        );
        return combined.slice(0, MAX_FILES_PER_UPLOAD);
      }
      return combined;
    });

    if (rejected.length > 0) {
      const message = rejected.join(" ");
      setUploadError(message);
      toast({
        title: "Some files were rejected",
        description: message,
        variant: "destructive",
      });
    } else {
      setUploadError(null);
    }

    // Reset the input so the same file can be re-picked after removal.
    if (e.target) e.target.value = "";
  }, [toast]);

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadError(null);
  };

  // Upload handler
  const handleUpload = async () => {
    setUploadError(null);

    if (!documentType || uploadedFiles.length === 0) {
      const msg = "Please select a document type and add at least one file.";
      setUploadError(msg);
      toast({
        title: "Missing Information",
        description: msg,
        variant: "destructive"
      });
      return;
    }

    // Defence-in-depth: re-validate every file right before the request,
    // in case state was somehow corrupted.
    for (const f of uploadedFiles) {
      const v = validateFile(f);
      if (!v.ok && v.reason) {
        setUploadError(v.reason);
        toast({
          title: "File rejected",
          description: v.reason,
          variant: "destructive",
        });
        return;
      }
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
      console.error("KYC upload error:", error);

      // Translate backend error codes into clear, actionable messages.
      // Backend (routes/settings/kyc.js) returns:
      //   413 + code: "FILE_TOO_LARGE"
      //   415 + code: "UNSUPPORTED_MIME"
      //   400 + code: "TOO_MANY_FILES"
      const status = error?.response?.status;
      const code = error?.response?.data?.code;
      const backendMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message;

      let userMessage = backendMessage || "Upload failed. Please try again.";
      if (code === "FILE_TOO_LARGE" || status === 413) {
        userMessage = `Each file must be ${MAX_FILE_SIZE_LABEL} or smaller. Please choose a smaller file or compress the image.`;
      } else if (code === "UNSUPPORTED_MIME" || status === 415) {
        userMessage = `That file type is not allowed. Use ${ALLOWED_MIME_LABEL}.`;
      } else if (code === "TOO_MANY_FILES") {
        userMessage = `You can upload at most ${MAX_FILES_PER_UPLOAD} files per request.`;
      } else if (!status) {
        userMessage =
          "We could not reach the server. Check your internet connection and try again.";
      }

      setUploadError(userMessage);
      toast({
        title: "Upload Failed",
        description: userMessage,
        variant: "destructive",
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
            <h3 className="text-lg font-medium mb-1">Upload Documents</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Up to {MAX_FILES_PER_UPLOAD} files, {MAX_FILE_SIZE_LABEL} max each.
              Accepted: {ALLOWED_MIME_LABEL}.
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
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

            {/* Persistent inline error — does not disappear like a toast. */}
            {uploadError && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-600" />
                <p className="text-sm text-red-700 leading-snug">{uploadError}</p>
              </div>
            )}

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
