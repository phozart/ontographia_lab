// components/diagram-studio/ui/shapeSidebarLogic.js
// Pure helpers for the left-bar armed-tool state machine. The armed stencil is
// derived only from the context's `selectedStencil` (no local copy that can go
// stale after a placement clears it).

export function isStencilArmed(selectedStencil, shape) {
  if (!selectedStencil || !shape) return false;
  const shapeId = shape.stencilId || shape.id;
  return selectedStencil.id === shapeId && selectedStencil.packId === shape.packId;
}

/** 'arm' to select the shape for placement, 'disarm' to turn the tool off. */
export function quickShapeAction(selectedStencil, shape) {
  return isStencilArmed(selectedStencil, shape) ? 'disarm' : 'arm';
}
