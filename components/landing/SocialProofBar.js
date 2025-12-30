// components/landing/SocialProofBar.js
// Social proof section showing company logos

import { Box, Container, Typography } from '@mui/material';

// Placeholder logos - replace with actual company logos
const COMPANIES = [
  { name: 'TechCorp', placeholder: 'TC' },
  { name: 'DataFlow', placeholder: 'DF' },
  { name: 'CloudSys', placeholder: 'CS' },
  { name: 'DevOps Inc', placeholder: 'DO' },
  { name: 'ArchitectPro', placeholder: 'AP' },
  { name: 'Enterprise Co', placeholder: 'EC' },
];

function PlaceholderLogo({ name, placeholder }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 100,
        height: 40,
        borderRadius: 1,
        bgcolor: 'rgba(255, 255, 255, 0.1)',
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: 1,
        transition: 'all 0.3s ease',
        '&:hover': {
          bgcolor: 'rgba(255, 255, 255, 0.15)',
          color: 'rgba(255, 255, 255, 0.8)',
        },
      }}
      role="img"
      aria-label={`${name} logo`}
    >
      {placeholder}
    </Box>
  );
}

export default function SocialProofBar() {
  return (
    <Box
      component="section"
      aria-label="Companies using Ontographia"
      sx={{
        py: 6,
        bgcolor: 'rgba(255, 255, 255, 0.02)',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      <Container maxWidth="lg">
        <Typography
          sx={{
            textAlign: 'center',
            mb: 4,
            fontSize: 13,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: 2,
            color: 'rgba(255, 255, 255, 0.4)',
          }}
        >
          Trusted by teams at
        </Typography>

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: { xs: 3, md: 6 },
          }}
        >
          {COMPANIES.map((company) => (
            <PlaceholderLogo
              key={company.name}
              name={company.name}
              placeholder={company.placeholder}
            />
          ))}
        </Box>
      </Container>
    </Box>
  );
}
