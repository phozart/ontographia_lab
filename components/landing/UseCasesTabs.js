// components/landing/UseCasesTabs.js
// Tabbed interface showing different diagram types

import { useState, useRef, useEffect } from 'react';
import { Box, Container, Typography, Button } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Link from 'next/link';

const SKY = {
  deepCyan: '#4FB3CE',
  steelBlue: '#6A9FC9',
  deepLavender: '#9A8AC8',
  mauveRose: '#C490B0',
  warmPeach: '#E8A99A',
  goldenHour: '#F0D98A',
};

const USE_CASES = [
  {
    id: 'bpmn',
    label: 'BPMN',
    title: 'Business Process Modeling',
    description: 'Design and document your business processes with industry-standard BPMN 2.0 notation.',
    features: [
      'Standard BPMN 2.0 notation',
      'Swimlanes and pools',
      'Import/export to Camunda, Activiti',
      'Process simulation ready',
    ],
    color: SKY.deepCyan,
    ctaLabel: 'Try BPMN Diagrams',
  },
  {
    id: 'uml',
    label: 'UML',
    title: 'Unified Modeling Language',
    description: 'Create class diagrams, sequence diagrams, use cases, and more with full UML 2.5 support.',
    features: [
      'All 14 UML diagram types',
      'Class, sequence, activity diagrams',
      'Code generation ready',
      'Reverse engineering support',
    ],
    color: SKY.deepLavender,
    ctaLabel: 'Try UML Diagrams',
  },
  {
    id: 'erd',
    label: 'ERD',
    title: 'Entity Relationship Diagrams',
    description: 'Design database schemas with powerful ERD tools supporting multiple notations.',
    features: [
      'Chen and Crow\'s Foot notation',
      'Auto-generate from SQL',
      'Export to DDL scripts',
      'Foreign key visualization',
    ],
    color: SKY.mauveRose,
    ctaLabel: 'Try ERD Diagrams',
  },
  {
    id: 'mindmap',
    label: 'Mind Maps',
    title: 'Mind Mapping & Ideation',
    description: 'Brainstorm and organize ideas with intuitive mind mapping tools.',
    features: [
      'Rapid keyboard creation',
      'Auto-layout and balancing',
      'Collapsible branches',
      'Export to outline format',
    ],
    color: SKY.warmPeach,
    ctaLabel: 'Try Mind Maps',
  },
  {
    id: 'architecture',
    label: 'Architecture',
    title: 'Enterprise Architecture',
    description: 'Document system architecture with TOGAF, C4, and cloud architecture diagrams.',
    features: [
      'TOGAF compliant stencils',
      'C4 model support',
      'AWS/Azure/GCP icons',
      'Layered architecture views',
    ],
    color: SKY.goldenHour,
    ctaLabel: 'Try Architecture Diagrams',
  },
];

