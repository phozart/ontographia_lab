// pages/privacy.js
// Privacy Policy page

import { Box, Typography } from '@mui/material';
import PageLayout, { PageSection, SKY } from '../components/landing/PageLayout';

export default function PrivacyPage() {
  return (
    <PageLayout
      title="Privacy Policy"
      description="How Ontographia Lab collects, uses, and protects your personal information."
    >
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: 32, md: 42 },
          fontWeight: 700,
          color: 'white',
          mb: 2,
        }}
      >
        Privacy Policy
      </Typography>
      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.5)',
          mb: 6,
          fontSize: 14,
        }}
      >
        Last updated: December 2024
      </Typography>

      <PageSection title="Overview">
        <Typography paragraph>
          At Ontographia Lab, we take your privacy seriously. This Privacy Policy explains how we collect,
          use, disclose, and safeguard your information when you use our diagramming application and related services.
        </Typography>
        <Typography paragraph>
          We believe in transparency and want you to understand exactly what data we collect and why.
          If you have questions, please don't hesitate to contact us.
        </Typography>
      </PageSection>

      <PageSection title="Information We Collect">
        <Typography paragraph sx={{ fontWeight: 600, color: 'white', mb: 1 }}>
          Account Information
        </Typography>
        <Typography paragraph>
          When you create an account, we collect your email address, name, and any profile information
          you choose to provide. If you sign up using a third-party service (like Google), we receive
          basic profile information from that service.
        </Typography>

        <Typography paragraph sx={{ fontWeight: 600, color: 'white', mb: 1, mt: 3 }}>
          Diagram Data
        </Typography>
        <Typography paragraph>
          We store the diagrams you create, including all elements, connections, text, and styling.
          This data is necessary to provide our service and enable collaboration features.
        </Typography>

        <Typography paragraph sx={{ fontWeight: 600, color: 'white', mb: 1, mt: 3 }}>
          Usage Information
        </Typography>
        <Typography paragraph>
          We collect information about how you use Ontographia Lab, including features used,
          time spent, and interaction patterns. This helps us improve the product and user experience.
        </Typography>

        <Typography paragraph sx={{ fontWeight: 600, color: 'white', mb: 1, mt: 3 }}>
          Technical Data
        </Typography>
        <Typography paragraph>
          We automatically collect certain technical information, including your IP address, browser type,
          device information, and operating system. This data helps us maintain security and optimize performance.
        </Typography>
      </PageSection>

      <PageSection title="How We Use Your Information">
        <Box component="ul" sx={{ pl: 3 }}>
          {[
            'Provide, maintain, and improve our diagramming services',
            'Enable collaboration features and sharing functionality',
            'Send you service-related communications and updates',
            'Respond to your questions and support requests',
            'Analyze usage patterns to enhance user experience',
            'Detect and prevent fraud, abuse, and security issues',
            'Comply with legal obligations',
          ].map((item, i) => (
            <Typography component="li" key={i} sx={{ mb: 1 }}>
              {item}
            </Typography>
          ))}
        </Box>
      </PageSection>

      <PageSection title="Data Sharing">
        <Typography paragraph>
          We do not sell your personal information. We may share your data only in these circumstances:
        </Typography>
        <Box component="ul" sx={{ pl: 3 }}>
          {[
            'With your consent or at your direction',
            'With service providers who assist in operating our platform (hosting, analytics)',
            'When required by law or to protect rights and safety',
            'In connection with a merger, acquisition, or sale of assets',
          ].map((item, i) => (
            <Typography component="li" key={i} sx={{ mb: 1 }}>
              {item}
            </Typography>
          ))}
        </Box>
      </PageSection>

      <PageSection title="Data Security">
        <Typography paragraph>
          We implement industry-standard security measures to protect your information, including:
        </Typography>
        <Box component="ul" sx={{ pl: 3 }}>
          {[
            'Encryption of data in transit (TLS/SSL) and at rest',
            'Regular security assessments and penetration testing',
            'Access controls and authentication mechanisms',
            'Secure data centers with physical security measures',
          ].map((item, i) => (
            <Typography component="li" key={i} sx={{ mb: 1 }}>
              {item}
            </Typography>
          ))}
        </Box>
      </PageSection>

      <PageSection title="Your Rights">
        <Typography paragraph>
          Depending on your location, you may have certain rights regarding your personal information:
        </Typography>
        <Box component="ul" sx={{ pl: 3 }}>
          {[
            'Access and receive a copy of your data',
            'Correct inaccurate information',
            'Request deletion of your data',
            'Object to or restrict certain processing',
            'Data portability (receive your data in a portable format)',
            'Withdraw consent at any time',
          ].map((item, i) => (
            <Typography component="li" key={i} sx={{ mb: 1 }}>
              {item}
            </Typography>
          ))}
        </Box>
        <Typography paragraph sx={{ mt: 2 }}>
          To exercise these rights, please contact us at privacy@ontographia.com.
        </Typography>
      </PageSection>

      <PageSection title="Data Retention">
        <Typography paragraph>
          We retain your information for as long as your account is active or as needed to provide services.
          If you delete your account, we will delete or anonymize your data within 30 days, except where
          retention is required by law.
        </Typography>
      </PageSection>

      <PageSection title="Cookies">
        <Typography paragraph>
          We use cookies and similar technologies to maintain your session, remember your preferences,
          and understand how you use our service. You can control cookies through your browser settings,
          but some features may not function properly without them.
        </Typography>
      </PageSection>

      <PageSection title="Children's Privacy">
        <Typography paragraph>
          Ontographia Lab is not intended for children under 13. We do not knowingly collect personal
          information from children. If you believe we have collected such information, please contact us
          so we can delete it.
        </Typography>
      </PageSection>

      <PageSection title="Changes to This Policy">
        <Typography paragraph>
          We may update this Privacy Policy from time to time. We will notify you of significant changes
          by email or through the application. Your continued use after changes take effect constitutes
          acceptance of the updated policy.
        </Typography>
      </PageSection>

      <PageSection title="Contact Us">
        <Typography paragraph>
          If you have questions about this Privacy Policy or our data practices, please contact us at:
        </Typography>
        <Box
          sx={{
            mt: 2,
            p: 3,
            borderRadius: 2,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <Typography sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
            Ontographia Lab
          </Typography>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            Email: privacy@ontographia.com
          </Typography>
        </Box>
      </PageSection>
    </PageLayout>
  );
}
