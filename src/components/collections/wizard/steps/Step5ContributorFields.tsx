import React from 'react';
import ContributorFieldsSection from '@/components/collections/form/ContributorFieldsSection';
import { WizardData } from '../wizardTypes';
import { FormField } from '@/types';

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

const Step5ContributorFields: React.FC<Props> = ({ data, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Contributor Information</h2>
        <p className="text-gray-500 text-sm">
          Define what information you want to collect from each contributor
        </p>
      </div>

      <ContributorFieldsSection
        formFields={data.form_fields}
        setFormFields={(fields: FormField[]) => onChange({ form_fields: fields })}
      />

      {data.form_fields.length >= 10 && (
        <p className="text-xs text-amber-600 text-center">
          You have {data.form_fields.length} fields. We recommend no more than 10 to keep the
          contributor experience smooth.
        </p>
      )}
    </div>
  );
};

export default Step5ContributorFields;
