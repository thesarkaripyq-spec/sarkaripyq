"use client";

import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface AuthFieldProps {
  label: string;
  labelAction?: ReactNode;
  icon: LucideIcon;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}

export function AuthField({
  label,
  labelAction,
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  minLength,
}: AuthFieldProps) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";

  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-ink-700">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 py-2.5 transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15 hover:border-ink-200">
        <Icon size={16} className="shrink-0 text-ink-300" aria-hidden />
        <input
          id={id}
          type={isPassword && reveal ? "text" : type}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-transparent text-base text-ink-900 outline-none placeholder:text-ink-300"
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            tabIndex={-1}
            aria-label={reveal ? "Hide password" : "Show password"}
            className="shrink-0 text-ink-300 transition-colors hover:text-ink-500"
          >
            {reveal ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