// Placeholder diagram preview
function DiagramPreview({ useCase }) {
  return (
    <Box
      sx={{
        width: '100%',
        aspectRatio: '16/10',
        bgcolor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 3,
        border: `1px solid ${useCase.color}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative elements to simulate diagram */}
      <Box
        sx={{
          position: 'absolute',
          inset: 40,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 3,
        }}
      >
        {[...Array(6)].map((_, i) => (
          <Box
            key={i}
            sx={{
              bgcolor: `${useCase.color}${i % 2 === 0 ? '30' : '15'}`,
              borderRadius: 2,
              border: `1px solid ${useCase.color}40`,
            }}
          />
        ))}
      </Box>

      {/* Center label */}
      <Typography
        sx={{
          position: 'relative',
          zIndex: 1,
          fontSize: 14,
          color: 'rgba(255, 255, 255, 0.4)',
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}
      >
        {useCase.label} Preview
      </Typography>
    </Box>
  );
}

export default function UseCasesTabs() {
  const [activeTab, setActiveTab] = useState(0);
  const tabsRef = useRef(null);

  const handleKeyDown = (e, index) => {
    let newIndex = index;

    if (e.key === 'ArrowRight') {
      newIndex = (index + 1) % USE_CASES.length;
    } else if (e.key === 'ArrowLeft') {
      newIndex = (index - 1 + USE_CASES.length) % USE_CASES.length;
    } else if (e.key === 'Home') {
      newIndex = 0;
    } else if (e.key === 'End') {
      newIndex = USE_CASES.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    setActiveTab(newIndex);

    // Focus the new tab
    const tabs = tabsRef.current?.querySelectorAll('[role="tab"]');
    tabs?.[newIndex]?.focus();
  };

  const activeUseCase = USE_CASES[activeTab];

  return (
    <Box
      component="section"
      aria-labelledby="use-cases-heading"
      sx={{
        py: { xs: 10, md: 14 },
        bgcolor: '#0d0d18',
      }}
    >
      <Container maxWidth="lg">
        <Typography
          id="use-cases-heading"
          variant="h2"
          sx={{
            textAlign: 'center',
            fontSize: { xs: 28, md: 36 },
            fontWeight: 700,
            color: 'white',
            mb: 2,
            letterSpacing: '-0.02em',
          }}
        >
          One Tool for Every Diagram
        </Typography>

        <Typography
          sx={{
            textAlign: 'center',
            fontSize: 16,
            color: 'rgba(255, 255, 255, 0.5)',
            mb: 6,
            maxWidth: 500,
            mx: 'auto',
          }}
        >
          From business processes to system architecture, Ontographia has you covered
        </Typography>

        {/* Tabs */}
        <Box
          ref={tabsRef}
          role="tablist"
          aria-label="Diagram types"
          sx={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 1,
            mb: 6,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            pb: 0,
          }}
        >
          {USE_CASES.map((useCase, index) => (
            <Box
              key={useCase.id}
              component="button"
              role="tab"
              id={`tab-${useCase.id}`}
              aria-selected={activeTab === index}
              aria-controls={`panel-${useCase.id}`}
              tabIndex={activeTab === index ? 0 : -1}
              onClick={() => setActiveTab(index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              sx={{
                px: { xs: 2, md: 3 },
                py: 2,
                fontSize: { xs: 14, md: 16 },
                fontWeight: 500,
                color: activeTab === index ? 'white' : 'rgba(255, 255, 255, 0.5)',
                bgcolor: 'transparent',
                border: 'none',
                borderBottom: activeTab === index
                  ? `3px solid ${useCase.color}`
                  : '3px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                mb: '-1px',
                '&:hover': {
                  color: 'rgba(255, 255, 255, 0.9)',
                },
                '&:focus': {
                  outline: `2px solid ${useCase.color}`,
                  outlineOffset: -2,
                },
              }}
            >
              {useCase.label}
            </Box>
          ))}
        </Box>

        {/* Tab Panel */}
        <Box
          role="tabpanel"
          id={`panel-${activeUseCase.id}`}
          aria-labelledby={`tab-${activeUseCase.id}`}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: { xs: 4, md: 6 },
            alignItems: 'center',
          }}
        >
          {/* Diagram Preview */}
          <DiagramPreview useCase={activeUseCase} />

          {/* Content */}
          <Box>
            <Typography
              variant="h3"
              sx={{
                fontSize: { xs: 24, md: 28 },
                fontWeight: 600,
                color: 'white',
                mb: 2,
              }}
            >
              {activeUseCase.title}
            </Typography>

            <Typography
              sx={{
                fontSize: 16,
                lineHeight: 1.7,
                color: 'rgba(255, 255, 255, 0.7)',
                mb: 4,
              }}
            >
              {activeUseCase.description}
            </Typography>

            <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mb: 4 }}>
              {activeUseCase.features.map((feature, i) => (
                <Box
                  component="li"
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    mb: 1.5,
                  }}
                >
                  <CheckIcon
                    sx={{
                      fontSize: 18,
                      color: activeUseCase.color,
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: 15,
                      color: 'rgba(255, 255, 255, 0.8)',
                    }}
                  >
                    {feature}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Button
              component={Link}
              href="/login"
              endIcon={<ArrowForwardIcon />}
              sx={{
                px: 3,
                py: 1.5,
                fontSize: 15,
                fontWeight: 600,
                color: 'white',
                bgcolor: `${activeUseCase.color}30`,
                border: `1px solid ${activeUseCase.color}50`,
                borderRadius: 2,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: `${activeUseCase.color}40`,
                },
                '&:focus': {
                  outline: `2px solid ${activeUseCase.color}`,
                  outlineOffset: 2,
                },
              }}
            >
              {activeUseCase.ctaLabel}
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
