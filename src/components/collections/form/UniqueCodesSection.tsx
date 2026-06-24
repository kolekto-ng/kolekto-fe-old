
import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Key } from "lucide-react";

interface UniqueCodesSectionProps {
  generateUniqueCodes: boolean;
  setGenerateUniqueCodes: (value: boolean) => void;
  codePrefix: string;
  setCodePrefix: (value: string) => void;
}

const UniqueCodesSection: React.FC<UniqueCodesSectionProps> = ({
  generateUniqueCodes,
  setGenerateUniqueCodes,
  codePrefix,
  setCodePrefix,
}) => {
  return (
    <div className="border-t pt-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="uniqueCodesToggle"
            checked={generateUniqueCodes}
            onCheckedChange={setGenerateUniqueCodes}
          />
          <Label htmlFor="uniqueCodesToggle" className="flex items-center">
            <span>Generate unique codes for each contributor</span>
            <Key className="ml-1 h-4 w-4 text-gray-500" />
          </Label>
        </div>
      </div>

      {generateUniqueCodes && (
        <div className="mt-4 space-y-2">
          <Label htmlFor="codePrefix">Code Prefix (Required)</Label>
          <div className="flex items-center space-x-2">
            <Input
              id="codePrefix"
              placeholder="e.g. REG"
              value={codePrefix}
              onChange={(e) => setCodePrefix(e.target.value.toUpperCase())}
              className="w-full"
            />
            <div className="bg-gray-100 px-3 py-2 rounded-md text-sm font-mono">
              {(codePrefix || 'PREFIX')}-001
            </div>
          </div>
          <p className="text-sm text-gray-500">
            A prefix is required to generate codes — no prefix means no code is assigned, even with this
            enabled. If someone pays for multiple people, each person will get their own code.
          </p>
        </div>
      )}
    </div>
  );
};

export default UniqueCodesSection;
