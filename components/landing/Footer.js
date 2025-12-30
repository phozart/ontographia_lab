// components/landing/Footer.js
// Professional footer with sitemap navigation

import { Box, Container, Typography, Grid, Link as MuiLink } from '@mui/material';
import Link from 'next/link';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import GitHubIcon from '@mui/icons-material/GitHub';
import { LogoIcon } from '../ui/Logo';

// Ethereal Sky Palette
const SKY = {
  deepCyan: '#4FB3CE',
  steelBlue: '#6A9FC9',
  deepLavender: '#9A8AC8',
  mauveRose: '#C490B0',
  warmPeach: '#E8A99A',
  goldenHour: '#F0D98A',
};

const FOOTER_LINKS = {
  product: {
    title: 'Product',
    links: [
      { label: 'Overview', href: '/product' },
      { label: 'Features', href: '/product#features' },
      { label: 'Diagram Types', href: '/product#diagrams' },
      { label: 'Collaboration', href: '/product#collaboration' },
    ],
  },
  resources: {
    title: 'Resources',
    links: [
      { label: 'Getting Started', href: '/guide' },
      { label: 'User Guide', href: '/guide/basics' },
      { label: 'Keyboard Shortcuts', href: '/guide/shortcuts' },
      { label: 'Stencil Packs', href: '/guide/stencils' },
    ],
  },
  company: {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Roadmap', href: '/roadmap' },
      { label: 'Get Access', href: '/access' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  legal: {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
};

const SOCIAL_LINKS = [
  { icon: TwitterIcon, label: 'Twitter', href: 'https://twitter.com/ontographia' },
  { icon: LinkedInIcon, label: 'LinkedIn', href: 'https://linkedin.com/company/ontographia' },
  { icon: GitHubIcon, label: 'GitHub', href: 'https://github.com/ontographia' },
];

function FooterLinkColumn({ title, links }) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: 13,
          fontWeight: 600,
          color: 'rgba(255, 255, 255, 0.9)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          mb: 2.5,
        }}
      >
        {title}
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {links.map((link) => (
          <Box component="li" key={link.label} sx={{ mb: 1.5 }}>
            <Link href={link.href} passHref legacyBehavior>
              <MuiLink
                sx={{
                  fontSize: 14,
                  fontWeight: 400,
                  color: 'rgba(255, 255, 255, 0.5)',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    fontWeight: 500,
                    color: 'rgba(255, 255, 255, 0.8)',
                  },
                }}
              >
                {link.label}
              </MuiLink>
            </Link>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      role="contentinfo"
      sx={{
        position: 'relative',
        pt: { xs: 6, md: 8 },
        pb: 4,
        bgcolor: '#05050a',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {/* Gradient accent line at top */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          pointerEvents: 'none',
          background: `linear-gradient(90deg, transparent 10%, ${SKY.deepCyan}50, ${SKY.deepLavender}50, ${SKY.warmPeach}50, transparent 90%)`,
        }}
      />

      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 4, md: 6 }}>
          {/* Brand Column */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <LogoIcon size={28} />
              <Typography
                sx={{
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: `linear-gradient(90deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                ONTOGRAPHIA LAB
              </Typography>
            </Box>
            <Typography
              sx={{
                fontSize: 14,
                color: 'rgba(255, 255, 255, 0.45)',
                lineHeight: 1.7,
                maxWidth: 280,
                mb: 3,
              }}
            >
              Professional diagramming for modern teams. Visualize ideas, design systems, and collaborate in real-time.
            </Typography>

            {/* Social Links */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              {SOCIAL_LINKS.map((social) => (
                <MuiLink
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: 'rgba(255, 255, 255, 0.4)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: `${SKY.deepLavender}20`,
                      borderColor: `${SKY.deepLavender}40`,
                      color: 'white',
                    },
                    '&:focus': {
                      outline: `2px solid ${SKY.deepCyan}`,
                      outlineOffset: 2,
                    },
                  }}
                >
                  <social.icon sx={{ fontSize: 18 }} />
                </MuiLink>
              ))}
            </Box>
          </Grid>

          {/* Link Columns */}
          <Grid item xs={6} sm={3} md={2}>
            <FooterLinkColumn {...FOOTER_LINKS.product} />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FooterLinkColumn {...FOOTER_LINKS.resources} />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FooterLinkColumn {...FOOTER_LINKS.company} />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FooterLinkColumn {...FOOTER_LINKS.legal} />
          </Grid>
        </Grid>

        {/* Bottom Bar */}
        <Box
          sx={{
            mt: 6,
            pt: 3,
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography
            sx={{
              fontSize: 13,
              color: 'rgba(255, 255, 255, 0.3)',
            }}
          >
            © {currentYear} Ontographia Lab. All rights reserved.
          </Typography>

          <Box sx={{ display: 'flex', gap: 3 }}>
            {[
              { label: 'Privacy', href: '/privacy' },
              { label: 'Terms', href: '/terms' },
            ].map((link) => (
              <Link key={link.label} href={link.href} passHref legacyBehavior>
                <MuiLink
                  sx={{
                    fontSize: 13,
                    fontWeight: 400,
                    color: 'rgba(255, 255, 255, 0.3)',
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    '&:hover': {
                      fontWeight: 500,
                      color: 'rgba(255, 255, 255, 0.6)',
                    },
                  }}
                >
                  {link.label}
                </MuiLink>
              </Link>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
