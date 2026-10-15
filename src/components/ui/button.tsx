import type { ButtonHTMLAttributes } from "react";

/** Small shadcn-compatible button primitive used by the prototype UI. */
export function Button({ className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={className} {...props} />;
}
