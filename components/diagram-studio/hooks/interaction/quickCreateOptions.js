// components/diagram-studio/hooks/interaction/quickCreateOptions.js
// Decides which stencil/label the edge-handle "+" quick-create should use.

/**
 * Mind-map nodes follow the hierarchy (Central -> Main -> Sub, same as Tab), so no stencil
 * is forced and useQuickCreate picks the child type. Other packs clone the source stencil.
 *
 * @returns {{ stencil: Object|null, label: string }}
 */
export function resolveQuickCreateOptions(sourceElement, stencil) {
  if (sourceElement?.packId === 'mind-map') {
    return { stencil: null, label: '' };
  }
  return {
    stencil: stencil ? { ...stencil, packId: sourceElement.packId } : null,
    label: stencil?.defaultLabel ?? stencil?.name ?? 'New Node',
  };
}
