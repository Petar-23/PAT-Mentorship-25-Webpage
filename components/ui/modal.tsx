// src/components/ui/modal.tsx
import React from 'react';
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { cn } from "@/lib/utils";
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  title: string;
}

const maxWidthClasses = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl'
};

export function Modal({ 
    isOpen, 
    onClose, 
    children, 
    maxWidth = '2xl',
    title 
  }: ModalProps) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogPortal>
          <DialogOverlay className="bg-white/[0.15] backdrop-blur-sm" />
          <DialogContent 
            className={cn(
              maxWidthClasses[maxWidth],
              "bg-transparent border-0 shadow-none p-4 sm:p-6",
              // Remove the [&>button]:hidden
              "max-h-[calc(100vh-64px)] overflow-y-auto",
              "mt-16 sm:mt-0",
              "[&>button]:hidden"
            )}
          >
            <VisuallyHidden>
              <DialogTitle>{title}</DialogTitle>
            </VisuallyHidden>
            {children}
          </DialogContent>
        </DialogPortal>
      </Dialog>
    );
  }