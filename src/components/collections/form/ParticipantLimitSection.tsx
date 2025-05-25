
import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ParticipantLimitSectionProps {
  isMaxParticipantsEnabled: boolean;
  setIsMaxParticipantsEnabled: (value: boolean) => void;
  maxParticipants: string;
  setMaxParticipants: (value: string) => void;
}

const ParticipantLimitSection: React.FC<ParticipantLimitSectionProps> = ({
  isMaxParticipantsEnabled,
  setIsMaxParticipantsEnabled,
  maxParticipants,
  setMaxParticipants,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-4">
      <div className="flex items-center space-x-2">
        <Switch
          id="maxParticipantsToggle"
          checked={isMaxParticipantsEnabled}
          onCheckedChange={setIsMaxParticipantsEnabled}
        />
        <Label htmlFor="maxParticipantsToggle">Limit number of participants</Label>
      </div>
      
      {isMaxParticipantsEnabled && (
        <div className="w-full sm:w-32">
          <Input
            id="maxParticipants"
            type="number"
            min="1"
            required={isMaxParticipantsEnabled}
            placeholder="e.g. 50"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};

export default ParticipantLimitSection;
