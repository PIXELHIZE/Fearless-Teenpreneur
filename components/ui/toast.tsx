"use client";

import { type ComponentProps } from "react";
import { Toast as ToastPrimitive } from "radix-ui";
import { cn } from "cn";

export function ToastProvider(props: ComponentProps<typeof ToastPrimitive.Provider>) {
  return <ToastPrimitive.Provider label="알림" duration={Infinity} swipeDirection="right" {...props} />;
}
export function ToastViewport({ className, ...props }: ComponentProps<typeof ToastPrimitive.Viewport>) {
  return <ToastPrimitive.Viewport label="알림 ({hotkey})" data-slot="toast-viewport" className={cn("toast-viewport", className)} {...props} />;
}
export function Toast({ className, ...props }: ComponentProps<typeof ToastPrimitive.Root>) {
  return <ToastPrimitive.Root type="background" data-slot="toast" className={cn("teum-toast", className)} {...props} />;
}
export function ToastTitle({ className, ...props }: ComponentProps<typeof ToastPrimitive.Title>) {
  return <ToastPrimitive.Title data-slot="toast-title" className={cn("toast-title", className)} {...props} />;
}
export function ToastDescription({ className, ...props }: ComponentProps<typeof ToastPrimitive.Description>) {
  return <ToastPrimitive.Description data-slot="toast-description" className={cn("toast-description", className)} {...props} />;
}
export function ToastClose(props: ComponentProps<typeof ToastPrimitive.Close>) {
  return <ToastPrimitive.Close data-slot="toast-close" {...props} />;
}
