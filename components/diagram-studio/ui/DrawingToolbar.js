// components/diagram-studio/ui/DrawingToolbar.js
// Floating toolbar for drawing tools - color and stroke width options

import { useState, useRef, useEffect } from 'react';
import { useDiagram } from '../DiagramContext';

// Preset colors for pen (solid colors)
const PEN_COLORS = [
  { id: 'black', color: '#1f2937', name: 'Black' },
  { id: 'gray', color: '#6b7280', name: 'Gray' },
  { id: 'red', color: '#ef4444', name: 'Red' },
  { id: 'orange', color: '#f97316', name: 'Orange' },
  { id: 'yellow', color: '#eab308', name: 'Yellow' },
  { id: 'green', color: '#22c55e', name: 'Green' },
  { id: 'blue', color: '#3b82f6', name: 'Blue' },
  { id: 'purple', color: '#8b5cf6', name: 'Purple' },
];

// Preset colors for highlighter (pastel colors)
const HIGHLIGHTER_COLORS = [
  { id: 'yellow', color: '#fef08a', name: 'Yellow' },
  { id: 'green', color: '#bbf7d0', name: 'Green' },
  { id: 'blue', color: '#bfdbfe', name: 'Blue' },
  { id: 'pink', color: '#fbcfe8', name: 'Pink' },
  { id: 'orange', color: '#fed7aa', name: 'Orange' },
  { id: 'purple', color: '#ddd6fe', name: 'Purple' },
  { id: 'cyan', color: '#a5f3fc', name: 'Cyan' },
  { id: 'rose', color: '#fecdd3', name: 'Rose' },
];

// Stroke width options per tool
const PEN_STROKE_WIDTHS = [
  { id: 'thin', width: 1, label: 'Thin' },
  { id: 'normal', width: 2, label: 'Normal' },
  { id: 'medium', width: 4, label: 'Medium' },
  { id: 'thick', width: 6, label: 'Thick' },
  { id: 'bold', width: 8, label: 'Bold' },
];

const HIGHLIGHTER_STROKE_WIDTHS = [
  { id: 'thin', width: 12, label: 'Thin' },
  { id: 'normal', width: 20, label: 'Normal' },
  { id: 'medium', width: 28, label: 'Medium' },
  { id: 'thick', width: 36, label: 'Thick' },
  { id: 'bold', width: 48, label: 'Bold' },
];

export default function DrawingToolbar({ className = '' }) {
  const {
    drawingTool,
    drawingColor = '#1f2937',
    setDrawingColor,
    drawingStrokeWidth = 2,
    setDrawingStrokeWidth,
  } = useDiagram() || {};

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWidthPicker, setShowWidthPicker] = useState(false);
  const colorPickerRef = useRef(null);
  const widthPickerRef = useRef(null);

  // Close pickers on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setShowColorPicker(false);
      }
      if (widthPickerRef.current && !widthPickerRef.current.contains(e.target)) {
        setShowWidthPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't render if not in drawing mode
  if (!drawingTool || drawingTool === 'eraser') {
    return null;
  }

  const toolLabel = drawingTool === 'pen' ? 'Pen' : drawingTool === 'highlighter' ? 'Highlighter' : 'Drawing';
  const strokeWidths = drawingTool === 'highlighter' ? HIGHLIGHTER_STROKE_WIDTHS : PEN_STROKE_WIDTHS;
  const colorPalette = drawingTool === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS;

  return (
    <div className={`drawing-toolbar ${className}`}>
      {/* Tool indicator */}
      <div className="dt-tool-label">
        {toolLabel}
      </div>

      <div className="dt-divider" />

      {/* Color picker */}
      <div className="dt-control" ref={colorPickerRef}>
        <button
          className="dt-color-btn"
          onClick={() => setShowColorPicker(!showColorPicker)}
          title="Color"
        >
          <div
            className="dt-color-preview"
            style={{ backgroundColor: drawingColor }}
          />
          <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" className="dt-chevron">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>

        {showColorPicker && (
          <div className="dt-dropdown">
            <div className="dt-color-grid">
              {colorPalette.map(({ id, color, name }) => (
                <button
                  key={id}
                  className={`dt-color-option ${drawingColor === color ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setDrawingColor?.(color);
                    setShowColorPicker(false);
                  }}
                  title={name}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stroke width picker */}
      <div className="dt-control" ref={widthPickerRef}>
        <button
          className="dt-width-btn"
          onClick={() => setShowWidthPicker(!showWidthPicker)}
          title="Stroke Width"
        >
          <div className="dt-width-preview">
            <div
              className="dt-width-line"
              style={{ height: Math.min(drawingStrokeWidth, 6) }}
            />
          </div>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" className="dt-chevron">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>

        {showWidthPicker && (
          <div className="dt-dropdown dt-width-dropdown">
            {strokeWidths.map(({ id, width, label }) => (
              <button
                key={id}
                className={`dt-width-option ${drawingStrokeWidth === width ? 'active' : ''}`}
                onClick={() => {
                  setDrawingStrokeWidth?.(width);
                  setShowWidthPicker(false);
                }}
              >
                <div className="dt-width-sample">
                  <div
                    className="dt-width-sample-line"
                    style={{
                      height: Math.min(width, 12),
                      backgroundColor: drawingColor,
                    }}
                  />
                </div>
                <span className="dt-width-label">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .drawing-toolbar {
          position: fixed;
          top: 56px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: rgba(37, 37, 64, 0.95);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          z-index: 450;
          animation: slideIn 0.15s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .dt-tool-label {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 0 4px;
        }

        .dt-divider {
          width: 1px;
          height: 20px;
          background: rgba(255, 255, 255, 0.15);
        }

        .dt-control {
          position: relative;
        }

        .dt-color-btn,
        .dt-width-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border: none;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dt-color-btn:hover,
        .dt-width-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: white;
        }

        .dt-color-preview {
          width: 18px;
          height: 18px;
          border-radius: 4px;
          border: 2px solid rgba(255, 255, 255, 0.3);
        }

        .dt-width-preview {
          width: 24px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dt-width-line {
          width: 100%;
          background: currentColor;
          border-radius: 2px;
        }

        .dt-chevron {
          opacity: 0.6;
        }

        .dt-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(37, 37, 64, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          z-index: 1000;
          animation: dropdownIn 0.15s ease-out;
        }

        @keyframes dropdownIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .dt-color-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
        }

        .dt-color-option {
          width: 28px;
          height: 28px;
          border: 2px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dt-color-option:hover {
          transform: scale(1.1);
        }

        .dt-color-option.active {
          border-color: white;
          box-shadow: 0 0 0 2px var(--accent, #6EC5D8);
        }

        .dt-width-dropdown {
          min-width: 120px;
          padding: 4px;
        }

        .dt-width-option {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 10px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dt-width-option:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .dt-width-option.active {
          background: rgba(110, 197, 216, 0.2);
          color: var(--accent, #6EC5D8);
        }

        .dt-width-sample {
          width: 40px;
          height: 16px;
          display: flex;
          align-items: center;
        }

        .dt-width-sample-line {
          width: 100%;
          border-radius: 2px;
        }

        .dt-width-label {
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
