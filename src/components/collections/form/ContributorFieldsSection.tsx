import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Trash2, List, ChevronDown, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FormField } from '@/types';

interface ContributorFieldsSectionProps {
  formFields: FormField[];
  setFormFields: (fields: FormField[]) => void;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone Number' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'datetime-local', label: 'Date & Time' },
  { value: 'url', label: 'URL' },
  { value: 'password', label: 'Password' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'select', label: 'Select Dropdown' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'checkbox', label: 'Checkbox' },
];

const ContributorFieldsSection: React.FC<ContributorFieldsSectionProps> = ({
  formFields,
  setFormFields,
}) => {
  const [isAddingField, setIsAddingField] = useState(false);
  const [droppableId] = useState(`form-fields-${Math.random()}`);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(formFields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setFormFields(items);
  };

  const handleAddField = (fieldType: string) => {
    const newId = Date.now().toString();
    const newField: FormField = {
      id: newId,
      name: '',
      type: fieldType as any,
      required: false,
    };

    // Add default options for select/radio fields
    if (fieldType === 'select' || fieldType === 'radio') {
      newField.options = ['Option 1', 'Option 2'];
    }

    setFormFields([...formFields, newField]);
    setIsAddingField(false);
  };

  const handleRemoveField = (id: string) => {
    setFormFields(formFields.filter(field => field.id !== id));
  };

  const handleFieldChange = (id: string, key: keyof FormField, value: string | boolean | string[]) => {
    setFormFields(formFields.map(field => {
      if (field.id === id) {
        const updatedField = { ...field, [key]: value };

        // Add default options when changing to select/radio
        if (key === 'type' && (value === 'select' || value === 'radio') && !updatedField.options) {
          updatedField.options = ['Option 1', 'Option 2'];
        }

        // Remove options when changing away from select/radio
        if (key === 'type' && value !== 'select' && value !== 'radio') {
          delete updatedField.options;
        }

        return updatedField;
      }
      return field;
    }));
  };

  const handleAddOption = (fieldId: string) => {
    setFormFields(formFields.map(field => {
      if (field.id === fieldId) {
        const currentOptions = field.options || [];
        return { ...field, options: [...currentOptions, ''] };
      }
      return field;
    }));
  };

  const handleOptionChange = (fieldId: string, optionIndex: number, value: string) => {
    setFormFields(formFields.map(field => {
      if (field.id === fieldId && field.options) {
        const updatedOptions = [...field.options];
        updatedOptions[optionIndex] = value;
        return { ...field, options: updatedOptions };
      }
      return field;
    }));
  };

  const handleRemoveOption = (fieldId: string, optionIndex: number) => {
    setFormFields(formFields.map(field => {
      if (field.id === fieldId && field.options) {
        const updatedOptions = field.options.filter((_, index) => index !== optionIndex);
        return { ...field, options: updatedOptions };
      }
      return field;
    }));
  };

  const getFieldTypeLabel = (type: string) => {
    const fieldType = FIELD_TYPES.find(ft => ft.value === type);
    return fieldType ? fieldType.label : type;
  };

  const renderOptionsUI = (field: FormField) => {
    if (field.type !== 'select' && field.type !== 'radio') return null;

    return (
      <div className="mt-3 p-3 border border-dashed border-gray-300 rounded-md bg-gray-50">
        <div className="flex items-center gap-2 mb-3">
          <List className="h-4 w-4 text-gray-500" />
          <h4 className="font-medium text-sm">Options for "{field.name || 'Unnamed field'}"</h4>
        </div>

        {(field.options || []).map((option, index) => (
          <div key={`${field.id}-option-${index}`} className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="min-w-6 h-6 flex items-center justify-center text-xs">{index + 1}</Badge>
            <Input
              value={option}
              onChange={(e) => handleOptionChange(field.id, index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              className="flex-1 h-8 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleRemoveOption(field.id, index)}
              disabled={(field.options || []).length <= 2}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-7 text-xs"
          onClick={() => handleAddOption(field.id)}
        >
          <Plus className="mr-1 h-3 w-3" /> Add Option
        </Button>

        {(!field.options || field.options.length < 2) && (
          <p className="text-xs text-amber-600 mt-2">
            Add at least 2 options
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="border-t pt-6">
      <h3 className="font-medium text-lg mb-4">Contribution Information Fields</h3>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={droppableId}>
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-3"
            >
              {formFields.map((field, index) => (
                <Draggable key={field.id} draggableId={field.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`border rounded-lg p-3 bg-white transition-shadow ${snapshot.isDragging ? 'shadow-lg' : 'shadow-sm'
                        }`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          {...provided.dragHandleProps}
                          className="mt-2 p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                            <div className="md:col-span-5">
                              <Input
                                placeholder="Field name"
                                value={field.name}
                                onChange={(e) => handleFieldChange(field.id, 'name', e.target.value)}
                                required
                                className="w-full"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <Select
                                value={field.type}
                                onValueChange={(value) => handleFieldChange(field.id, 'type', value)}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent className="z-50 bg-white">
                                  {FIELD_TYPES.map((fieldType) => (
                                    <SelectItem key={fieldType.value} value={fieldType.value}>
                                      {fieldType.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="md:col-span-3 flex items-center space-x-2">
                              <Switch
                                id={`required-${field.id}`}
                                checked={field.required}
                                onCheckedChange={(checked) => handleFieldChange(field.id, 'required', checked)}
                              />
                              <Label htmlFor={`required-${field.id}`} className="text-sm whitespace-nowrap">
                                Required
                              </Label>
                            </div>

                            <div className="md:col-span-1 flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveField(field.id)}
                                disabled={formFields.length <= 1}
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {renderOptionsUI(field)}
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="mt-4">
        <DropdownMenu open={isAddingField} onOpenChange={setIsAddingField}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" /> Add Field
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 z-50 bg-white">
            {FIELD_TYPES.map((fieldType) => (
              <DropdownMenuItem
                key={fieldType.value}
                onClick={() => handleAddField(fieldType.value)}
                className="cursor-pointer"
              >
                {fieldType.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default ContributorFieldsSection;
