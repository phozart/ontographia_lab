// components/diagram-studio/LayersPanel.js
// Panel for managing diagram layers and groups

import { useState, useCallback } from 'react';
import { useDiagram, useDiagramSelection } from './DiagramContext';

// MUI Icons
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderIcon from '@mui/icons-material/Folder';
import LayersIcon from '@mui/icons-material/Layers';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';

export default function LayersPanel({ className = '' }) {
  const {
    layers,
    groups,
    elements,
    addLayer,
    updateLayer,
    removeLayer,
    groupElements,
    ungroupElements,
    updateElement,
  } = useDiagram();

  const { selectedElements, selection } = useDiagramSelection();
  const [editingLayerId, setEditingLayerId] = useState(null);
  const [newLayerName, setNewLayerName] = useState('');

  // Toggle layer visibility
  const toggleVisibility = useCallback((layerId) => {
    const layer = layers.find(l => l.id === layerId);
    if (layer) {
      updateLayer(layerId, { visible: !layer.visible });
    }
  }, [layers, updateLayer]);

  // Toggle layer lock
  const toggleLock = useCallback((layerId) => {
    const layer = layers.find(l => l.id === layerId);
    if (layer) {
      updateLayer(layerId, { locked: !layer.locked });
    }
  }, [layers, updateLayer]);

  // Add new layer
  const handleAddLayer = useCallback(() => {
    const name = newLayerName.trim() || `Layer ${layers.length + 1}`;
    addLayer({ name });
    setNewLayerName('');
  }, [addLayer, layers.length, newLayerName]);

  // Rename layer
  const handleRenameLayer = useCallback((layerId, name) => {
    updateLayer(layerId, { name });
    setEditingLayerId(null);
  }, [updateLayer]);

  // Delete layer
  const handleDeleteLayer = useCallback((layerId) => {
    if (layerId !== 'default') {
      removeLayer(layerId);
    }
  }, [removeLayer]);

  // Move selected elements to layer
  const moveToLayer = useCallback((layerId) => {
    selectedElements.forEach(el => {
      updateElement(el.id, { layerId });
    });
  }, [selectedElements, updateElement]);

  // Group selected elements
  const handleGroup = useCallback(() => {
    if (selection.nodeIds.length >= 2) {
      groupElements(selection.nodeIds);
    }
  }, [selection.nodeIds, groupElements]);

  // Ungroup selected elements
  const handleUngroup = useCallback(() => {
    const selectedWithGroups = selectedElements.filter(el => el.groupId);
    const groupIds = [...new Set(selectedWithGroups.map(el => el.groupId))];
    groupIds.forEach(groupId => ungroupElements(groupId));
  }, [selectedElements, ungroupElements]);

  // Count elements per layer
  const getLayerElementCount = useCallback((layerId) => {
    return elements.filter(el => (el.layerId || 'default') === layerId).length;
  }, [elements]);

  // Check if selected elements have groups
  const hasGroupedElements = selectedElements.some(el => el.groupId);

  return (
    <div className={`ds-layers-panel ${className}`}>
      {/* Header */}
      <div className="ds-layers-header">
        <LayersIcon fontSize="small" />
        <span>Layers & Groups</span>
      </div>

      {/* Layers Section */}
      <div className="ds-layers-section">
        <div className="ds-layers-section-header">
          <span>Layers</span>
          <button
            className="ds-layers-add-btn"
            onClick={handleAddLayer}
            title="Add Layer"
          >
            <AddIcon fontSize="small" />
          </button>
        </div>

        <div className="ds-layers-list">
          {layers
            .sort((a, b) => (b.order || 0) - (a.order || 0))
            .map(layer => (
              <div
                key={layer.id}
                className={`ds-layer-item ${layer.id === 'default' ? 'default' : ''}`}
              >
                {/* Visibility toggle */}
                <button
                  className="ds-layer-btn"
                  onClick={() => toggleVisibility(layer.id)}
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                >
                  {layer.visible ? (
                    <VisibilityIcon fontSize="small" />
                  ) : (
                    <VisibilityOffIcon fontSize="small" style={{ opacity: 0.4 }} />
                  )}
                </button>

                {/* Lock toggle */}
                <button
                  className="ds-layer-btn"
                  onClick={() => toggleLock(layer.id)}
                  title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                >
                  {layer.locked ? (
                    <LockIcon fontSize="small" />
                  ) : (
                    <LockOpenIcon fontSize="small" style={{ opacity: 0.4 }} />
                  )}
                </button>

                {/* Layer name */}
                {editingLayerId === layer.id ? (
                  <input
                    type="text"
                    className="ds-layer-name-input"
                    defaultValue={layer.name}
                    autoFocus
                    onBlur={(e) => handleRenameLayer(layer.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameLayer(layer.id, e.target.value);
                      if (e.key === 'Escape') setEditingLayerId(null);
                    }}
                  />
                ) : (
                  <span
                    className="ds-layer-name"
                    onDoubleClick={() => layer.id !== 'default' && setEditingLayerId(layer.id)}
                  >
                    {layer.name}
                    <span className="ds-layer-count">({getLayerElementCount(layer.id)})</span>
                  </span>
                )}

                {/* Delete button (not for default layer) */}
                {layer.id !== 'default' && (
                  <button
                    className="ds-layer-btn ds-layer-delete"
                    onClick={() => handleDeleteLayer(layer.id)}
                    title="Delete layer"
                  >
                    <DeleteIcon fontSize="small" />
                  </button>
                )}
              </div>
            ))}
        </div>

        {/* Move to layer */}
        {selectedElements.length > 0 && (
          <div className="ds-layers-move">
            <span>Move to:</span>
            <select
              onChange={(e) => moveToLayer(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>Select layer...</option>
              {layers.map(layer => (
                <option key={layer.id} value={layer.id}>{layer.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Groups Section */}
      <div className="ds-layers-section">
        <div className="ds-layers-section-header">
          <span>Groups</span>
        </div>

        {/* Group/Ungroup buttons */}
        <div className="ds-group-actions">
          <button
            className="ds-group-btn"
            onClick={handleGroup}
            disabled={selection.nodeIds.length < 2}
            title="Group selected elements (Ctrl+G)"
          >
            <FolderIcon fontSize="small" />
            <span>Group</span>
          </button>
          <button
            className="ds-group-btn"
            onClick={handleUngroup}
            disabled={!hasGroupedElements}
            title="Ungroup selected elements (Ctrl+Shift+G)"
          >
            <UnfoldMoreIcon fontSize="small" />
            <span>Ungroup</span>
          </button>
        </div>

        {/* Groups list */}
        <div className="ds-groups-list">
          {groups.length === 0 ? (
            <div className="ds-groups-empty">
              No groups yet
            </div>
          ) : (
            groups.map(group => (
              <div key={group.id} className="ds-group-item">
                <FolderIcon fontSize="small" />
                <span className="ds-group-name">{group.name}</span>
                <span className="ds-group-count">({group.elementIds?.length || 0})</span>
                <button
                  className="ds-layer-btn ds-layer-delete"
                  onClick={() => ungroupElements(group.id)}
                  title="Ungroup"
                >
                  <DeleteIcon fontSize="small" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
