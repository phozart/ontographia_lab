// components/diagram-studio/ui/FrameNavigator.js
// Frame navigation panel for jumping between frames (sub-boards)

import { useState, useRef, useEffect, useMemo } from 'react';
import { useDiagram, useDiagramViewport, useDiagramSelection } from '../DiagramContext';

// Icons
import CropFreeIcon from '@mui/icons-material/CropFree';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import FullscreenIcon from '@mui/icons-material/Fullscreen';

export default function FrameNavigator({
  packRegistry,
  containerRef,
  className = ''
}) {
  const { elements, addElement, recordHistory } = useDiagram();
  const { viewport, zoomToFrame, zoomToFitAll, resetZoom } = useDiagramViewport();
  const { selectElement } = useDiagramSelection();

  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(true); // Start minimized by default

  // Get all frames from elements
  const frames = useMemo(() => {
    return elements.filter(el =>
      el.type === 'frame' ||
      el.isFrame === true ||
      (packRegistry?.findStencil(el.type)?.isFrame)
    ).sort((a, b) => {
      // Sort by creation time or y position
      if (a.createdAt && b.createdAt) {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      return (a.y || 0) - (b.y || 0);
    });
  }, [elements, packRegistry]);

  // Get container dimensions for zoom calculations
  const getContainerSize = () => {
    if (containerRef?.current) {
      return {
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      };
    }
    return { width: 1200, height: 800 };
  };

  // Handle frame click - zoom to frame
  const handleFrameClick = (frame) => {
    const { width, height } = getContainerSize();
    zoomToFrame(frame, width, height, 40);
    selectElement(frame.id);
  };

  // Handle add new frame
  const handleAddFrame = () => {
    const frameStencil = packRegistry?.findStencil('frame', 'core');
    if (!frameStencil) return;

    // Calculate position for new frame
    // Place it to the right of existing frames or at center
    let newX = 50000; // Canvas center
    let newY = 50000;

    if (frames.length > 0) {
      const lastFrame = frames[frames.length - 1];
      newX = lastFrame.x + (lastFrame.size?.width || 600) + 100;
      newY = lastFrame.y;
    }

    recordHistory();
    const newFrame = addElement({
      type: 'frame',
      packId: 'core',
      label: `Frame ${frames.length + 1}`,
      x: newX,
      y: newY,
      size: frameStencil.defaultSize || { width: 600, height: 400 },
      color: frameStencil.color || '#64748b',
      data: {
        backgroundColor: '#ffffff', // White background by default
        showTitle: true,
      },
    });

    // Zoom to new frame
    setTimeout(() => {
      const { width, height } = getContainerSize();
      zoomToFrame(newFrame, width, height, 40);
      selectElement(newFrame.id);
    }, 50);
  };

  // Handle fit all frames
  const handleFitAll = () => {
    if (frames.length === 0) {
      resetZoom();
      return;
    }
    const { width, height } = getContainerSize();
    zoomToFitAll(frames, width, height, 80);
  };

  // Generate mini thumbnail for frame
  const getFrameThumbnail = (frame) => {
    const width = frame.size?.width || 600;
    const height = frame.size?.height || 400;
    const aspectRatio = width / height;

    // Thumbnail dimensions
    const thumbWidth = 60;
    const thumbHeight = thumbWidth / aspectRatio;

    return (
      <div
        style={{
          width: thumbWidth,
          height: Math.min(thumbHeight, 45),
          backgroundColor: frame.data?.backgroundColor || '#ffffff',
          border: `2px dashed ${frame.color || '#64748b'}`,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          color: frame.color || '#64748b',
          overflow: 'hidden',
        }}
      >
        <CropFreeIcon style={{ fontSize: 16, opacity: 0.5 }} />
      </div>
    );
  };

  // Don't render if minimized to just the toggle
  if (isMinimized) {
    return (
      <div className={`frame-navigator minimized ${className}`}>
        <button
          className="minimize-btn"
          onClick={() => setIsMinimized(false)}
          title="Show Frames"
        >
          <CropFreeIcon fontSize="small" />
          {frames.length > 0 && (
            <span className="frame-count">{frames.length}</span>
          )}
        </button>

        <style jsx>{`
          .frame-navigator.minimized {
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 150;
          }

          .minimize-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 10px;
            background: white;
            color: var(--text-muted, #6b7280);
            cursor: pointer;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
            transition: all 0.2s ease;
          }

          .minimize-btn:hover {
            background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
            color: var(--text, #1f2937);
          }

          .frame-count {
            position: absolute;
            top: -4px;
            right: -4px;
            min-width: 18px;
            height: 18px;
            border-radius: 9px;
            background: var(--ds-active-color, #0e74a3);
            color: white;
            font-size: 10px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`frame-navigator ${className}`}>
      {/* Header */}
      <div className="navigator-header">
        <div className="header-title">
          <CropFreeIcon fontSize="small" />
          <span>Frames</span>
          <span className="count">{frames.length}</span>
        </div>
        <div className="header-actions">
          <button
            className="action-btn"
            onClick={handleFitAll}
            title="Fit All Frames"
          >
            <FitScreenIcon fontSize="small" />
          </button>
          <button
            className="action-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </button>
          <button
            className="action-btn"
            onClick={() => setIsMinimized(true)}
            title="Minimize"
          >
            <CloseIcon fontSize="small" />
          </button>
        </div>
      </div>

      {/* Frame List */}
      {isExpanded && (
        <div className="frame-list">
          {frames.length === 0 ? (
            <div className="empty-state">
              <p>No frames yet</p>
              <p className="hint">Add frames to organize your content</p>
            </div>
          ) : (
            frames.map((frame, index) => (
              <button
                key={frame.id}
                className="frame-item"
                onClick={() => handleFrameClick(frame)}
                title={`Navigate to ${frame.label || `Frame ${index + 1}`}`}
              >
                {getFrameThumbnail(frame)}
                <div className="frame-info">
                  <span className="frame-name">{frame.label || `Frame ${index + 1}`}</span>
                  <span className="frame-size">
                    {frame.size?.width || 600} × {frame.size?.height || 400}
                  </span>
                </div>
                <FullscreenIcon className="zoom-icon" fontSize="small" />
              </button>
            ))
          )}

          {/* Add Frame Button */}
          <button
            className="add-frame-btn"
            onClick={handleAddFrame}
            title="Add New Frame"
          >
            <AddIcon fontSize="small" />
            <span>Add Frame</span>
          </button>
        </div>
      )}

      <style jsx>{`
        .frame-navigator {
          position: fixed;
          bottom: 20px;
          left: 20px;
          width: 220px;
          max-height: 400px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04);
          z-index: 150;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .navigator-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          background: rgba(0, 0, 0, 0.02);
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text, #1f2937);
        }

        .header-title :global(svg) {
          font-size: 16px;
          color: var(--text-muted, #6b7280);
        }

        .count {
          min-width: 18px;
          height: 18px;
          border-radius: 9px;
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.1));
          color: var(--ds-active-color, #0e74a3);
          font-size: 10px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .action-btn {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted, #6b7280);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .action-btn:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
          color: var(--text, #1f2937);
        }

        .frame-list {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .empty-state {
          padding: 20px 12px;
          text-align: center;
        }

        .empty-state p {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted, #6b7280);
        }

        .empty-state .hint {
          font-size: 11px;
          color: var(--text-muted, #9ca3af);
          margin-top: 4px;
        }

        .frame-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border: none;
          border-radius: 8px;
          background: transparent;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
          width: 100%;
        }

        .frame-item:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
        }

        .frame-item:hover .zoom-icon {
          opacity: 1;
        }

        .frame-info {
          flex: 1;
          min-width: 0;
        }

        .frame-name {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: var(--text, #1f2937);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .frame-size {
          display: block;
          font-size: 10px;
          color: var(--text-muted, #9ca3af);
          margin-top: 2px;
        }

        .frame-item :global(.zoom-icon) {
          opacity: 0;
          color: var(--ds-active-color, #0e74a3);
          transition: opacity 0.15s ease;
        }

        .add-frame-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          border: 2px dashed rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          background: transparent;
          color: var(--text-muted, #6b7280);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-top: 4px;
        }

        .add-frame-btn:hover {
          border-color: var(--ds-active-color, #0e74a3);
          color: var(--ds-active-color, #0e74a3);
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.05));
        }
      `}</style>
    </div>
  );
}
