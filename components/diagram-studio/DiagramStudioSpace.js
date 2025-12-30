// components/spaces/diagram-studio/DiagramStudioSpace.js
// Wrapper component for DiagramStudio when used as a space
// Provides the packRegistry and handles space-level configuration

import { useMemo } from 'react';
import DiagramStudio from './DiagramStudio';
import { createDefaultRegistry } from './packs';

export default function DiagramStudioSpace({ view, domainId, projectId, ...props }) {
  // Create pack registry once - includes all available stencil packs
  const packRegistry = useMemo(() => createDefaultRegistry(), []);

  return (
    <DiagramStudio
      packRegistry={packRegistry}
      profile="full-studio"
      {...props}
    />
  );
}
