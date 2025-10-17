
import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BasicInfoSectionProps {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  deadline: string;
  support: string;
  setDeadline: (value: string) => void;
}

const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
  title,
  setTitle,
  description,
  setDescription,
  deadline,
  setDeadline,
  support,
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Collection Title</Label>
        <Input
          id="title"
          placeholder="e.g. BIO 301 Handout"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          placeholder="Describe what this collection is for"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="deadline">Deadline</Label>
        <Input
          id="deadline"
          type="date"
          required
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="Support">Support</Label>
        <p className='text-[12px]'>The number you want your contributors to contact you on</p>
        <Input
          id="Support"
          type="tel"
          required
          value={support}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full"
          placeholder='Your support'
        />
      </div>
    </div>
  );
};

export default BasicInfoSection;
