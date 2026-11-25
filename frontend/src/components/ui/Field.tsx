// Поля форм: общий вид задаёт класс .field (index.css), здесь — обёртки с подписью.
import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import Icon from "./Icon";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={`field ${className ?? ""}`} {...rest} />;
  },
);

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`field leading-relaxed ${className ?? ""}`} {...rest} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`field pr-8 ${className ?? ""}`} {...rest} />;
}

/** Подпись поля. Передай htmlFor или оберни поле целиком. */
export function Label({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm text-ink-soft">
      {children}
    </label>
  );
}

/** Поиск по списку: поле с лупой. */
export function SearchField({
  value,
  onChange,
  placeholder = "Поиск по названию",
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Подпись для скринридера; по умолчанию совпадает с placeholder. */
  label?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        type="search"
        aria-label={label ?? placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field pr-10 [&::-webkit-search-cancel-button]:hidden"
      />
      <Icon name="search" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute" />
    </div>
  );
}
