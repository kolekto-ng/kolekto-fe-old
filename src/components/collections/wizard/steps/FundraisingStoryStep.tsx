import React, { useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X } from 'lucide-react';
import { WizardData } from '../wizardTypes';

export interface StoryImageFile {
  name: string;
  dataUrl: string;
}

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
  storyImages: string[];
  storyImageFiles?: StoryImageFile[];
  onImagesChange: (images: string[]) => void;
  onImageFilesChange?: (files: StoryImageFile[]) => void;
}

const MAX_IMAGES = 5;

const FundraisingStoryStep: React.FC<Props> = ({
  data,
  onChange,
  storyImages,
  storyImageFiles = [],
  onImagesChange,
  onImageFilesChange,
}) => {
  const imgRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    const remaining = MAX_IMAGES - storyImages.length;
    const filesToProcess = fileList.slice(0, remaining);
    const newImages = [...storyImages];
    const newImageFiles: StoryImageFile[] = [...storyImageFiles];

    filesToProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        newImages.push(dataUrl);
        newImageFiles.push({ name: file.name, dataUrl });
        onImagesChange([...newImages]);
        if (onImageFilesChange) onImageFilesChange([...newImageFiles]);
      };
      reader.readAsDataURL(file);
    });
    // reset so same file can be re-selected
    e.target.value = '';
  };

  const removeImage = (i: number) => {
    onImagesChange(storyImages.filter((_, idx) => idx !== i));
    if (onImageFilesChange) {
      onImageFilesChange(storyImageFiles.filter((_, idx) => idx !== i));
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Your Campaign Story</h2>
        <p className="text-gray-500 text-sm">
          Tell potential donors why this campaign matters — compelling stories raise more
        </p>
      </div>

      {/* Importance notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <p className="font-semibold mb-0.5">Why your story matters</p>
        <p className="text-amber-700 text-xs leading-relaxed">
          Campaigns with a clear, detailed story raise significantly more. Donors give to people they trust — a compelling story builds that trust. These fields are optional but strongly recommended.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="story-what">What is this campaign for?</Label>
        <p className="text-xs text-gray-500">
          Clearly explain what you're raising money for and how it will be used
        </p>
        <Textarea
          id="story-what"
          placeholder="We are raising funds to build a library for 200 primary school students in our community…"
          value={data.story_what}
          onChange={(e) => onChange({ story_what: e.target.value })}
          rows={4}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="story-why">Why does this matter?</Label>
        <p className="text-xs text-gray-500">
          Share the emotional or social reason behind this campaign
        </p>
        <Textarea
          id="story-why"
          placeholder="Access to books changes lives. Right now, these children share just 3 books among 200 students…"
          value={data.story_why}
          onChange={(e) => onChange({ story_why: e.target.value })}
          rows={4}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="story-impact">What impact will donations have?</Label>
        <p className="text-xs text-gray-500">
          Describe the concrete outcomes donors can expect from their contribution
        </p>
        <Textarea
          id="story-impact"
          placeholder="With ₦500,000 we will purchase 500 books, build 6 shelves, and hire a part-time librarian for one year…"
          value={data.story_impact}
          onChange={(e) => onChange({ story_impact: e.target.value })}
          rows={4}
        />
      </div>

      {/* Supporting images */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>Supporting Images (Optional)</Label>
            <p className="text-xs text-gray-500 mt-0.5">Max {MAX_IMAGES} images — shown in your campaign gallery</p>
          </div>
          <span className="text-xs text-gray-400">{storyImages.length}/{MAX_IMAGES}</span>
        </div>

        {storyImages.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {storyImages.map((src, i) => (
              <div key={i} className="relative aspect-square">
                <img
                  src={src}
                  alt={`Story image ${i + 1}`}
                  className="w-full h-full object-cover rounded-lg border"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow hover:bg-red-50 text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {storyImages.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => imgRef.current?.click()}
            className="flex items-center justify-center gap-2 w-full h-16 border-2 border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:bg-green-50 transition-colors text-gray-500 hover:text-green-600 text-sm"
          >
            <Upload className="w-4 h-4" />
            Add photos
          </button>
        )}

        <input
          ref={imgRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default FundraisingStoryStep;
