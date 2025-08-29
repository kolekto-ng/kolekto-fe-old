import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Plus, Trash2, Info } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCollectionStore } from '@/store';

interface ContributionField {
  id: string;
  name: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
}

interface PriceTier {
  name: string;
  price: number;
  quantity?: number;
  description?: string;
}

interface EditCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  initialData: {
    title: string;
    description?: string;
    deadline?: string;
    fee_bearer?: string;
    max_contributions?: number;
    code_prefix?: string;
    contributions_fields?: ContributionField[];
    total_contributions?: number;
    type?: 'fixed' | 'tiered';
    price_tiers?: PriceTier[];
  };
  onSuccess?: () => void;
}

const EditCollectionDialog: React.FC<EditCollectionDialogProps> = ({
  open,
  onOpenChange,
  collectionId,
  initialData,
  onSuccess
}) => {
  const [title, setTitle] = useState(initialData.title || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [deadline, setDeadline] = useState<Date | undefined>(
    initialData.deadline ? new Date(initialData.deadline) : undefined
  );
  const [feeBearerState, setFeeBearerState] = useState(initialData.fee_bearer || 'contributor');
  const [maxContributions, setMaxContributions] = useState<number | undefined>(
    initialData.max_contributions || undefined
  );
  const [codePrefix, setCodePrefix] = useState(initialData.code_prefix || '');
  const [contributionFields, setContributionFields] = useState<ContributionField[]>(
    initialData.contributions_fields || []
  );
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>(
    initialData.price_tiers || []
  );
  const [isLoading, setIsLoading] = useState(false);

  const { updateCollection } = useCollectionStore()

  // Check if collection has contributions to determine what can be edited
  const hasContributions = (initialData.total_contributions || 0) > 0;
  const collectionType = initialData.type || 'fixed';

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setDeadline(initialData.deadline ? new Date(initialData.deadline) : undefined);
      setFeeBearerState(initialData.fee_bearer || 'contributor');
      setMaxContributions(initialData.max_contributions || undefined);
      setCodePrefix(initialData.code_prefix || '');
      setContributionFields(initialData.contributions_fields || []);
      setPriceTiers(initialData.price_tiers || []);
    }
  }, [open, initialData]);

  const updatePriceTier = (index: number, updates: Partial<PriceTier>) => {
    setPriceTiers(tiers =>
      tiers.map((tier, i) =>
        i === index ? { ...tier, ...updates } : tier
      )
    );
  };

  const addContributionField = () => {
    const newField: ContributionField = {
      id: Date.now().toString(),
      name: '',
      type: 'text',
      required: false,
    };
    setContributionFields([...contributionFields, newField]);
  };

  const updateContributionField = (id: string, updates: Partial<ContributionField>) => {
    setContributionFields(fields =>
      fields.map(field =>
        field.id === id ? { ...field, ...updates } : field
      )
    );
  };

  const removeContributionField = (id: string) => {
    setContributionFields(fields => fields.filter(field => field.id !== id));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Collection title is required');
      return;
    }

    // Validate contribution fields
    const invalidFields = contributionFields.filter(field => !field.name.trim());
    if (invalidFields.length > 0) {
      toast.error('All contribution fields must have a name');
      return;
    }

    setIsLoading(true);

    try {
      // Convert deadline to ISO string if it exists
      const deadlineISO = deadline ? deadline.toISOString() : null;

      const updateData: any = {
        title,
        description,
        deadline: deadlineISO,
        collectionType,
        // fee_bearer: feeBearerState,
        max_contributions: collectionType === 'fixed' ? (maxContributions || null) : null,
        // code_prefix: codePrefix || null,
        contributions_fields: contributionFields.length > 0 ? contributionFields : null,
        price_tiers: collectionType === 'tiered' ? priceTiers : null,
        updated_at: new Date().toISOString()
      };

      console.log(updateData, 'updating collection with ID:', collectionId);


      const res = updateCollection(collectionId, updateData)
      console.log(res);

      toast.success('Collection updated successfully');
      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error updating collection:', error);
      toast.error(`Failed to update collection: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Collection</DialogTitle>
          <DialogDescription>
            Make changes to your collection. Note that financial settings cannot be changed once contributions have been received.
          </DialogDescription>
        </DialogHeader>

        {hasContributions && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This collection has received {initialData.total_contributions} contributions.
              Financial settings (amount, currency, tiers) cannot be modified to maintain data integrity.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="fields">Form Fields</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title*</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter collection title"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter collection description"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !deadline && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, "PPP") : "Select deadline"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={setDeadline}
                    initialFocus
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            {/* <div className="grid gap-2">
              <Label htmlFor="feeBearer">Fee Bearer</Label>
              <Select value={feeBearerState} onValueChange={setFeeBearerState}>
                <SelectTrigger>
                  <SelectValue placeholder="Select who pays transaction fees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contributor">Contributor pays fees</SelectItem>
                  <SelectItem value="organizer">Organizer pays fees</SelectItem>
                </SelectContent>
              </Select>
            </div> */}

            {collectionType === 'fixed' && (
              <div className="grid gap-2">
                <Label htmlFor="maxContributions">Maximum Contributions</Label>
                <Input
                  id="maxContributions"
                  type="number"
                  value={maxContributions || ''}
                  onChange={(e) => setMaxContributions(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Leave empty for unlimited"
                  min="1"
                />
              </div>
            )}

            {collectionType === 'tiered' && priceTiers.length > 0 && (
              <div className="space-y-4">
                <Label>Price Tiers</Label>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Price amounts cannot be changed after contributions are received. You can only edit tier names, descriptions, and quantities.
                  </AlertDescription>
                </Alert>
                {priceTiers.map((tier, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm">Tier Name</Label>
                        <Input
                          value={tier.name}
                          onChange={(e) => updatePriceTier(index, { name: e.target.value })}
                          placeholder="e.g., Standard, Premium"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Price</Label>
                        <Input
                          value={`₦${tier.price.toLocaleString()}`}
                          disabled
                          className="bg-gray-100 text-gray-500"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">Description</Label>
                      <Textarea
                        value={tier.description || ''}
                        onChange={(e) => updatePriceTier(index, { description: e.target.value })}
                        placeholder="Optional description for this tier"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Quantity Limit</Label>
                      <Input
                        type="number"
                        value={tier.quantity || ''}
                        onChange={(e) => updatePriceTier(index, {
                          quantity: e.target.value ? parseInt(e.target.value) : undefined
                        })}
                        placeholder="Leave empty for unlimited"
                        min="1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* <div className="grid gap-2">
              <Label htmlFor="codePrefix">Code Prefix</Label>
              <Input
                id="codePrefix"
                value={codePrefix}
                onChange={(e) => setCodePrefix(e.target.value)}
                placeholder="Optional prefix for contributor codes (e.g., EVENT-)"
                maxLength={10}
              />
            </div> */}
          </TabsContent>

          <TabsContent value="fields" className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Contribution Form Fields</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addContributionField}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Field
              </Button>
            </div>

            {contributionFields.length === 0 ? (
              <p className="text-sm text-gray-500">
                No custom fields added. Contributors will only need to provide basic payment information.
              </p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {contributionFields.map((field) => (
                  <div key={field.id} className="border rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <Input
                        value={field.name}
                        onChange={(e) => updateContributionField(field.id, { name: e.target.value })}
                        placeholder="Field name (e.g., Full Name, Phone)"
                        className="flex-1 mr-2"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeContributionField(field.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <Select
                        value={field.type}
                        onValueChange={(value: any) => updateContributionField(field.id, { type: value })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="textarea">Long Text</SelectItem>
                          <SelectItem value="select">Dropdown</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={field.required}
                          onCheckedChange={(checked) => updateContributionField(field.id, { required: checked })}
                        />
                        <Label className="text-sm">Required</Label>
                      </div>
                    </div>

                    {field.type === 'select' && (
                      <div>
                        <Label className="text-xs text-gray-600">Options (one per line)</Label>
                        <Textarea
                          value={field.options?.join('\n') || ''}
                          onChange={(e) => updateContributionField(field.id, {
                            options: e.target.value.split('\n').filter(opt => opt.trim())
                          })}
                          placeholder="Option 1&#10;Option 2&#10;Option 3"
                          rows={3}
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
            className="bg-kolekto hover:bg-kolekto/90"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditCollectionDialog;