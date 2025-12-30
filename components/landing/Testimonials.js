// components/landing/Testimonials.js
// Testimonials carousel with accessibility

import { useState, useEffect, useCallback } from 'react';
import { Box, Container, Typography, IconButton } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';

const TESTIMONIALS = [
  {
    id: 1,
    quote: "Ontographia replaced Lucidchart, Miro, and draw.io for our entire team. The BPMN support is best-in-class, and the real-time collaboration features have transformed how we work together.",
    author: 'Sarah Chen',
    role: 'Enterprise Architect',
    company: 'Fortune 500 Bank',
    initials: 'SC',
  },
  {
    id: 2,
    quote: "Finally, a diagramming tool that understands developers. The keyboard shortcuts and UML support are exactly what we needed. Our team's productivity has increased significantly.",
    author: 'Marcus Rodriguez',
    role: 'Engineering Lead',
    company: 'Tech Startup',
    initials: 'MR',
  },
  {
    id: 3,
    quote: "We evaluated 8 different tools before choosing Ontographia. The combination of TOGAF support, beautiful exports, and intuitive interface made it an easy decision for our architecture team.",
    author: 'Dr. Emily Watson',
    role: 'Chief Architect',
    company: 'Healthcare Enterprise',
    initials: 'EW',
  },
];

export default function Testimonials() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const goToNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % TESTIMONIALS.length);
  }, []);

  const goToPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  }, []);

  const goToSlide = (index) => {
    setActiveIndex(index);
  };

  // Auto-rotate (if not paused and no reduced motion preference)
  useEffect(() => {
    if (isPaused || prefersReducedMotion) return;

    const interval = setInterval(goToNext, 8000);
    return () => clearInterval(interval);
  }, [isPaused, prefersReducedMotion, goToNext]);

  const activeTestimonial = TESTIMONIALS[activeIndex];

  return (
    <Box
      component="section"
      aria-roledescription="carousel"
      aria-label="Customer testimonials"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      sx={{
        py: { xs: 10, md: 14 },
        bgcolor: '#0a0a14',
        position: 'relative',
      }}
    >
      {/* Subtle background glow */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(154, 138, 200, 0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="md" sx={{ position: 'relative' }}>
        <Typography
          variant="h2"
          sx={{
            textAlign: 'center',
            fontSize: { xs: 28, md: 36 },
            fontWeight: 700,
            color: 'white',
            mb: 8,
            letterSpacing: '-0.02em',
          }}
        >
          What Our Users Say
        </Typography>

        {/* Testimonial Card */}
        <Box
          role="group"
          aria-roledescription="slide"
          aria-label={`${activeIndex + 1} of ${TESTIMONIALS.length}`}
          sx={{
            textAlign: 'center',
            position: 'relative',
          }}
        >
          {/* Quote Icon */}
          <FormatQuoteIcon
            sx={{
              fontSize: 48,
              color: 'rgba(154, 138, 200, 0.3)',
              mb: 3,
            }}
          />

          {/* Quote Text */}
          <Typography
            sx={{
              fontSize: { xs: 18, md: 22 },
              fontStyle: 'italic',
              lineHeight: 1.7,
              color: 'rgba(255, 255, 255, 0.9)',
              mb: 4,
              maxWidth: 700,
              mx: 'auto',
            }}
          >
            "{activeTestimonial.quote}"
          </Typography>

          {/* Author */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            {/* Avatar placeholder */}
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                bgcolor: 'rgba(154, 138, 200, 0.2)',
                border: '2px solid rgba(154, 138, 200, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: 18,
                fontWeight: 600,
              }}
              aria-hidden="true"
            >
              {activeTestimonial.initials}
            </Box>

            <Box sx={{ textAlign: 'left' }}>
              <Typography
                sx={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                {activeTestimonial.author}
              </Typography>
              <Typography
                sx={{
                  fontSize: 14,
                  color: 'rgba(255, 255, 255, 0.5)',
                }}
              >
                {activeTestimonial.role}, {activeTestimonial.company}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Navigation */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            mt: 6,
          }}
        >
          {/* Previous Button */}
          <IconButton
            onClick={goToPrev}
            aria-label="Previous testimonial"
            sx={{
              color: 'rgba(255, 255, 255, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                color: 'white',
              },
              '&:focus': {
                outline: '2px solid #4FB3CE',
                outlineOffset: 2,
              },
            }}
          >
            <ChevronLeftIcon />
          </IconButton>

          {/* Dots */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
            }}
            role="tablist"
            aria-label="Testimonial slides"
          >
            {TESTIMONIALS.map((_, index) => (
              <Box
                key={index}
                component="button"
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={`Go to testimonial ${index + 1}`}
                onClick={() => goToSlide(index)}
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  border: 'none',
                  bgcolor: index === activeIndex
                    ? '#9A8AC8'
                    : 'rgba(255, 255, 255, 0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: index === activeIndex
                      ? '#9A8AC8'
                      : 'rgba(255, 255, 255, 0.4)',
                  },
                  '&:focus': {
                    outline: '2px solid #4FB3CE',
                    outlineOffset: 2,
                  },
                }}
              />
            ))}
          </Box>

          {/* Next Button */}
          <IconButton
            onClick={goToNext}
            aria-label="Next testimonial"
            sx={{
              color: 'rgba(255, 255, 255, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                color: 'white',
              },
              '&:focus': {
                outline: '2px solid #4FB3CE',
                outlineOffset: 2,
              },
            }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>

        {/* Screen reader live region */}
        <Box
          aria-live="polite"
          aria-atomic="true"
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          Showing testimonial {activeIndex + 1} of {TESTIMONIALS.length}:
          {activeTestimonial.author}, {activeTestimonial.role}
        </Box>
      </Container>
    </Box>
  );
}
