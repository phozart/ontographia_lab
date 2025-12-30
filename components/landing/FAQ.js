// components/landing/FAQ.js
// Accessible FAQ accordion component

import { useState } from 'react';
import { Box, Container, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const FAQ_ITEMS = [
  {
    id: 'free-plan',
    question: 'Is there a free plan?',
    answer: 'Yes! Ontographia offers a free forever plan that includes unlimited diagrams, basic collaboration features, and export to PNG/SVG. Perfect for individuals and small teams getting started.',
  },
  {
    id: 'import',
    question: 'Can I import from Lucidchart or Visio?',
    answer: 'Ontographia supports importing from multiple platforms:\n\n• Lucidchart (via .lucid export)\n• Microsoft Visio (.vsdx)\n• Draw.io / diagrams.net (.drawio, .xml)\n• Standard formats (SVG, PNG with embedded data)\n\nYour existing diagrams can be migrated in just a few clicks.',
  },
  {
    id: 'security',
    question: 'Is my data secure?',
    answer: 'Absolutely. We take security seriously:\n\n• All data is encrypted in transit (TLS 1.3) and at rest (AES-256)\n• SOC 2 Type II certified\n• GDPR compliant with EU data residency options\n• SSO/SAML support for enterprise\n• Regular third-party security audits',
  },
  {
    id: 'offline',
    question: 'Can I work offline?',
    answer: 'Yes, Ontographia works offline with our desktop app. Changes sync automatically when you reconnect. The web app also caches your recent diagrams for viewing when offline.',
  },
  {
    id: 'collaboration',
    question: 'How does real-time collaboration work?',
    answer: 'Multiple team members can edit the same diagram simultaneously. You\'ll see each person\'s cursor and changes in real-time. Features include:\n\n• Live cursors with names\n• Comments and @mentions\n• Change history with restore\n• Presence indicators showing who\'s viewing',
  },
  {
    id: 'export',
    question: 'What export formats are supported?',
    answer: 'Ontographia supports extensive export options:\n\n• Images: PNG, SVG, JPEG\n• Documents: PDF (with layers)\n• Data: JSON, XML\n• Integration: Embed links, Confluence, Notion\n• Print-ready: High DPI exports for printing',
  },
];

function FAQItem({ item, isOpen, onToggle }) {
  const panelId = `faq-panel-${item.id}`;
  const buttonId = `faq-button-${item.id}`;

  return (
    <Box
      sx={{
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box
        component="button"
        id={buttonId}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 3,
          px: 0,
          border: 'none',
          bgcolor: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.02)',
          },
          '&:focus': {
            outline: '2px solid #4FB3CE',
            outlineOffset: -2,
          },
        }}
      >
        <Typography
          sx={{
            fontSize: { xs: 16, md: 18 },
            fontWeight: 500,
            color: 'white',
            pr: 2,
          }}
        >
          {item.question}
        </Typography>
        <ExpandMoreIcon
          sx={{
            color: 'rgba(255, 255, 255, 0.5)',
            transition: 'transform 0.3s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />
      </Box>

      <Box
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        sx={{
          overflow: 'hidden',
          maxHeight: isOpen ? 500 : 0,
          opacity: isOpen ? 1 : 0,
          transition: 'all 0.3s ease',
        }}
      >
        <Typography
          sx={{
            pb: 3,
            fontSize: 15,
            lineHeight: 1.8,
            color: 'rgba(255, 255, 255, 0.7)',
            whiteSpace: 'pre-line',
          }}
        >
          {item.answer}
        </Typography>
      </Box>
    </Box>
  );
}

export default function FAQ() {
  const [openItems, setOpenItems] = useState(new Set());

  const toggleItem = (id) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Box
      component="section"
      aria-labelledby="faq-heading"
      sx={{
        py: { xs: 10, md: 14 },
        bgcolor: '#0a0a14',
      }}
    >
      <Container maxWidth="md">
        <Typography
          id="faq-heading"
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
          Frequently Asked Questions
        </Typography>

        <Typography
          sx={{
            textAlign: 'center',
            fontSize: 16,
            color: 'rgba(255, 255, 255, 0.5)',
            mb: 6,
          }}
        >
          Everything you need to know to get started
        </Typography>

        <Box
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 3,
            border: '1px solid rgba(255, 255, 255, 0.06)',
            px: { xs: 3, md: 4 },
          }}
        >
          {FAQ_ITEMS.map((item) => (
            <FAQItem
              key={item.id}
              item={item}
              isOpen={openItems.has(item.id)}
              onToggle={() => toggleItem(item.id)}
            />
          ))}
        </Box>
      </Container>
    </Box>
  );
}
