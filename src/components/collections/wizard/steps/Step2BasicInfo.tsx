import React, { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CollectionType, WizardData } from '../wizardTypes';
import { Upload, X, Calendar, Phone } from 'lucide-react';

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

const PhoneInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  label?: string;
  hint?: string;
}> = ({ value, onChange, label = 'Support Contact', hint = 'Number your contributors can reach you on' }) => {
  const displayVal = value?.startsWith('+234') ? value.slice(4) : value.replace(/^\+/, '');

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <span className="text-sm font-medium text-gray-600">+234</span>
        </div>
        <Input
          type="tel"
          inputMode="tel"
          value={displayVal}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
            onChange(digits ? `+234${digits}` : '');
          }}
          className="pl-14"
          placeholder="8012345678"
          maxLength={10}
        />
      </div>
    </div>
  );
};

const ImageUpload: React.FC<{
  label: string;
  hint: string;
  preview: string;
  accept?: string;
  onFile: (preview: string) => void;
  onClear: () => void;
  required?: boolean;
}> = ({ label, hint, preview, accept = 'image/*', onFile, onClear, required }) => {
  const ref = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onFile(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <p className="text-xs text-gray-500">{hint}</p>

      {preview ? (
        <div className="relative inline-block">
          <img src={preview} alt={label} className="w-full max-w-xs h-32 object-cover rounded-lg border" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1 right-1 bg-white rounded-full p-1 shadow hover:bg-red-50 text-red-500"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors text-gray-500 hover:text-green-600"
        >
          <Upload className="w-6 h-6 mb-1" />
          <span className="text-sm">Click to upload</span>
          <span className="text-xs text-gray-400 mt-0.5">{accept === 'image/*' ? 'PNG, JPG, WebP' : 'PDF or Image'}</span>
        </button>
      )}

      <input
        ref={ref}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
};

// ─── Regular types: fixed, tiered, open_pool ────────────────────────────────

const RegularBasicInfo: React.FC<Props> = ({ data, onChange }) => {
  const isOpenPool = data.collection_type === 'open_pool';

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">
          Collection Title <span className="text-red-500">*</span>
        </Label>
        <Input
          id="title"
          placeholder={isOpenPool ? 'e.g. Class Trip Fund' : 'e.g. BIO 301 Handout'}
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          placeholder="Describe what this collection is for"
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="deadline">
          Deadline <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            id="deadline"
            type="date"
            value={data.deadline}
            onChange={(e) => onChange({ deadline: e.target.value })}
            className="pl-9"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      <PhoneInput
        value={data.support_phone}
        onChange={(val) => onChange({ support_phone: val })}
      />
    </div>
  );
};

// ─── Ticket type ─────────────────────────────────────────────────────────────

const TicketBasicInfo: React.FC<Props> = ({ data, onChange }) => (
  <div className="space-y-5">
    <div className="space-y-1.5">
      <Label htmlFor="title">
        Event Name <span className="text-red-500">*</span>
      </Label>
      <Input
        id="title"
        placeholder="e.g. Annual Alumni Dinner 2026"
        value={data.title}
        onChange={(e) => onChange({ title: e.target.value })}
      />
    </div>

    <div className="space-y-1.5">
      <Label htmlFor="description">
        Event Description <span className="text-red-500">*</span>
      </Label>
      <Textarea
        id="description"
        placeholder="Tell attendees about the event, venue, dress code, etc."
        value={data.description}
        onChange={(e) => onChange({ description: e.target.value })}
        rows={4}
      />
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="event-date">
          Event Date <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            id="event-date"
            type="date"
            value={data.event_date}
            onChange={(e) => onChange({ event_date: e.target.value })}
            className="pl-9"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="deadline">
          Sales Deadline <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            id="deadline"
            type="date"
            value={data.deadline}
            onChange={(e) => onChange({ deadline: e.target.value })}
            className="pl-9"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <ImageUpload
        label="Ticket Banner"
        hint="Shown on the ticket purchase page (16:9 recommended)"
        preview={data.ticket_banner_preview}
        onFile={(preview) => onChange({ ticket_banner_preview: preview })}
        onClear={() => onChange({ ticket_banner_preview: '' })}
        required
      />
      <ImageUpload
        label="Ticket Template"
        hint="PDF or image used as the ticket design sent to buyers"
        preview={data.ticket_template_preview}
        accept=".pdf,image/*"
        onFile={(preview) => onChange({ ticket_template_preview: preview })}
        onClear={() => onChange({ ticket_template_preview: '' })}
        required
      />
    </div>

    <PhoneInput
      value={data.support_phone}
      onChange={(val) => onChange({ support_phone: val })}
    />
  </div>
);

