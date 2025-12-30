// pages/contact.js
// Contact page

import { Box, Typography, TextField, Button, Grid } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import GitHubIcon from '@mui/icons-material/GitHub';
import PageLayout, { SKY } from '../components/landing/PageLayout';

function ContactCard({ icon: Icon, title, value, href, color }) {
  return (
    <Box
      component={href ? 'a' : 'div'}
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 3,
        borderRadius: 2,
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        textDecoration: 'none',
        transition: 'all 0.2s ease',
        cursor: href ? 'pointer' : 'default',
        '&:hover': href ? {
          background: 'rgba(255, 255, 255, 0.04)',
          borderColor: `${color}40`,
        } : {},
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${color}15`,
        }}
      >
        <Icon sx={{ fontSize: 22, color }} />
      </Box>
      <Box>
        <Typography sx={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.5)', mb: 0.25 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 15, color: 'white', fontWeight: 500 }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

export default function ContactPage() {
  return (
    <PageLayout
      title="Contact"
      description="Get in touch with the Ontographia Lab team."
      maxWidth="lg"
    >
      <Grid container spacing={6}>
        <Grid item xs={12} md={6}>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: 32, md: 42 },
              fontWeight: 700,
              color: 'white',
              mb: 3,
            }}
          >
            Get in Touch
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: 16,
              lineHeight: 1.8,
              mb: 5,
            }}
          >
            Have a question, suggestion, or just want to say hello? We'd love to hear from you.
            Our team typically responds within 24 hours.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <ContactCard
              icon={EmailIcon}
              title="Email"
              value="hello@ontographia.com"
              href="mailto:hello@ontographia.com"
              color={SKY.deepCyan}
            />
            <ContactCard
              icon={TwitterIcon}
              title="Twitter"
              value="@ontographia"
              href="https://twitter.com/ontographia"
              color={SKY.steelBlue}
            />
            <ContactCard
              icon={LinkedInIcon}
              title="LinkedIn"
              value="Ontographia Lab"
              href="https://linkedin.com/company/ontographia"
              color={SKY.deepLavender}
            />
            <ContactCard
              icon={GitHubIcon}
              title="GitHub"
              value="ontographia"
              href="https://github.com/ontographia"
              color={SKY.mauveRose}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box
            sx={{
              p: 4,
              borderRadius: 3,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <Typography
              sx={{
                fontSize: 20,
                fontWeight: 600,
                color: 'white',
                mb: 3,
              }}
            >
              Send a Message
            </Typography>

            <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Name"
                variant="outlined"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: SKY.deepCyan,
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.5)',
                    '&.Mui-focused': {
                      color: SKY.deepCyan,
                    },
                  },
                }}
              />
              <TextField
                label="Email"
                type="email"
                variant="outlined"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: SKY.deepCyan,
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.5)',
                    '&.Mui-focused': {
                      color: SKY.deepCyan,
                    },
                  },
                }}
              />
              <TextField
                label="Subject"
                variant="outlined"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: SKY.deepCyan,
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.5)',
                    '&.Mui-focused': {
                      color: SKY.deepCyan,
                    },
                  },
                }}
              />
              <TextField
                label="Message"
                variant="outlined"
                fullWidth
                multiline
                rows={5}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: SKY.deepCyan,
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.5)',
                    '&.Mui-focused': {
                      color: SKY.deepCyan,
                    },
                  },
                }}
              />
              <Button
                variant="contained"
                sx={{
                  background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                  color: 'white',
                  py: 1.5,
                  fontSize: 15,
                  fontWeight: 600,
                  borderRadius: 2,
                  textTransform: 'none',
                  '&:hover': {
                    background: `linear-gradient(135deg, ${SKY.steelBlue}, ${SKY.mauveRose})`,
                  },
                }}
              >
                Send Message
              </Button>
            </Box>

            <Typography
              sx={{
                mt: 3,
                fontSize: 13,
                color: 'rgba(255, 255, 255, 0.4)',
                textAlign: 'center',
              }}
            >
              We'll get back to you as soon as possible.
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* FAQ Teaser */}
      <Box
        sx={{
          mt: 10,
          textAlign: 'center',
          p: 5,
          borderRadius: 3,
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <Typography
          sx={{
            fontSize: 18,
            fontWeight: 600,
            color: 'white',
            mb: 2,
          }}
        >
          Looking for quick answers?
        </Typography>
        <Typography
          sx={{
            color: 'rgba(255, 255, 255, 0.5)',
            mb: 3,
          }}
        >
          Check out our documentation and guides for common questions and tutorials.
        </Typography>
        <Button
          href="/guide"
          variant="outlined"
          sx={{
            borderColor: 'rgba(255, 255, 255, 0.2)',
            color: 'rgba(255, 255, 255, 0.8)',
            px: 4,
            py: 1,
            fontSize: 14,
            borderRadius: 2,
            textTransform: 'none',
            '&:hover': {
              borderColor: SKY.deepCyan,
              background: 'rgba(79, 179, 206, 0.1)',
            },
          }}
        >
          View Documentation
        </Button>
      </Box>
    </PageLayout>
  );
}
