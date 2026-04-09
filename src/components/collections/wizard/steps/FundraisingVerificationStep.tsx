import React, { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, X, Plus, Trash2, ShieldCheck } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WizardData, SocialLink } from '../wizardTypes';

export interface VerificationFile {
  name: string;
  dataUrl: string;
}

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
  verificationDocs: string[];
  verificationFiles?: VerificationFile[];
  onDocsChange: (docs: string[]) => void;
  onFilesChange?: (files: VerificationFile[]) => void;
}

const CATEGORIES = [
  'Education',
  'Healthcare',
  'Humanitarian Relief',
  'Community Development',
  'Environment',
  'Arts & Culture',
  'Sports',
  'Religion',
  'Memorial',
  'Personal Emergency',
  'Other',
];

const SOCIAL_PLATFORMS = ['Twitter / X', 'Instagram', 'Facebook', 'LinkedIn', 'YouTube', 'TikTok', 'Website'];

const COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United States', 'United Kingdom', 'Other'];

const FundraisingVerificationStep: React.FC<Props> = ({
  data,
  onChange,
  verificationDocs,
  verificationFiles = [],
  onDocsChange,
  onFilesChange,
}) => {
  const docRef = useRef<HTMLInputElement>(null);

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    const newDocs = [...verificationDocs];
    const newFiles: VerificationFile[] = [...verificationFiles];

    fileList.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        newDocs.push(dataUrl);
        newFiles.push({ name: file.name, dataUrl });
        onDocsChange([...newDocs]);
        if (onFilesChange) onFilesChange([...newFiles]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeDoc = (i: number) => {
    onDocsChange(verificationDocs.filter((_, idx) => idx !== i));
    if (onFilesChange) {
      onFilesChange(verificationFiles.filter((_, idx) => idx !== i));
    }
  };

  const updateSocialLink = (i: number, key: keyof SocialLink, val: string) => {
    const updated = data.social_links.map((link, idx) =>
      idx === i ? { ...link, [key]: val } : link
    );
    onChange({ social_links: updated });
  };

  const addSocialLink = () =>
    onChange({ social_links: [...data.social_links, { platform: 'Website', url: '' }] });

  const removeSocialLink = (i: number) =>
    onChange({ social_links: data.social_links.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Verification & Details</h2>
        <p className="text-gray-500 text-sm">
          Help us verify your campaign — this ensures donor trust and platform safety
        </p>
      </div>

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <ShieldCheck className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">Pending Review</p>
          <p className="text-xs mt-0.5 text-amber-700">
            Your campaign will be reviewed by the Kolekto team before going live. Typical review time
            is 24–48 hours. You'll be notified via email.
          </p>
        </div>
      </div>

      {/* Verification documents */}
      <div className="space-y-3">
        <Label>
          Verification Documents <span className="text-red-500">*</span>
        </Label>
        <p className="text-xs text-gray-500">
          Upload documents that prove the legitimacy of your campaign (ID, registration cert, bank
          letter, photos, etc.)
        </p>

        {verificationDocs.length > 0 && (
          <div className="space-y-2">
            {verificationDocs.map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg text-sm"
              >
                <div className="flex items-center gap-2 text-green-800">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="truncate max-w-[220px]">
                    {verificationFiles[i]?.name || `Document ${i + 1}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeDoc(i)}
                  className="text-red-400 hover:text-red-600 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => docRef.current?.click()}
          className="flex items-center justify-center gap-2 w-full h-14 border-2 border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:bg-green-50 transition-colors text-gray-500 hover:text-green-600 text-sm"
        >
          <Upload className="w-4 h-4" />
          Upload document (PDF, JPG, PNG)
        </button>

        <input
          ref={docRef}
          type="file"
          accept=".pdf,image/*"
          multiple
          onChange={handleDocUpload}
          className="hidden"
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label>
          Campaign Category <span className="text-red-500">*</span>
        </Label>
        <Select value={data.campaign_category} onValueChange={(v) => onChange({ campaign_category: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Keywords */}
      <div className="space-y-1.5">
        <Label>Keywords (Optional)</Label>
        <p className="text-xs text-gray-500">
          Comma-separated keywords to help people find your campaign (e.g. education, Lagos, children)
        </p>
        <Input
          placeholder="education, Lagos, children, library"
          value={data.campaign_keywords}
          onChange={(e) => onChange({ campaign_keywords: e.target.value })}
        />
      </div>

      {/* Country */}
      <div className="space-y-1.5">
        <Label>Country</Label>
        <Select value={data.campaign_country} onValueChange={(v) => onChange({ campaign_country: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            {COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Social links */}
      <div className="space-y-3">
        <Label>Social Links (Optional)</Label>
        <p className="text-xs text-gray-500">
          Add links to social media or website pages about this campaign
        </p>

        {data.social_links.map((link, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-36 flex-shrink-0">
              <Select
                value={link.platform}
                onValueChange={(v) => updateSocialLink(i, 'platform', v)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  {SOCIAL_PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="https://..."
              value={link.url}
              onChange={(e) => updateSocialLink(i, 'url', e.target.value)}
              className="flex-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeSocialLink(i)}
              className="text-red-400 hover:text-red-600 p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSocialLink}
          className="border-dashed"
        >
          <Plus className="w-3 h-3 mr-1" /> Add link
        </Button>
      </div>
    </div>
  );
};

export default FundraisingVerificationStep;
