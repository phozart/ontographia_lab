// pages/terms.js
// Terms of Service page

import { Box, Typography } from '@mui/material';
import PageLayout, { PageSection, SKY } from '../components/landing/PageLayout';

export default function TermsPage() {
  return (
    <PageLayout
      title="Terms of Service"
      description="Terms and conditions for using Ontographia Lab diagramming services."
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
        Terms of Service
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

      <PageSection title="Agreement to Terms">
        <Typography paragraph>
          By accessing or using Ontographia Lab ("the Service"), you agree to be bound by these Terms of Service.
          If you disagree with any part of these terms, you may not access the Service.
        </Typography>
      </PageSection>

      <PageSection title="Description of Service">
        <Typography paragraph>
          Ontographia Lab is a web-based diagramming application that allows users to create, edit,
          and share diagrams. The Service includes features for collaboration, export, and diagram management.
        </Typography>
      </PageSection>

      <PageSection title="User Accounts">
        <Typography paragraph>
          To access certain features, you must create an account. You are responsible for:
        </Typography>
        <Box component="ul" sx={{ pl: 3 }}>
          {[
            'Maintaining the confidentiality of your account credentials',
            'All activities that occur under your account',
            'Providing accurate and complete registration information',
            'Promptly updating your information if it changes',
          ].map((item, i) => (
            <Typography component="li" key={i} sx={{ mb: 1 }}>
              {item}
            </Typography>
          ))}
        </Box>
        <Typography paragraph sx={{ mt: 2 }}>
          You must be at least 13 years old to use the Service. If you are under 18, you must have
          parental consent to use the Service.
        </Typography>
      </PageSection>

      <PageSection title="Acceptable Use">
        <Typography paragraph>
          You agree not to use the Service to:
        </Typography>
        <Box component="ul" sx={{ pl: 3 }}>
          {[
            'Violate any applicable laws or regulations',
            'Infringe on intellectual property rights of others',
            'Upload malicious code, viruses, or harmful content',
            'Attempt to gain unauthorized access to other accounts or systems',
            'Harass, abuse, or harm other users',
            'Send spam or unsolicited communications',
            'Interfere with the proper functioning of the Service',
            'Create diagrams containing illegal, defamatory, or harmful content',
          ].map((item, i) => (
            <Typography component="li" key={i} sx={{ mb: 1 }}>
              {item}
            </Typography>
          ))}
        </Box>
      </PageSection>

      <PageSection title="Your Content">
        <Typography paragraph sx={{ fontWeight: 600, color: 'white', mb: 1 }}>
          Ownership
        </Typography>
        <Typography paragraph>
          You retain ownership of all diagrams and content you create using the Service.
          By using the Service, you grant us a limited license to store, display, and transmit
          your content as necessary to provide the Service.
        </Typography>

        <Typography paragraph sx={{ fontWeight: 600, color: 'white', mb: 1, mt: 3 }}>
          Responsibility
        </Typography>
        <Typography paragraph>
          You are solely responsible for the content you create and share. You represent that you
          have all necessary rights to the content and that it does not violate these Terms.
        </Typography>
      </PageSection>

      <PageSection title="Intellectual Property">
        <Typography paragraph>
          The Service, including its design, features, and content (excluding user-generated content),
          is owned by Ontographia Lab and protected by intellectual property laws. You may not copy,
          modify, distribute, or reverse engineer any part of the Service without our written permission.
        </Typography>
      </PageSection>

      <PageSection title="Privacy">
        <Typography paragraph>
          Your use of the Service is also governed by our Privacy Policy, which describes how we
          collect, use, and protect your personal information. By using the Service, you consent
          to our data practices as described in the Privacy Policy.
        </Typography>
      </PageSection>

      <PageSection title="Service Availability">
        <Typography paragraph>
          We strive to provide reliable service but cannot guarantee uninterrupted access. We may:
        </Typography>
        <Box component="ul" sx={{ pl: 3 }}>
          {[
            'Perform maintenance that temporarily affects availability',
            'Modify or discontinue features with reasonable notice',
            'Suspend accounts that violate these Terms',
          ].map((item, i) => (
            <Typography component="li" key={i} sx={{ mb: 1 }}>
              {item}
            </Typography>
          ))}
        </Box>
      </PageSection>

      <PageSection title="Limitation of Liability">
        <Typography paragraph>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, ONTOGRAPHIA LAB SHALL NOT BE LIABLE FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
          PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY.
        </Typography>
        <Typography paragraph>
          Our total liability for any claims arising from or related to the Service shall not
          exceed the amount you paid us in the twelve months prior to the claim.
        </Typography>
      </PageSection>

      <PageSection title="Indemnification">
        <Typography paragraph>
          You agree to indemnify and hold harmless Ontographia Lab, its officers, directors,
          employees, and agents from any claims, damages, losses, or expenses arising from
          your use of the Service or violation of these Terms.
        </Typography>
      </PageSection>

      <PageSection title="Dispute Resolution">
        <Typography paragraph>
          Any disputes arising from these Terms or your use of the Service shall be resolved
          through binding arbitration, except where prohibited by law. You agree to resolve
          disputes on an individual basis and waive any right to participate in class actions.
        </Typography>
      </PageSection>

      <PageSection title="Changes to Terms">
        <Typography paragraph>
          We may update these Terms from time to time. We will notify you of material changes
          by email or through the Service. Your continued use after changes take effect
          constitutes acceptance of the new Terms.
        </Typography>
      </PageSection>

      <PageSection title="Termination">
        <Typography paragraph>
          You may terminate your account at any time by contacting us. We may terminate or
          suspend your account for violations of these Terms or for any other reason with
          reasonable notice, except in cases of severe violations.
        </Typography>
        <Typography paragraph>
          Upon termination, your right to use the Service ceases immediately. You may export
          your data before termination.
        </Typography>
      </PageSection>

      <PageSection title="Governing Law">
        <Typography paragraph>
          These Terms shall be governed by and construed in accordance with applicable laws,
          without regard to conflict of law principles.
        </Typography>
      </PageSection>

      <PageSection title="Contact">
        <Typography paragraph>
          If you have questions about these Terms, please contact us at:
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
            Email: legal@ontographia.com
          </Typography>
        </Box>
      </PageSection>
    </PageLayout>
  );
}
