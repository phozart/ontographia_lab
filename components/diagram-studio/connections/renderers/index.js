// components/diagram-studio/connections/renderers/index.js
// Export all line type renderers

export { default as StraightLineRenderer } from './StraightLineRenderer';
export { default as OrthogonalLineRenderer } from './OrthogonalLineRenderer';
export { default as CurvedLineRenderer } from './CurvedLineRenderer';
export { default as ArcLineRenderer } from './ArcLineRenderer';
export { default as SmartLineRenderer } from './SmartLineRenderer';

/**
 * Map of line style to renderer component
 */
export const RENDERER_MAP = {
  straight: 'StraightLineRenderer',
  step: 'OrthogonalLineRenderer',
  'step-sharp': 'OrthogonalLineRenderer',
  curved: 'CurvedLineRenderer',
  arc: 'ArcLineRenderer',
  smart: 'SmartLineRenderer',
};

/**
 * Get renderer component for a line style
 * @param {string} lineStyle
 * @returns {Function}
 */
export function getRenderer(lineStyle) {
  switch (lineStyle) {
    case 'straight':
      return require('./StraightLineRenderer').default;
    case 'step':
      return require('./OrthogonalLineRenderer').default;
    case 'step-sharp':
      return require('./OrthogonalLineRenderer').default;
    case 'curved':
      return require('./CurvedLineRenderer').default;
    case 'arc':
      return require('./ArcLineRenderer').default;
    case 'smart':
      return require('./SmartLineRenderer').default;
    default:
      return require('./CurvedLineRenderer').default;
  }
}
