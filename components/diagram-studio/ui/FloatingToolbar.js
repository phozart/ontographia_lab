// components/diagram-studio/ui/FloatingToolbar.js
// Bottom floating controls for export

import { useState, useRef, useEffect } from 'react';

// Icons
import FileDownloadIcon from '@mui/icons-material/FileDownload';

export default function FloatingToolbar({
  profile,
  onExport,
}) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  // Close export menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      {/* Bottom Right - Export */}
      <div className="ds-floating-toolbar ds-floating-toolbar-bottom-right" ref={exportMenuRef}>
        <div className="ds-floating-export-wrapper">
          <button
            className="ds-floating-btn"
            onClick={() => setShowExportMenu(!showExportMenu)}
            title="Export"
          >
            <FileDownloadIcon fontSize="small" />
          </button>
          {showExportMenu && (
            <div className="ds-floating-export-menu">
              {(profile?.exportPolicy?.formats || ['svg', 'png', 'json']).map(format => (
                <button
                  key={format}
                  onClick={() => {
                    onExport?.(format);
                    setShowExportMenu(false);
                  }}
                >
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .ds-floating-toolbar {
          position: fixed;
          display: flex;
          background: white;
          border-radius: 8px;
          box-shadow: var(--ds-shadow-toolbar, 0 2px 12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04));
          padding: 4px;
          gap: 2px;
          z-index: 100;
        }

        .ds-floating-toolbar-bottom-right {
          right: 12px;
          bottom: 12px;
          flex-direction: row;
        }

        .ds-floating-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted, #6b7280);
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
        }

        .ds-floating-btn :global(svg) {
          font-size: 20px;
        }

        .ds-floating-btn:hover:not(:disabled) {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
          color: var(--text, #1f2937);
        }

        .ds-floating-export-wrapper {
          position: relative;
        }

        .ds-floating-export-menu {
          position: absolute;
          bottom: 100%;
          right: 0;
          margin-bottom: 8px;
          background: white;
          border-radius: 8px;
          box-shadow: var(--ds-shadow-flyout, 0 4px 24px rgba(0, 0, 0, 0.12));
          padding: 4px;
          min-width: 80px;
        }

        .ds-floating-export-menu button {
          display: block;
          width: 100%;
          padding: 8px 12px;
          text-align: left;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text, #1f2937);
          font-size: 13px;
          cursor: pointer;
        }

        .ds-floating-export-menu button:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
        }
      `}</style>
    </>
  );
}
