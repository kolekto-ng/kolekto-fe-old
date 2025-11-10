import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'sonner';

interface BasicInfoSectionProps {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  deadline: string;
  setDeadline: (value: string) => void;
  support: string;
  setSupport: (value: string) => void; // fixed: function type
}

const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
  title,
  setTitle,
  description,
  setDescription,
  deadline,
  setDeadline,
  support,
  setSupport,
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Collection Title</Label>
        <Input
          id="title"
          placeholder="e.g. BIO 301 Handout"
          required
          aria-required="true"
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
          aria-required="true"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="support">Support</Label>
        <p className='text-[12px]'>The number you want your contributors to contact you on</p>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-600">
            <span className="text-sm font-medium">+234</span>
          </div>
          <Input
            id="support"
            type="tel"
            inputMode="tel"
            value={support?.startsWith('+234') ? support.slice(4) : support.replace(/^\+/, '')}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);

              setSupport(digitsOnly ? `+234${digitsOnly}` : '');
            }}
            className="w-full pl-14"
            placeholder='8012345678'
            maxLength={10}
            minLength={10}
            pattern="\d*"
            required
            aria-label="Support phone (Nigeria)"
          />
        </div>
      </div>
    </div>
  );
};

export default BasicInfoSection;