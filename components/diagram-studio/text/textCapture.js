// components/diagram-studio/text/textCapture.js
// Server-side rendering hook (spike: diagram_show fidelity, ADR-0009). When a TextCaptureContext value is provided, TextBlock
// does not draw HTML: it hands its layout to the capture function and renders a placeholder <i data-cap="n">. lib/render/packArt.js
// renders a pack's renderNode() with react-dom/server inside this provider, keeps the pack's own drawing and redraws every text
// block as SVG <text> from the same layout (lib/text/svg.js). On the canvas no provider exists, so nothing changes there.

import { createContext } from 'react';

export const TextCaptureContext = createContext(null);
