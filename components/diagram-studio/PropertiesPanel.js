// components/diagram-studio/PropertiesPanel.js
// Right sidebar with element properties - vertical accordion sections

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useDiagram, useDiagramSelection } from './DiagramContext';

// MUI Icons
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';

// ============ ACCORDION SECTION ============

function AccordionSection({ title, defaultOpen = true, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="ds-accordion-section">
      <button
        className={`ds-accordion-header ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </button>
      {isOpen && (
        <div className="ds-accordion-content">
          {children}
        </div>
      )}
    </div>
  );
}

// ============ COMPONENT ============

export default function PropertiesPanel({
  packRegistry,
  profile,
  className = '',
  onClose,
}) {
  const { updateElement, updateConnection, removeElement, removeConnection } = useDiagram();
  const { selectedElements, selectedConnections, clearSelection } = useDiagramSelection();

  // Get the selected item (element or connection)
  const selectedItem = useMemo(() => {
    if (selectedElements.length === 1) return { type: 'element', item: selectedElements[0] };
    if (selectedConnections.length === 1) return { type: 'connection', item: selectedConnections[0] };
    return null;
  }, [selectedElements, selectedConnections]);

  // Get pack for selected element
  const pack = useMemo(() => {
    if (selectedItem?.type === 'element') {
      return packRegistry?.get?.(selectedItem.item.packId);
    }
    return null;
  }, [selectedItem, packRegistry]);

  // Get stencil definition
  const stencil = useMemo(() => {
    if (selectedItem?.type === 'element' && pack) {
      return pack.stencils?.find(s => s.id === selectedItem.item.type);
    }
    return null;
  }, [selectedItem, pack]);

  // Handle property change
  const handleChange = useCallback((field, value) => {
    if (!selectedItem) return;

    if (selectedItem.type === 'element') {
      updateElement(selectedItem.item.id, { [field]: value });
    } else {
      updateConnection(selectedItem.item.id, { [field]: value });
    }
  }, [selectedItem, updateElement, updateConnection]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (!selectedItem) return;

    if (selectedItem.type === 'element') {
      removeElement(selectedItem.item.id);
    } else {
      removeConnection(selectedItem.item.id);
    }
    clearSelection();
  }, [selectedItem, removeElement, removeConnection, clearSelection]);

  // Check if panel should show
  const showPanel = profile?.uiPolicy?.showRightPanel !== false;
  const readOnly = profile?.editingPolicy?.readOnly;
  const canEditProperties = profile?.editingPolicy?.canEditProperties !== false;
  const canDelete = profile?.editingPolicy?.canDelete !== false;

  if (!showPanel) return null;

  // Multi-select state
  if (selectedElements.length > 1 || selectedConnections.length > 1) {
    return (
      <div className={`ds-properties ${className}`}>
        <div className="ds-properties-header">
          <span className="ds-properties-title">Multiple Selection</span>
        </div>
        <div className="ds-properties-content">
          <div className="ds-properties-empty">
            <div className="ds-properties-empty-text">
              {selectedElements.length + selectedConnections.length} items selected
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!selectedItem) {
    return (
      <div className={`ds-properties ${className}`}>
        <div className="ds-properties-header">
          <span className="ds-properties-title">Properties</span>
        </div>
        <div className="ds-properties-content">
          <div className="ds-properties-empty">
            <div className="ds-properties-empty-icon">📋</div>
            <div className="ds-properties-empty-text">
              Select an element or connection to view its properties
            </div>
          </div>
        </div>
      </div>
    );
  }

  const item = selectedItem.item;
  const isElement = selectedItem.type === 'element';

  return (
    <div className={`ds-properties ${className}`}>
      {/* Header */}
      <div className="ds-properties-header">
        <span className="ds-properties-title">
          {isElement ? (stencil?.name || item.type) : 'Connection'}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!readOnly && canDelete && (
            <button
              onClick={handleDelete}
              style={{
                padding: '4px 8px',
                fontSize: 12,
                color: '#ef4444',
                background: 'transparent',
                border: '1px solid #ef4444',
                borderRadius: 4,
                cursor: 'pointer',
              }}
              title="Delete"
            >
              Delete
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="ds-properties-close"
              title="Close (Esc)"
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <CloseIcon fontSize="small" />
            </button>
          )}
        </div>
      </div>

      {/* Accordion Sections */}
      <div className="ds-properties-accordion">
        {/* General Section */}
        <AccordionSection title="General" defaultOpen={true}>
          <GeneralSection
            item={item}
            isElement={isElement}
            onChange={handleChange}
            readOnly={readOnly || !canEditProperties}
          />
        </AccordionSection>

        {/* Position Section (element only) */}
        {isElement && (
          <AccordionSection title="Position & Size" defaultOpen={true}>
            <PositionSection
              item={item}
              onChange={handleChange}
              readOnly={readOnly || !canEditProperties}
            />
          </AccordionSection>
        )}

        {/* Line Styling (connections only) */}
        {!isElement && (
          <>
            <AccordionSection title="Appearance" defaultOpen={true}>
              <ConnectionAppearanceSection
                item={item}
                onChange={handleChange}
                readOnly={readOnly || !canEditProperties}
              />
            </AccordionSection>
            <AccordionSection title="Line Style" defaultOpen={true}>
              <LineStyleSection
                item={item}
                onChange={handleChange}
                readOnly={readOnly || !canEditProperties}
              />
            </AccordionSection>
          </>
        )}

        {/* Custom Data (elements only) - open by default for UML classes and ERD */}
        {isElement && (
          <AccordionSection
            title="Custom Data"
            defaultOpen={['class', 'abstract-class', 'interface', 'enum', 'entity'].includes(item.type)}
          >
            <DataSection
              item={item}
              pack={pack}
              stencil={stencil}
              onChange={handleChange}
              readOnly={readOnly || !canEditProperties}
            />
          </AccordionSection>
        )}

        {/* Info Section */}
        <AccordionSection title="Info" defaultOpen={false}>
          <InfoSection item={item} />
        </AccordionSection>
      </div>
    </div>
  );
}

// ============ GENERAL SECTION ============

function GeneralSection({ item, isElement, onChange, readOnly }) {
  return (
    <>
      <div className="ds-property-row">
        <label className="ds-property-label">Label</label>
        <input
          type="text"
          className="ds-property-input"
          value={item.label || item.name || ''}
          onChange={(e) => onChange('label', e.target.value)}
          placeholder={isElement ? 'Element label' : 'Connection label'}
          disabled={readOnly}
        />
      </div>

      {isElement && (
        <div className="ds-property-row">
          <label className="ds-property-label">Description</label>
          <textarea
            className="ds-property-input ds-property-textarea"
            value={item.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Optional description..."
            disabled={readOnly}
            rows={3}
          />
        </div>
      )}
    </>
  );
}

// ============ POSITION SECTION ============

function PositionSection({ item, onChange, readOnly }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="ds-property-row" style={{ flex: 1 }}>
          <label className="ds-property-label">X</label>
          <input
            type="number"
            className="ds-property-input"
            value={item.x || 0}
            onChange={(e) => onChange('x', parseInt(e.target.value) || 0)}
            disabled={readOnly}
          />
        </div>
        <div className="ds-property-row" style={{ flex: 1 }}>
          <label className="ds-property-label">Y</label>
          <input
            type="number"
            className="ds-property-input"
            value={item.y || 0}
            onChange={(e) => onChange('y', parseInt(e.target.value) || 0)}
            disabled={readOnly}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div className="ds-property-row" style={{ flex: 1 }}>
          <label className="ds-property-label">Width</label>
          <input
            type="number"
            className="ds-property-input"
            value={item.size?.width || 120}
            onChange={(e) => onChange('size', { ...item.size, width: parseInt(e.target.value) || 120 })}
            disabled={readOnly}
          />
        </div>
        <div className="ds-property-row" style={{ flex: 1 }}>
          <label className="ds-property-label">Height</label>
          <input
            type="number"
            className="ds-property-input"
            value={item.size?.height || 60}
            onChange={(e) => onChange('size', { ...item.size, height: parseInt(e.target.value) || 60 })}
            disabled={readOnly}
          />
        </div>
      </div>
    </>
  );
}

// ============ APPEARANCE SECTION ============

function AppearanceSection({ item, isElement, onChange, readOnly }) {
  const colors = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#64748b', '#f97316', '#14b8a6',
  ];

  return (
    <>
      {/* Color */}
      <div className="ds-property-row">
        <label className="ds-property-label">Color</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {colors.map(color => (
            <button
              key={color}
              onClick={() => !readOnly && onChange('color', color)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                background: color,
                border: item.color === color ? '2px solid var(--text)' : '2px solid transparent',
                cursor: readOnly ? 'not-allowed' : 'pointer',
              }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Background Color (element only) */}
      {isElement && (
        <div className="ds-property-row">
          <label className="ds-property-label">Background</label>
          <input
            type="color"
            value={item.backgroundColor || '#ffffff'}
            onChange={(e) => onChange('backgroundColor', e.target.value)}
            disabled={readOnly}
            style={{
              width: '100%',
              height: 32,
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: readOnly ? 'not-allowed' : 'pointer',
            }}
          />
        </div>
      )}

      {/* Opacity */}
      <div className="ds-property-row">
        <label className="ds-property-label">Opacity ({Math.round((item.opacity || 1) * 100)}%)</label>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          value={item.opacity || 1}
          onChange={(e) => onChange('opacity', parseFloat(e.target.value))}
          disabled={readOnly}
          style={{ width: '100%' }}
        />
      </div>

      {/* Border Section - only for elements */}
      {isElement && (
        <>
          {/* Border Width */}
          <div className="ds-property-row">
            <label className="ds-property-label">Border Width</label>
            <select
              className="ds-property-input"
              value={item.borderWidth ?? 1}
              onChange={(e) => onChange('borderWidth', parseInt(e.target.value))}
              disabled={readOnly}
            >
              <option value={0}>None</option>
              <option value={1}>1px</option>
              <option value={2}>2px</option>
              <option value={3}>3px</option>
              <option value={4}>4px</option>
            </select>
          </div>

          {/* Border Color */}
          <div className="ds-property-row">
            <label className="ds-property-label">Border Color</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color"
                value={item.borderColor || '#d1d5db'}
                onChange={(e) => onChange('borderColor', e.target.value)}
                disabled={readOnly}
                style={{
                  width: 40,
                  height: 28,
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  cursor: readOnly ? 'not-allowed' : 'pointer',
                  padding: 0,
                }}
              />
              <button
                onClick={() => onChange('borderColor', null)}
                disabled={readOnly}
                style={{
                  fontSize: 10,
                  padding: '4px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  background: 'var(--bg)',
                  cursor: readOnly ? 'not-allowed' : 'pointer',
                }}
              >
                Auto
              </button>
            </div>
          </div>

          {/* Border Radius */}
          <div className="ds-property-row">
            <label className="ds-property-label">Corner Radius</label>
            <select
              className="ds-property-input"
              value={item.borderRadius ?? 8}
              onChange={(e) => onChange('borderRadius', parseInt(e.target.value))}
              disabled={readOnly}
            >
              <option value={0}>Square (0)</option>
              <option value={4}>Slight (4px)</option>
              <option value={8}>Rounded (8px)</option>
              <option value={12}>More (12px)</option>
              <option value={16}>Very (16px)</option>
              <option value={9999}>Pill</option>
            </select>
          </div>
        </>
      )}
    </>
  );
}

// ============ TEXT STYLE SECTION ============

function TextStyleSection({ item, onChange, readOnly }) {
  const fontSizes = [10, 11, 12, 13, 14, 16, 18, 20, 24];

  return (
    <>
      {/* Font Size */}
      <div className="ds-property-row">
        <label className="ds-property-label">Font Size</label>
        <select
          className="ds-property-input"
          value={item.fontSize || 13}
          onChange={(e) => onChange('fontSize', parseInt(e.target.value))}
          disabled={readOnly}
        >
          {fontSizes.map(size => (
            <option key={size} value={size}>{size}px</option>
          ))}
        </select>
      </div>

      {/* Font Weight */}
      <div className="ds-property-row">
        <label className="ds-property-label">Font Weight</label>
        <select
          className="ds-property-input"
          value={item.fontWeight || 'normal'}
          onChange={(e) => onChange('fontWeight', e.target.value)}
          disabled={readOnly}
        >
          <option value="normal">Normal</option>
          <option value="500">Medium</option>
          <option value="600">Semi Bold</option>
          <option value="bold">Bold</option>
        </select>
      </div>

      {/* Text Align */}
      <div className="ds-property-row">
        <label className="ds-property-label">Text Align</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {['left', 'center', 'right'].map(align => (
            <button
              key={align}
              onClick={() => !readOnly && onChange('textAlign', align)}
              style={{
                flex: 1,
                padding: '6px',
                background: (item.textAlign || 'center') === align ? 'var(--accent)' : 'var(--bg)',
                color: (item.textAlign || 'center') === align ? 'white' : 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                cursor: readOnly ? 'not-allowed' : 'pointer',
                fontSize: 11,
                textTransform: 'capitalize',
              }}
            >
              {align}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ============ CONNECTION APPEARANCE SECTION ============

function ConnectionAppearanceSection({ item, onChange, readOnly }) {
  const colors = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#64748b', '#f97316', '#14b8a6',
  ];

  return (
    <>
      {/* Color */}
      <div className="ds-property-row">
        <label className="ds-property-label">Color</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {colors.map(color => (
            <button
              key={color}
              onClick={() => !readOnly && onChange('color', color)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                background: color,
                border: item.color === color ? '2px solid var(--text)' : '2px solid transparent',
                cursor: readOnly ? 'not-allowed' : 'pointer',
              }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Opacity */}
      <div className="ds-property-row">
        <label className="ds-property-label">Opacity ({Math.round((item.opacity || 1) * 100)}%)</label>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          value={item.opacity || 1}
          onChange={(e) => onChange('opacity', parseFloat(e.target.value))}
          disabled={readOnly}
          style={{ width: '100%' }}
        />
      </div>
    </>
  );
}

// ============ LINE STYLE SECTION ============

function LineStyleSection({ item, onChange, readOnly }) {
  const lineStyles = [
    { value: 'smart', label: 'Smart', icon: '⚡' },
    { value: 'curved', label: 'Curved', icon: '⌒' },
    { value: 'straight', label: 'Straight', icon: '—' },
    { value: 'step', label: 'Step', icon: '⌐' },
    { value: 'arc', label: 'Arc', icon: '↷' },
  ];

  const endpointMarkers = [
    { value: 'none', label: 'None', icon: '○' },
    { value: 'arrow', label: 'Arrow', icon: '▸' },
    { value: 'circle', label: 'Circle', icon: '●' },
    { value: 'diamond', label: 'Diamond', icon: '◆' },
    { value: 'bar', label: 'Bar', icon: '|' },
  ];

  const strokeWidths = [1, 2, 3, 4, 5];

  return (
    <>
      {/* Line Type */}
      <div className="ds-property-row">
        <label className="ds-property-label">Line Type</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {lineStyles.map(style => (
            <button
              key={style.value}
              onClick={() => !readOnly && onChange('lineStyle', style.value)}
              style={{
                flex: 1,
                padding: '6px 4px',
                background: (item.lineStyle || 'curved') === style.value ? 'var(--accent)' : 'var(--bg)',
                color: (item.lineStyle || 'curved') === style.value ? 'white' : 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                cursor: readOnly ? 'not-allowed' : 'pointer',
                fontSize: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
              title={style.label}
            >
              <span style={{ fontSize: 14 }}>{style.icon}</span>
              <span>{style.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stroke Width */}
      <div className="ds-property-row">
        <label className="ds-property-label">Line Width</label>
        <select
          className="ds-property-input"
          value={item.strokeWidth || 2}
          onChange={(e) => onChange('strokeWidth', parseInt(e.target.value))}
          disabled={readOnly}
        >
          {strokeWidths.map(w => (
            <option key={w} value={w}>{w}px</option>
          ))}
        </select>
      </div>

      {/* Dash Pattern */}
      <div className="ds-property-row">
        <label className="ds-property-label">Line Pattern</label>
        <select
          className="ds-property-input"
          value={item.dashPattern || 'solid'}
          onChange={(e) => onChange('dashPattern', e.target.value)}
          disabled={readOnly}
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
          <option value="dash-dot">Dash-Dot</option>
        </select>
      </div>

      {/* Source Endpoint */}
      <div className="ds-property-row">
        <label className="ds-property-label">Source Endpoint</label>
        <div style={{ display: 'flex', gap: 2 }}>
          {endpointMarkers.map(marker => (
            <button
              key={marker.value}
              onClick={() => !readOnly && onChange('sourceMarker', marker.value)}
              style={{
                flex: 1,
                padding: '6px 2px',
                background: (item.sourceMarker || 'none') === marker.value ? 'var(--accent)' : 'var(--bg)',
                color: (item.sourceMarker || 'none') === marker.value ? 'white' : 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                cursor: readOnly ? 'not-allowed' : 'pointer',
                fontSize: 14,
              }}
              title={marker.label}
            >
              {marker.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Target Endpoint */}
      <div className="ds-property-row">
        <label className="ds-property-label">Target Endpoint</label>
        <div style={{ display: 'flex', gap: 2 }}>
          {endpointMarkers.map(marker => (
            <button
              key={marker.value}
              onClick={() => !readOnly && onChange('targetMarker', marker.value)}
              style={{
                flex: 1,
                padding: '6px 2px',
                background: (item.targetMarker || 'arrow') === marker.value ? 'var(--accent)' : 'var(--bg)',
                color: (item.targetMarker || 'arrow') === marker.value ? 'white' : 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                cursor: readOnly ? 'not-allowed' : 'pointer',
                fontSize: 14,
              }}
              title={marker.label}
            >
              {marker.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Source Label (Cardinality) */}
      <div className="ds-property-row">
        <label className="ds-property-label">Source Label</label>
        <input
          type="text"
          className="ds-property-input"
          value={item.sourceLabel || ''}
          onChange={(e) => onChange('sourceLabel', e.target.value)}
          placeholder="e.g. 1, 0..*, many"
          disabled={readOnly}
        />
      </div>

      {/* Target Label (Cardinality) */}
      <div className="ds-property-row">
        <label className="ds-property-label">Target Label</label>
        <input
          type="text"
          className="ds-property-input"
          value={item.targetLabel || ''}
          onChange={(e) => onChange('targetLabel', e.target.value)}
          placeholder="e.g. 1, 0..*, many"
          disabled={readOnly}
        />
      </div>

      {/* Waypoints Info */}
      {item.waypoints && item.waypoints.length > 0 && (
        <div className="ds-property-row">
          <label className="ds-property-label">Waypoints</label>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {item.waypoints.length} control point{item.waypoints.length !== 1 ? 's' : ''}
            {!readOnly && (
              <button
                onClick={() => onChange('waypoints', [])}
                style={{
                  marginLeft: 8,
                  fontSize: 10,
                  padding: '2px 6px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ============ DATA SECTION ============

function DataSection({ item, pack, stencil, onChange, readOnly }) {
  // Get custom properties from pack/stencil
  const customProperties = useMemo(() => {
    return stencil?.properties || pack?.nodeProperties || [];
  }, [stencil, pack]);

  if (customProperties.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
        No custom data fields for this element type
      </div>
    );
  }

  return (
    <>
      {customProperties.map(prop => (
        <div key={prop.id} className="ds-property-row">
          <label className="ds-property-label">{prop.label || prop.id}</label>
          <PropertyField
            property={prop}
            value={item.data?.[prop.id] || item[prop.id]}
            onChange={(value) => {
              const data = { ...item.data, [prop.id]: value };
              onChange('data', data);
            }}
            readOnly={readOnly}
          />
        </div>
      ))}
    </>
  );
}

// ============ INFO SECTION ============

function InfoSection({ item }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
      <div style={{ marginBottom: 4 }}>ID: <code style={{ fontSize: 10 }}>{item.id}</code></div>
      <div style={{ marginBottom: 4 }}>Type: {item.type}</div>
      {item.createdAt && <div>Created: {new Date(item.createdAt).toLocaleString()}</div>}
    </div>
  );
}

// ============ LIST FIELD (for attributes, methods, etc.) ============

function ListField({ property, value, onChange, readOnly }) {
  const items = Array.isArray(value) ? value : [];
  const [newItem, setNewItem] = useState('');

  const handleAddItem = () => {
    if (newItem.trim()) {
      const updated = [...items, newItem.trim()];
      onChange(updated);
      setNewItem('');
    }
  };

  const handleUpdateItem = (index, newValue) => {
    const updated = [...items];
    updated[index] = newValue;
    onChange(updated);
  };

  const handleRemoveItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <div className="ds-list-field">
      {/* Existing items */}
      <div className="ds-list-items">
        {items.map((item, index) => (
          <div key={index} className="ds-list-item">
            <input
              type="text"
              className="ds-property-input ds-list-item-input"
              value={item}
              onChange={(e) => handleUpdateItem(index, e.target.value)}
              disabled={readOnly}
              style={{ flex: 1, fontSize: 12 }}
            />
            {!readOnly && (
              <button
                onClick={() => handleRemoveItem(index)}
                className="ds-list-item-remove"
                title="Remove"
                style={{
                  padding: '4px 8px',
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add new item */}
      {!readOnly && (
        <div className="ds-list-add" style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <input
            type="text"
            className="ds-property-input"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={property.placeholder || 'Add item...'}
            style={{ flex: 1, fontSize: 12 }}
          />
          <button
            onClick={handleAddItem}
            disabled={!newItem.trim()}
            style={{
              padding: '4px 10px',
              background: newItem.trim() ? 'var(--accent)' : 'var(--bg)',
              color: newItem.trim() ? 'white' : 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: newItem.trim() ? 'pointer' : 'not-allowed',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Add
          </button>
        </div>
      )}

      {items.length === 0 && !newItem && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>
          No items added yet
        </div>
      )}
    </div>
  );
}

// ============ PROPERTY FIELD ============

function PropertyField({ property, value, onChange, readOnly }) {
  switch (property.type) {
    case 'list':
      return (
        <ListField
          property={property}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
        />
      );

    case 'select':
      return (
        <select
          className="ds-property-input"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
        >
          <option value="">Select...</option>
          {(property.options || []).map(opt => (
            <option key={opt.value || opt} value={opt.value || opt}>
              {opt.label || opt}
            </option>
          ))}
        </select>
      );

    case 'boolean':
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
            disabled={readOnly}
          />
          <span style={{ fontSize: 13, color: 'var(--text)' }}>
            {value ? 'Yes' : 'No'}
          </span>
        </label>
      );

    case 'number':
      return (
        <input
          type="number"
          className="ds-property-input"
          value={value || 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          disabled={readOnly}
        />
      );

    case 'textarea':
      return (
        <textarea
          className="ds-property-input ds-property-textarea"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={property.placeholder}
          disabled={readOnly}
        />
      );

    default: // text
      return (
        <input
          type="text"
          className="ds-property-input"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={property.placeholder}
          disabled={readOnly}
        />
      );
  }
}
