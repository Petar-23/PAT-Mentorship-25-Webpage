// src/components/sections/testimonials/testimonial-modal-content.tsx
import { Quote, X } from 'lucide-react';
import { GradientCard } from '@/components/ui/gradient-card';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

interface TestimonialModalProps {
  isOpen: boolean;
  onClose: () => void;
  testimonial: {
    quote: string;
    author: string;
    role: string;
    results: {
      label: string;
      value: string;
      description: string;
    };
    gradientColor: string;
  };
}

export function TestimonialModal({ isOpen, onClose, testimonial }: TestimonialModalProps) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Feedback von ${testimonial.author}`}
      >
        <GradientCard
          gradientColor={testimonial.gradientColor}
          className="bg-white/80 backdrop-blur-sm w-full max-w-2xl mx-auto relative" // Added relative positioning
        >
          {/* Close Button */}
          <Button
            onClick={onClose}
            className="absolute top-4 right-4 h-10 w-10 rounded-full p-0 bg-white hover:bg-gray-100 shadow-lg border-0 transition-all hover:shadow-xl"
            variant="ghost"
          >
            <X className="h-5 w-5 text-gray-600 hover:text-gray-800" />
          </Button>
  
          <div className="p-4 sm:p-6">
            <Quote className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 mb-3 sm:mb-4" />
            
            <div className="text-gray-900 mb-4 sm:mb-6">
              <p className="text-sm sm:text-lg leading-relaxed">{testimonial.quote}</p>
            </div>
            
            <div className="border-t border-gray-100 pt-3 sm:pt-4">
              <div className="mb-3 sm:mb-4">
                <p className="font-semibold text-gray-900 text-sm sm:text-base">
                  {testimonial.author}
                </p>
                <p className="text-xs sm:text-sm text-gray-500">
                  {testimonial.role}
                </p>
              </div>
              
              <div className="bg-gray-50/80 backdrop-blur-sm rounded-lg p-2 sm:p-3">
                <p className="text-xs sm:text-sm text-gray-600">
                  {testimonial.results.label}
                </p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-xl sm:text-2xl font-bold text-green-600">
                    {testimonial.results.value}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {testimonial.results.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </GradientCard>
      </Modal>
    );
}