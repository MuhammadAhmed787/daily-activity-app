import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateCompanyCode() {
  const prefix = 'COMP';
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}-${timestamp}`;
}