import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormFieldProps extends InputProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  containerClassName?: string;
}

const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, hint, required, containerClassName, id, ...props }, ref) => {
    const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
    const errorId = `${fieldId}-error`;
    const hintId = `${fieldId}-hint`;

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        <Label htmlFor={fieldId} className="text-xs font-medium">
          {label}
          {required && <span className="text-destructive ml-0.5" aria-hidden="true"> *</span>}
        </Label>

        <Input
          ref={ref}
          id={fieldId}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={cn(error ? errorId : "", hint ? hintId : "") || undefined}
          className={cn(error ? "border-destructive focus-visible:ring-destructive/30" : "")}
          {...props}
        />

        {hint && !error && (
          <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>
        )}

        {error && (
          <p id={errorId} role="alert" className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle size={11} aria-hidden="true" /> {error}
          </p>
        )}
      </div>
    );
  }
);
FormField.displayName = "FormField";

export { FormField };
