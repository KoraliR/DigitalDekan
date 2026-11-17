import { Slot } from "@radix-ui/react-slot";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ComponentProps } from "react";

export function Button({ asChild, className, variant = "primary", ...props }: ComponentProps<"button"> & {
  asChild?: boolean;
  variant?: "primary" | "secondary" | "icon";
}) {
  const Component = asChild ? Slot : "button";
  return <Component className={twMerge(clsx("button", "button-" + variant, className))} {...props} />;
}