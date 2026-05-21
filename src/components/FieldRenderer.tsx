import React from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/config/onboardingSchema";

interface FieldRendererProps {
  field: FormField;
  value: any;
  onChange: (key: string, value: any) => void;
  data: any; // The full form data state for evaluating conditions
}

export function FieldRenderer({ field, value, onChange, data }: FieldRendererProps) {
  const { t } = useTranslation();

  // Evaluate condition if present
  if (field.condition && !field.condition(data)) {
    return null;
  }

  const renderField = () => {
    switch (field.type) {
      case "text":
        // For general single-line text
        return <Input value={value || ""} onChange={e => onChange(field.key, e.target.value)} placeholder={field.placeholder ? t(field.placeholder, field.placeholder) : ""} />;
      
      case "textarea":
        return <Textarea value={value || ""} onChange={e => onChange(field.key, e.target.value)} placeholder={field.placeholder ? t(field.placeholder, field.placeholder) : ""} />;

      case "number":
        return <Input type="number" value={value || ""} onChange={e => onChange(field.key, e.target.value)} placeholder={field.placeholder ? t(field.placeholder, field.placeholder) : ""} />;
        
      case "boolean":
        return (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-sm">{field.label ? t(field.label) : ""}</Label>
            <Switch checked={value || false} onCheckedChange={(v) => onChange(field.key, v)} />
          </div>
        );
        
      case "select":
        return (
          <div className="space-y-2">
            {field.label && <Label>{t(field.label)}</Label>}
            <Select value={value || ""} onValueChange={(v) => onChange(field.key, v)}>
              <SelectTrigger><SelectValue placeholder={t("common.select", "Select")} /></SelectTrigger>
              <SelectContent>
                {field.options?.map((opt: any) => {
                  const val = typeof opt === "string" || typeof opt === "number" ? String(opt) : opt.value;
                  const lbl = typeof opt === "string" || typeof opt === "number" ? String(opt) : opt.label;
                  return <SelectItem key={val} value={val}>{t(lbl, lbl)}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
        );
        
      case "multi-select":
        const selectedArr = (value || []) as string[];
        return (
          <div className="space-y-2">
            {field.label && <Label>{t(field.label)}</Label>}
            <div className="grid grid-cols-2 gap-2">
              {field.options?.map((opt: any) => {
                const val = typeof opt === "string" || typeof opt === "number" ? String(opt) : opt.value;
                const lbl = typeof opt === "string" || typeof opt === "number" ? String(opt) : opt.label;
                return (
                  <label key={val} className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-sm transition-colors hover:bg-accent">
                    <Checkbox 
                      checked={selectedArr.includes(val)} 
                      onCheckedChange={() => {
                        const newArr = selectedArr.includes(val) 
                          ? selectedArr.filter(i => i !== val)
                          : [...selectedArr, val];
                        onChange(field.key, newArr);
                      }} 
                    />
                    <span>{t(lbl, lbl)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
        
      case "slider":
        return (
          <div className="space-y-2">
            <Label>{t(field.label)}: {value ? value[0] : 0}h</Label>
            <Slider value={value || [0]} onValueChange={(v) => onChange(field.key, v)} min={1} max={14} step={0.5} />
          </div>
        );

      case "file":
        return (
          <div className="space-y-2">
            {field.label && <Label>{t(field.label)}</Label>}
            <Input type="file" onChange={(e) => onChange(field.key, e.target.files?.[0])} />
          </div>
        );
        
      default:
        return null;
    }
  };

  // For types that render their own top-level wrappers and labels
  if (field.type === "boolean" || field.type === "select" || field.type === "multi-select" || field.type === "slider" || field.type === "file") {
    return renderField();
  }

  // Wrapper for bare inputs like text and textarea
  return (
    <div className="space-y-2">
      {field.label && <Label>{t(field.label)}</Label>}
      {renderField()}
    </div>
  );
}
