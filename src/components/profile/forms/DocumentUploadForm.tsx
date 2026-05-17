import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, CheckCircle, X, Loader2, Camera, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { axiosInstance } from '@/utils/axios';

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
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Persistent inline error message so the user can read what went wrong
  // even after the toast disappears. Cleared whenever they pick new files
  // or hit Upload again.
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Camera state
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Determine total steps based on type
  const totalSteps = type === 'identity' ? 4 : 3;

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Start camera stream
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast({
        title: "Camera Error",
        description: "Could not access your camera. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (open) {
      setStep(1);
      setDocumentType('');
      setUploadedFiles([]);
      setSelfieFile(null);
      setCapturedImage(null);
      setUploadProgress(0);
      setIsUploading(false);
    }
  }, [open, type]);

  useEffect(() => {
    // Start camera only on step 2 for identity verification
    if (open && type === 'identity' && step === 2 && !capturedImage && !stream) {
      startCamera();
    }
    return () => {
      if (!open || step !== 2) {
        stopCamera();
      }
    };
  }, [open, type, step, capturedImage, stream, stopCamera]);

  // Capture image
  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg');
        setCapturedImage(imageData);
        
        // Convert to File object
        fetch(imageData)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
            setSelfieFile(file);
          });
          
        stopCamera();
      }
    }
  };

  const retakeImage = () => {
    setCapturedImage(null);
    setSelfieFile(null);
    startCamera();
  };

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
        description: "Please upload the required documents.",
        variant: "destructive"
      });
      return;
    }

    if (type === 'identity' && !selfieFile) {
      toast({
        title: "Missing Selfie",
        description: "Please capture a selfie.",
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
      formData.append("documentType", type); // "identity" or "address"
      formData.append("verificationType", documentType);
      
      // Append selfie if identity
      if (type === 'identity' && selfieFile) {
        formData.append("files", selfieFile);
      }
      
      // Append ID/address files
      uploadedFiles.forEach(file => {
        formData.append("files", file);
      });

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
          setStep(totalSteps); // Jump to success step
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

  const progress = (step / totalSteps) * 100;

  // Determine current step rendering
  const renderStep = () => {
    if (step === 1) {
      return (
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
      );
    }

    if (type === 'identity' && step === 2) {
      return (
        <div>
          <h3 className="text-lg font-medium mb-3">Capture Selfie</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Please look directly at the camera and ensure your face is clearly visible.
          </p>
          <div className="space-y-4">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-gray-200">
              {!capturedImage ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="w-48 h-48 border-2 border-dashed border-white/50 rounded-full" />
                  </div>
                </>
              ) : (
                <img
                  src={capturedImage}
                  alt="Captured selfie"
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {!capturedImage ? (
              <Button
                onClick={captureImage}
                className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
              >
                <Camera className="w-4 h-4 mr-2" /> Capture Selfie
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={retakeImage}
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Retake
                </Button>
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button disabled={!capturedImage} onClick={() => setStep(3)}>Next</Button>
          </div>
        </div>
      );
    }

    const uploadStepNum = type === 'identity' ? 3 : 2;

    if (step === uploadStepNum) {
      return (
        <div>
          <h3 className="text-lg font-medium mb-3">
            {type === 'identity' ? 'Upload Identity Document' : 'Upload Documents'}
          </h3>
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
            <Button variant="outline" onClick={() => setStep(type === 'identity' ? 2 : 1)}>Back</Button>
            <Button
              disabled={uploadedFiles.length === 0 || isUploading}
              onClick={handleUpload}
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
            </Button>
          </div>
        </div>
      );
    }

    if (step === totalSteps) {
      return (
        <div className="text-center py-6">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Upload Complete</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Your documents have been uploaded successfully and are pending verification.
          </p>
          <Button onClick={handleComplete}>Finish</Button>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {type === 'identity' ? 'Identity Verification' : 'Address Verification'}
          </DialogTitle>
        </DialogHeader>

        <Progress value={progress} className="w-full mb-4" />

        {renderStep()}

      </DialogContent>
    </Dialog>
  );
};