// ─── Fundraising type ─────────────────────────────────────────────────────────

const FundraisingBasicInfo: React.FC<Props> = ({ data, onChange }) => (
  <div className="space-y-5">
    <div className="space-y-1.5">
      <Label htmlFor="title">
        Campaign Title <span className="text-red-500">*</span>
      </Label>
      <Input
        id="title"
        placeholder="e.g. Help Build Our School Library"
        value={data.title}
        onChange={(e) => onChange({ title: e.target.value })}
      />
    </div>

    <ImageUpload
      label="Campaign Banner"
      hint="Eye-catching banner image for your campaign page (16:9 recommended)"
      preview={data.campaign_banner_preview}
      onFile={(preview) => onChange({ campaign_banner_preview: preview })}
      onClear={() => onChange({ campaign_banner_preview: '' })}
      required
    />

    <div className="space-y-1.5">
      <Label htmlFor="campaign-summary">
        Campaign Summary <span className="text-red-500">*</span>
      </Label>
      <p className="text-xs text-gray-500">
        A one-paragraph summary shown as the preview of your campaign (max 300 characters)
      </p>
      <Textarea
        id="campaign-summary"
        placeholder="Write a compelling one-line or short paragraph that grabs attention…"
        value={data.campaign_summary}
        onChange={(e) => {
          if (e.target.value.length <= 300) onChange({ campaign_summary: e.target.value });
        }}
        rows={3}
      />
      <p className="text-xs text-gray-400 text-right">{data.campaign_summary.length}/300</p>
    </div>

    <PhoneInput
      value={data.support_phone}
      onChange={(val) => onChange({ support_phone: val })}
      label="Campaign Contact"
      hint="Phone number for campaign enquiries"
    />
  </div>
);

// ─── Main export ─────────────────────────────────────────────────────────────

const Step2BasicInfo: React.FC<Props> = ({ data, onChange }) => {
  const titles: Record<CollectionType, { heading: string; sub: string }> = {
    fixed: { heading: 'Basic Information', sub: "Let's start with the basics of your collection" },
    tiered: { heading: 'Basic Information', sub: "Let's start with the basics of your collection" },
    open_pool: { heading: 'Basic Information', sub: "Let's start with the basics of your collection" },
    ticket: { heading: 'Event Details', sub: 'Tell us about your event and upload your ticket assets' },
    fundraising: {
      heading: 'Campaign Introduction',
      sub: 'Introduce your campaign with a compelling title and banner',
    },
  };

  const { heading, sub } = titles[data.collection_type];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">{heading}</h2>
        <p className="text-gray-500 text-sm">{sub}</p>
      </div>

      {data.collection_type === 'ticket' && <TicketBasicInfo data={data} onChange={onChange} />}
      {data.collection_type === 'fundraising' && <FundraisingBasicInfo data={data} onChange={onChange} />}
      {(data.collection_type === 'fixed' ||
        data.collection_type === 'tiered' ||
        data.collection_type === 'open_pool') && <RegularBasicInfo data={data} onChange={onChange} />}
    </div>
  );
};

export default Step2BasicInfo;
