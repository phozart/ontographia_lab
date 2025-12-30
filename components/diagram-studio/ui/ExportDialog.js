// components/diagram-studio/ui/ExportDialog.js
// Advanced export dialog with format, scope, and quality options

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExportManager, downloadExport } from '../export/ExportManager';

// MUI Icons
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
import CodeIcon from '@mui/icons-material/Code';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import CropFreeIcon from '@mui/icons-material/CropFree';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GridOnIcon from '@mui/icons-material/GridOn';

const FORMAT_OPTIONS = [
  { id: 'png', label: 'PNG', icon: ImageIcon, description: 'Best for sharing, supports transparency' },
  { id: 'svg', label: 'SVG', icon: CodeIcon, description: 'Vector format, scalable' },
  { id: 'jpeg', label: 'JPEG', icon: PhotoCameraIcon, description: 'Smaller file size' },
];

const SCALE_OPTIONS = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 4, label: '4x' },
];

const PADDING_OPTIONS = [0, 20, 40, 60, 80];

export default function ExportDialog({
  isOpen,
  onClose,
  elements = [],
  connections = [],
  viewport,
  diagramName = 'diagram',
}) {
  const dialogRef = useRef(null);

  // Export options state
  const [format, setFormat] = useState('png');
  const [scope, setScope] = useState('canvas');
  const [selectedFrameId, setSelectedFrameId] = useState(null);
  const [scale, setScale] = useState(2);
  const [background, setBackground] = useState('white');
  const [customColor, setCustomColor] = useState('#ffffff');
  const [includeGrid, setIncludeGrid] = useState(false);
  const [padding, setPadding] = useState(40);
  const [jpegQuality, setJpegQuality] = useState(0.9);
  const [isExporting, setIsExporting] = useState(false);

  // Get frames from elements
  const frames = useMemo(() => {
    return elements.filter(el => el.type === 'frame' || el.isFrame);
  }, [elements]);

  // Auto-select first frame when switching to frame scope
  useEffect(() => {
    if (scope === 'frame' && !selectedFrameId && frames.length > 0) {
      setSelectedFrameId(frames[0].id);
    }
  }, [scope, frames, selectedFrameId]);

  // Calculate export dimensions
  const exportDimensions = useMemo(() => {
    const exportManager = new ExportManager();
    let bounds;

    if (scope === 'frame' && selectedFrameId) {
      const frame = frames.find(f => f.id === selectedFrameId);
      if (frame) {
        bounds = {
          width: frame.size?.width || 400,
          height: frame.size?.height || 300,
        };
      }
    } else if (scope === 'viewport' && viewport) {
      bounds = {
        width: Math.round((viewport.containerWidth || 1200) / viewport.scale),
        height: Math.round((viewport.containerHeight || 800) / viewport.scale),
      };
    } else {
      bounds = exportManager.calculateBounds(elements, padding);
    }

    return {
      width: Math.round((bounds?.width || 800) * scale),
      height: Math.round((bounds?.height || 600) * scale),
    };
  }, [scope, selectedFrameId, frames, viewport, elements, padding, scale]);

  // Handle export
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const exportManager = new ExportManager();

      // Determine background color
      const bgColor = background === 'transparent' ? 'transparent' :
                      background === 'custom' ? customColor : '#ffffff';

      // Get frame if scope is frame
      const selectedFrame = scope === 'frame' && selectedFrameId
        ? frames.find(f => f.id === selectedFrameId)
        : null;

      const diagram = {
        name: diagramName,
        elements,
        connections,
      };

      const options = {
        padding: scope === 'frame' ? 0 : padding,
        backgroundColor: bgColor,
        includeGrid,
        scale,
        quality: jpegQuality,
        scope,
        viewport,
        frame: selectedFrame,
      };

      let result;
      if (scope === 'canvas') {
        result = await exportManager.export(diagram, format, options);
      } else {
        result = await exportManager.exportWithScope(diagram, format, options);
      }

      downloadExport(result);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [format, scope, selectedFrameId, frames, scale, background, customColor, includeGrid, padding, jpegQuality, elements, connections, viewport, diagramName, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close on click outside
  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  const supportsTransparency = format === 'png' || format === 'svg';

  const content = (
    <div className="export-dialog-overlay" onClick={handleBackdropClick}>
      <div ref={dialogRef} className="export-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="export-dialog-header">
          <h2>Export Diagram</h2>
          <button className="export-dialog-close" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </button>
        </div>

        {/* Content */}
        <div className="export-dialog-content">
          {/* Left: Preview */}
          <div className="export-preview-section">
            <div className="export-preview-container">
              <div className="export-preview-placeholder">
                <CropFreeIcon style={{ fontSize: 48, opacity: 0.3 }} />
                <span>Preview</span>
              </div>
            </div>
            <div className="export-dimensions">
              {exportDimensions.width} × {exportDimensions.height} px
            </div>
          </div>

          {/* Right: Options */}
          <div className="export-options-section">
            {/* Format */}
            <div className="export-option-group">
              <label className="export-option-label">Format</label>
              <div className="export-format-buttons">
                {FORMAT_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      className={`export-format-btn ${format === opt.id ? 'active' : ''}`}
                      onClick={() => setFormat(opt.id)}
                      title={opt.description}
                    >
                      <Icon fontSize="small" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scope */}
            <div className="export-option-group">
              <label className="export-option-label">Scope</label>
              <div className="export-scope-options">
                <label className="export-radio">
                  <input
                    type="radio"
                    name="scope"
                    value="canvas"
                    checked={scope === 'canvas'}
                    onChange={() => setScope('canvas')}
                  />
                  <CropFreeIcon fontSize="small" />
                  <span>Full canvas</span>
                </label>
                <label className="export-radio">
                  <input
                    type="radio"
                    name="scope"
                    value="viewport"
                    checked={scope === 'viewport'}
                    onChange={() => setScope('viewport')}
                  />
                  <VisibilityIcon fontSize="small" />
                  <span>Visible viewport</span>
                </label>
                {frames.length > 0 && (
                  <label className="export-radio">
                    <input
                      type="radio"
                      name="scope"
                      value="frame"
                      checked={scope === 'frame'}
                      onChange={() => setScope('frame')}
                    />
                    <GridOnIcon fontSize="small" />
                    <span>Frame</span>
                  </label>
                )}
              </div>
              {scope === 'frame' && frames.length > 0 && (
                <select
                  className="export-frame-select"
                  value={selectedFrameId || ''}
                  onChange={(e) => setSelectedFrameId(e.target.value)}
                >
                  {frames.map(frame => (
                    <option key={frame.id} value={frame.id}>
                      {frame.label || `Frame ${frame.id.slice(-4)}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Resolution */}
            <div className="export-option-group">
              <label className="export-option-label">Resolution</label>
              <div className="export-scale-buttons">
                {SCALE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`export-scale-btn ${scale === opt.value ? 'active' : ''}`}
                    onClick={() => setScale(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Background */}
            <div className="export-option-group">
              <label className="export-option-label">Background</label>
              <div className="export-bg-options">
                {supportsTransparency && (
                  <button
                    className={`export-bg-btn ${background === 'transparent' ? 'active' : ''}`}
                    onClick={() => setBackground('transparent')}
                  >
                    <span className="checkered-bg" />
                    Transparent
                  </button>
                )}
                <button
                  className={`export-bg-btn ${background === 'white' ? 'active' : ''}`}
                  onClick={() => setBackground('white')}
                >
                  <span className="color-swatch" style={{ background: '#ffffff' }} />
                  White
                </button>
                <button
                  className={`export-bg-btn ${background === 'custom' ? 'active' : ''}`}
                  onClick={() => setBackground('custom')}
                >
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      setBackground('custom');
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  Custom
                </button>
              </div>
            </div>

            {/* JPEG Quality (only for JPEG) */}
            {format === 'jpeg' && (
              <div className="export-option-group">
                <label className="export-option-label">
                  Quality: {Math.round(jpegQuality * 100)}%
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={jpegQuality}
                  onChange={(e) => setJpegQuality(parseFloat(e.target.value))}
                  className="export-quality-slider"
                />
              </div>
            )}

            {/* Additional Options */}
            <div className="export-option-group">
              <label className="export-option-label">Options</label>
              <label className="export-checkbox">
                <input
                  type="checkbox"
                  checked={includeGrid}
                  onChange={(e) => setIncludeGrid(e.target.checked)}
                />
                <span>Include grid</span>
              </label>
              {scope === 'canvas' && (
                <div className="export-padding-row">
                  <span>Padding:</span>
                  <select
                    value={padding}
                    onChange={(e) => setPadding(parseInt(e.target.value))}
                    className="export-padding-select"
                  >
                    {PADDING_OPTIONS.map(p => (
                      <option key={p} value={p}>{p}px</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="export-dialog-footer">
          <button className="export-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="export-btn-primary"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .export-dialog-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 40px;
        }

        .export-dialog {
          width: 100%;
          max-width: 700px;
          max-height: calc(100vh - 80px);
          background: var(--panel, #ffffff);
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: dialogIn 0.2s ease-out;
        }

        @keyframes dialogIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .export-dialog-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border, #e5e7eb);
        }

        .export-dialog-header h2 {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
          color: var(--text, #1f2937);
        }

        .export-dialog-close {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--text-muted, #6b7280);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .export-dialog-close:hover {
          background: var(--bg-alt, #f3f4f6);
          color: var(--text, #1f2937);
        }

        .export-dialog-content {
          display: flex;
          gap: 24px;
          padding: 24px;
          overflow-y: auto;
        }

        .export-preview-section {
          flex: 0 0 280px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .export-preview-container {
          width: 100%;
          height: 200px;
          background:
            linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
            linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
            linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
          background-size: 16px 16px;
          background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .export-preview-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: var(--text-muted, #6b7280);
          font-size: 13px;
        }

        .export-dimensions {
          text-align: center;
          font-size: 13px;
          color: var(--text-muted, #6b7280);
          font-family: 'SF Mono', Monaco, monospace;
        }

        .export-options-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .export-option-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .export-option-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted, #6b7280);
        }

        .export-format-buttons {
          display: flex;
          gap: 8px;
        }

        .export-format-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 12px;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 8px;
          background: var(--bg-alt, #f9fafb);
          color: var(--text-muted, #6b7280);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .export-format-btn:hover {
          border-color: var(--accent, #0e74a3);
          color: var(--accent, #0e74a3);
        }

        .export-format-btn.active {
          border-color: var(--accent, #0e74a3);
          background: var(--accent-soft, rgba(14, 116, 163, 0.1));
          color: var(--accent, #0e74a3);
        }

        .export-scope-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .export-radio {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          color: var(--text, #1f2937);
          transition: background 0.15s ease;
        }

        .export-radio:hover {
          background: var(--bg-alt, #f3f4f6);
        }

        .export-radio input {
          accent-color: var(--accent, #0e74a3);
        }

        .export-frame-select {
          margin-top: 8px;
          padding: 8px 12px;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 6px;
          background: var(--bg-alt, #f9fafb);
          font-size: 13px;
          color: var(--text, #1f2937);
        }

        .export-scale-buttons {
          display: flex;
          gap: 6px;
        }

        .export-scale-btn {
          width: 48px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 6px;
          background: var(--bg-alt, #f9fafb);
          color: var(--text-muted, #6b7280);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .export-scale-btn:hover {
          border-color: var(--accent, #0e74a3);
          color: var(--accent, #0e74a3);
        }

        .export-scale-btn.active {
          border-color: var(--accent, #0e74a3);
          background: var(--accent-soft, rgba(14, 116, 163, 0.1));
          color: var(--accent, #0e74a3);
        }

        .export-bg-options {
          display: flex;
          gap: 8px;
        }

        .export-bg-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 6px;
          background: var(--bg-alt, #f9fafb);
          color: var(--text-muted, #6b7280);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .export-bg-btn:hover {
          border-color: var(--accent, #0e74a3);
        }

        .export-bg-btn.active {
          border-color: var(--accent, #0e74a3);
          background: var(--accent-soft, rgba(14, 116, 163, 0.1));
          color: var(--accent, #0e74a3);
        }

        .checkered-bg {
          width: 16px;
          height: 16px;
          border-radius: 3px;
          background:
            linear-gradient(45deg, #ccc 25%, transparent 25%),
            linear-gradient(-45deg, #ccc 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #ccc 75%),
            linear-gradient(-45deg, transparent 75%, #ccc 75%);
          background-size: 8px 8px;
          background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
          border: 1px solid var(--border, #e5e7eb);
        }

        .color-swatch {
          width: 16px;
          height: 16px;
          border-radius: 3px;
          border: 1px solid var(--border, #e5e7eb);
        }

        .export-bg-btn input[type="color"] {
          width: 16px;
          height: 16px;
          padding: 0;
          border: none;
          border-radius: 3px;
          cursor: pointer;
        }

        .export-quality-slider {
          width: 100%;
          accent-color: var(--accent, #0e74a3);
        }

        .export-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text, #1f2937);
          cursor: pointer;
        }

        .export-checkbox input {
          accent-color: var(--accent, #0e74a3);
        }

        .export-padding-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          font-size: 13px;
          color: var(--text, #1f2937);
        }

        .export-padding-select {
          padding: 4px 8px;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 4px;
          background: var(--bg-alt, #f9fafb);
          font-size: 13px;
        }

        .export-dialog-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid var(--border, #e5e7eb);
        }

        .export-btn-secondary {
          padding: 10px 20px;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 8px;
          background: transparent;
          color: var(--text-muted, #6b7280);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .export-btn-secondary:hover {
          background: var(--bg-alt, #f3f4f6);
          color: var(--text, #1f2937);
        }

        .export-btn-primary {
          padding: 10px 24px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #22d3ee 0%, var(--accent, #0e74a3) 60%, #0284c7 100%);
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 4px 14px rgba(14, 116, 163, 0.35);
        }

        .export-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(14, 116, 163, 0.45);
        }

        .export-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(content, document.body);
}

// Hook for managing export dialog state
export function useExportDialog() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Listen for keyboard shortcut (Cmd/Ctrl+Shift+E)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'e') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isOpen, open, close };
}
