
import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ContributorLimitSectionProps {
  isMaxContributorsEnabled: boolean;
  setIsMaxContributorsEnabled: (value: boolean) => void;
  maxContributors: string;
  setMaxContributors: (value: string) => void;
}

const ContributorLimitSection: React.FC<ContributorLimitSectionProps> = ({
  isMaxContributorsEnabled,
  setIsMaxContributorsEnabled,
  maxContributors,
  setMaxContributors,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-4">
      <div className="flex items-center space-x-2">
        <Switch
          id="maxContributorsToggle"
          checked={isMaxContributorsEnabled}
          onCheckedChange={setIsMaxContributorsEnabled}
        />
        <Label htmlFor="maxContributorsToggle">Limit number of contributors</Label>
      </div>
      
      {isMaxContributorsEnabled && (
        <div className="w-full sm:w-32">
          <Input
            id="maxContributors"
            type="number"
            min="1"
            required={isMaxContributorsEnabled}
            placeholder="e.g. 50"
            value={maxContributors}
            onChange={(e) => setMaxContributors(e.target.value)}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};

export default ContributorLimitSection;
