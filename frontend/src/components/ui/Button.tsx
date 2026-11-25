// Кнопка и ссылка в виде кнопки. Высота ≥44px на телефоне (п.4.3); size="sm" на десктопе ниже,
// чтобы строки таблиц в панелях препода и админа оставались плотными.
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LinkProps } from "react-router-dom";

export type ButtonVariant = "primary" | "tinted" | "ghost" | "good" | "bad" | "text" | "text-bad";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-ctl font-medium text-center " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out " +
  "active:translate-y-px disabled:opacity-45 disabled:cursor-not-allowed disabled:active:translate-y-0";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-holo text-void hover:bg-[#93d3ef] hover:shadow-holo disabled:hover:bg-holo disabled:hover:shadow-none",
  tinted: "bg-holo/[0.13] text-holo hover:bg-holo/20 border border-holo/25",
  ghost: "border border-line text-ink hover:border-holo/60 hover:bg-holo/[0.07]",
  good: "bg-good/[0.16] text-good border border-good/40 hover:bg-good/25",
  bad: "bg-bad/[0.14] text-bad border border-bad/40 hover:bg-bad/25",
  text: "text-holo underline decoration-holo/40 underline-offset-[3px] hover:decoration-holo",
  "text-bad": "text-bad underline decoration-bad/40 underline-offset-[3px] hover:decoration-bad",
};

const SIZE = {
  md: "min-h-[44px] px-4 py-2 text-base",
  sm: "min-h-[44px] md:min-h-[36px] px-3 py-1.5 text-sm",
  lg: "min-h-[52px] px-6 py-3 text-base md:text-lg",
};

interface StyleProps {
  variant?: ButtonVariant;
  size?: keyof typeof SIZE;
  block?: boolean;
}

function classes({ variant = "primary", size = "md", block }: StyleProps, extra?: string): string {
  // текстовые кнопки — без внутренних отступов, но с той же зоной нажатия по высоте
  const isText = variant === "text" || variant === "text-bad";
  const box = isText ? `${size === "sm" ? "min-h-[44px] md:min-h-[32px] text-sm" : "min-h-[44px]"} px-0.5` : SIZE[size];
  return [BASE, VARIANT[variant], box, block ? "w-full" : "", extra ?? ""].join(" ");
}

type ButtonProps = StyleProps & ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, className, type = "button", ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={classes({ variant, size, block }, className)} {...rest} />;
});

export default Button;

/** Ссылка роутера с видом кнопки. */
export function LinkButton({ variant, size, block, className, ...rest }: StyleProps & LinkProps) {
  return <Link className={classes({ variant, size, block }, className)} {...rest} />;
}
