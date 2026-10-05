// components/diagram-studio/properties/coordinates.js
// User-facing coordinates are canvas coordinates relative to the canvas origin
// (the center of the infinite canvas) - the same system the status bar shows.
// Elements store raw coordinates offset by INFINITE_CANVAS_OFFSET.

import { INFINITE_CANVAS_OFFSET } from '../utils/geometry';

export const toDisplayCoord = (raw) => Math.round((raw || 0) - INFINITE_CANVAS_OFFSET);
export const fromDisplayCoord = (display) => Math.round(display || 0) + INFINITE_CANVAS_OFFSET;
