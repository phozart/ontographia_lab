// components/diagram-studio/ui/ContextualToolbar.js
// Floating toolbar that appears near selected elements
// Includes styling controls (color, style variant, text formatting) and layout tools

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useDiagram, useDiagramSelection } from '../DiagramContext';
import {
  COLOR_PALETTE,
  COLOR_PRESETS,
  COLOR_PRESET_ORDER,
  STYLE_VARIANTS,
  STYLE_VARIANT_ORDER,
  FONT_SIZES,
  BORDER_STYLES,
  BORDER_WIDTHS,
  CORNER_STYLES,
  VERTICAL_ALIGNS,
} from '../styling/StyleConstants';
import {
  saveStencilStyle,
  cacheStencilStyle,
  getResetStyle,
  clearSessionStyleForStencil,
  hasSessionChanges,
} from '../styling/StencilStyleManager';

// MUI Icons
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import LinkIcon from '@mui/icons-material/Link';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignCenterIcon from '@mui/icons-material/VerticalAlignCenter';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import TableRowsIcon from '@mui/icons-material/TableRows';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ImageIcon from '@mui/icons-material/Image';
import CropFreeIcon from '@mui/icons-material/CropFree';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PhotoSizeSelectSmallIcon from '@mui/icons-material/PhotoSizeSelectSmall';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';

// Font family options - Business, Professional, and Decorative fonts
const FONT_FAMILIES = [
  // System/Default
  { id: 'system', name: 'System Default', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', category: 'System' },

  // Professional/Business Sans-Serif
  { id: 'inter', name: 'Inter', value: '"Inter", sans-serif', category: 'Business', google: 'Inter:wght@400;500;600;700' },
  { id: 'roboto', name: 'Roboto', value: '"Roboto", sans-serif', category: 'Business', google: 'Roboto:wght@400;500;700' },
  { id: 'open-sans', name: 'Open Sans', value: '"Open Sans", sans-serif', category: 'Business', google: 'Open+Sans:wght@400;500;600;700' },
  { id: 'lato', name: 'Lato', value: '"Lato", sans-serif', category: 'Business', google: 'Lato:wght@400;700;900' },
  { id: 'montserrat', name: 'Montserrat', value: '"Montserrat", sans-serif', category: 'Business', google: 'Montserrat:wght@400;500;600;700;800' },
  { id: 'poppins', name: 'Poppins', value: '"Poppins", sans-serif', category: 'Business', google: 'Poppins:wght@400;500;600;700;800' },
  { id: 'nunito', name: 'Nunito', value: '"Nunito", sans-serif', category: 'Business', google: 'Nunito:wght@400;600;700;800' },
  { id: 'source-sans', name: 'Source Sans 3', value: '"Source Sans 3", sans-serif', category: 'Business', google: 'Source+Sans+3:wght@400;500;600;700' },
  { id: 'work-sans', name: 'Work Sans', value: '"Work Sans", sans-serif', category: 'Business', google: 'Work+Sans:wght@400;500;600;700;800' },
  { id: 'dm-sans', name: 'DM Sans', value: '"DM Sans", sans-serif', category: 'Business', google: 'DM+Sans:wght@400;500;600;700' },

  // Professional Serif
  { id: 'playfair', name: 'Playfair Display', value: '"Playfair Display", serif', category: 'Elegant', google: 'Playfair+Display:wght@400;500;600;700;800' },
  { id: 'merriweather', name: 'Merriweather', value: '"Merriweather", serif', category: 'Elegant', google: 'Merriweather:wght@400;700;900' },
  { id: 'lora', name: 'Lora', value: '"Lora", serif', category: 'Elegant', google: 'Lora:wght@400;500;600;700' },
  { id: 'pt-serif', name: 'PT Serif', value: '"PT Serif", serif', category: 'Elegant', google: 'PT+Serif:wght@400;700' },
  { id: 'libre-baskerville', name: 'Libre Baskerville', value: '"Libre Baskerville", serif', category: 'Elegant', google: 'Libre+Baskerville:wght@400;700' },

  // Bold/Impact Fonts for Titles
  { id: 'oswald', name: 'Oswald', value: '"Oswald", sans-serif', category: 'Impact', google: 'Oswald:wght@400;500;600;700' },
  { id: 'bebas-neue', name: 'Bebas Neue', value: '"Bebas Neue", sans-serif', category: 'Impact', google: 'Bebas+Neue' },
  { id: 'anton', name: 'Anton', value: '"Anton", sans-serif', category: 'Impact', google: 'Anton' },
  { id: 'archivo-black', name: 'Archivo Black', value: '"Archivo Black", sans-serif', category: 'Impact', google: 'Archivo+Black' },
  { id: 'black-ops-one', name: 'Black Ops One', value: '"Black Ops One", sans-serif', category: 'Impact', google: 'Black+Ops+One' },
  { id: 'righteous', name: 'Righteous', value: '"Righteous", sans-serif', category: 'Impact', google: 'Righteous' },
  { id: 'russo-one', name: 'Russo One', value: '"Russo One", sans-serif', category: 'Impact', google: 'Russo+One' },
  { id: 'alfa-slab', name: 'Alfa Slab One', value: '"Alfa Slab One", serif', category: 'Impact', google: 'Alfa+Slab+One' },
  { id: 'titan-one', name: 'Titan One', value: '"Titan One", sans-serif', category: 'Impact', google: 'Titan+One' },
  { id: 'bungee', name: 'Bungee', value: '"Bungee", sans-serif', category: 'Impact', google: 'Bungee' },

  // Creative/Decorative
  { id: 'pacifico', name: 'Pacifico', value: '"Pacifico", cursive', category: 'Creative', google: 'Pacifico' },
  { id: 'lobster', name: 'Lobster', value: '"Lobster", cursive', category: 'Creative', google: 'Lobster' },
  { id: 'satisfy', name: 'Satisfy', value: '"Satisfy", cursive', category: 'Creative', google: 'Satisfy' },
  { id: 'permanent-marker', name: 'Permanent Marker', value: '"Permanent Marker", cursive', category: 'Creative', google: 'Permanent+Marker' },
  { id: 'bangers', name: 'Bangers', value: '"Bangers", cursive', category: 'Creative', google: 'Bangers' },
  { id: 'fredoka', name: 'Fredoka', value: '"Fredoka", sans-serif', category: 'Creative', google: 'Fredoka:wght@400;500;600;700' },
  { id: 'comfortaa', name: 'Comfortaa', value: '"Comfortaa", cursive', category: 'Creative', google: 'Comfortaa:wght@400;500;600;700' },
  { id: 'caveat', name: 'Caveat', value: '"Caveat", cursive', category: 'Creative', google: 'Caveat:wght@400;500;600;700' },

  // Monospace
  { id: 'fira-code', name: 'Fira Code', value: '"Fira Code", monospace', category: 'Monospace', google: 'Fira+Code:wght@400;500;600;700' },
  { id: 'jetbrains-mono', name: 'JetBrains Mono', value: '"JetBrains Mono", monospace', category: 'Monospace', google: 'JetBrains+Mono:wght@400;500;600;700' },
  { id: 'source-code', name: 'Source Code Pro', value: '"Source Code Pro", monospace', category: 'Monospace', google: 'Source+Code+Pro:wght@400;500;600;700' },
];

// Group fonts by category for the picker UI
const FONT_CATEGORIES = ['System', 'Business', 'Elegant', 'Impact', 'Creative', 'Monospace'];

// Style variant icon component
const VariantIcon = ({ variant, size = 16 }) => {
  const s = size;
  const p = 2;
  const w = s - p * 2;
  const h = s - p * 2;

  switch (variant) {
    case 'floating':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <rect x={p} y={p} width={w} height={h} rx={2} fill="white" stroke="#e5e7eb" strokeWidth="1" />
          <rect x={p + 1} y={h - 1} width={w - 2} height={2} rx={1} fill="#d1d5db" opacity="0.5" />
        </svg>
      );
    case 'accent':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <rect x={p} y={p} width={w} height={h} rx={2} fill="white" stroke="#e5e7eb" strokeWidth="1" />
          <rect x={p} y={p} width={2} height={h} rx={1} fill="currentColor" />
        </svg>
      );
    case 'filled':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <rect x={p} y={p} width={w} height={h} rx={2} fill="currentColor" />
        </svg>
      );
    case 'tinted':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <rect x={p} y={p} width={w} height={h} rx={2} fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
        </svg>
      );
    case 'plain':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <rect x={p} y={p} width={w} height={h} rx={2} fill="white" stroke="#d1d5db" strokeWidth="1" />
        </svg>
      );
    default:
      return null;
  }
};

// Global style clipboard for copy/paste style
let styleClipboard = null;

// Track loaded Google Fonts to avoid duplicate loading
const loadedFonts = new Set();

// Load a Google Font dynamically
function loadGoogleFont(fontDef) {
  if (!fontDef.google || loadedFonts.has(fontDef.id)) return;

  loadedFonts.add(fontDef.id);
  const link = document.createElement('link');
  link.href = `https://fonts.googleapis.com/css2?family=${fontDef.google}&display=swap`;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}

export default function ContextualToolbar({ viewport, packRegistry, containerRef, onClose, onEditLabel }) {
  const { elements, addElement, updateElement, deleteSelected, duplicateSelected } = useDiagram();
  const { selectedIds, selectedElements, clearSelection } = useDiagramSelection();

  // State for style popovers
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showBorderPicker, setShowBorderPicker] = useState(false);
  const [showOpacityPicker, setShowOpacityPicker] = useState(false);
  const [showAlignPicker, setShowAlignPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showSameSizeMenu, setShowSameSizeMenu] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [hasClipboardStyle, setHasClipboardStyle] = useState(!!styleClipboard);
  const [selectedColorPreset, setSelectedColorPreset] = useState('default');
  const [selectedTextColorPreset, setSelectedTextColorPreset] = useState('default');
  const toolbarRef = useRef(null);

  // Get colors for the current preset
  const currentPresetColors = useMemo(() => {
    return COLOR_PRESETS[selectedColorPreset]?.colors || COLOR_PALETTE;
  }, [selectedColorPreset]);

  // Close all popovers
  const closeAllPopovers = useCallback(() => {
    setShowColorPicker(false);
    setShowStylePicker(false);
    setShowSizePicker(false);
    setShowOverflowMenu(false);
    setShowBorderPicker(false);
    setShowOpacityPicker(false);
    setShowAlignPicker(false);
    setShowFontPicker(false);
    setShowSameSizeMenu(false);
    setShowTextColorPicker(false);
  }, []);

  // Get colors for text color picker preset
  const currentTextColorPresetColors = useMemo(() => {
    return COLOR_PRESETS[selectedTextColorPreset]?.colors || COLOR_PALETTE;
  }, [selectedTextColorPreset]);

  // Close popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        closeAllPopovers();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeAllPopovers]);

  // Get selected element's stencil (for single selection)
  const selectedStencil = useMemo(() => {
    if (selectedElements?.length !== 1) return null;
    const el = selectedElements[0];
    const pack = packRegistry?.get?.(el.packId);
    return pack?.stencils?.find(s => s.id === el.type);
  }, [selectedElements, packRegistry]);

  // Get current style values from first selected element
  const currentStyles = useMemo(() => {
    if (!selectedElements?.length) return {};
    const el = selectedElements[0];
    return {
      color: el.color || selectedStencil?.color || '#3b82f6',
      textColor: el.textColor || null, // null means auto (based on variant)
      styleVariant: el.styleVariant || 'floating',
      fontSize: el.fontSize || 13,
      fontFamily: el.fontFamily || null,
      fontWeight: el.fontWeight || 'normal',
      fontStyle: el.fontStyle || 'normal',
      textDecoration: el.textDecoration || 'none',
      textAlign: el.textAlign || 'center',
      verticalAlign: el.verticalAlign || 'center',
      borderStyle: el.borderStyle || 'solid',
      borderWidth: el.borderWidth ?? 1,
      borderRadius: el.borderRadius ?? 8,
      borderColor: el.borderColor || null,
      showShadow: el.showShadow ?? true,
      showAccentBar: el.showAccentBar || false,
      opacity: el.opacity ?? 1,
    };
  }, [selectedElements, selectedStencil]);

  // Get current font family definition
  const currentFontDef = useMemo(() => {
    if (!currentStyles.fontFamily) return FONT_FAMILIES[0]; // System default
    return FONT_FAMILIES.find(f => f.value === currentStyles.fontFamily) || FONT_FAMILIES[0];
  }, [currentStyles.fontFamily]);

  // Load font when it changes
  useEffect(() => {
    if (currentFontDef && currentFontDef.google) {
      loadGoogleFont(currentFontDef);
    }
  }, [currentFontDef]);

  // Check if selected elements support style variants (rect-based stencils)
  const supportsStyleVariants = useMemo(() => {
    if (!selectedElements?.length || !packRegistry) return false;
    return selectedElements.every(el => {
      const pack = packRegistry.get?.(el.packId);
      const stencil = pack?.stencils?.find(s => s.id === el.type);
      return stencil?.shape === 'rect';
    });
  }, [selectedElements, packRegistry]);

  // Handle style change for all selected elements
  const handleStyleChange = useCallback((property, value, saveAsDefault = false) => {
    selectedElements?.forEach(el => {
      updateElement(el.id, { [property]: value });

      // Auto-cache to session (localStorage) for session persistence
      if (el.packId && el.type) {
        cacheStencilStyle(el.packId, el.type, { [property]: value });
      }

      // If saveAsDefault, also save to user profile (database)
      if (saveAsDefault && el.packId && el.type) {
        saveStencilStyle(el.packId, el.type, { [property]: value });
      }
    });
  }, [selectedElements, updateElement]);

  // Text formatting toggles
  const toggleBold = () => {
    const isBold = currentStyles.fontWeight === 'bold' || currentStyles.fontWeight === '600' || currentStyles.fontWeight === '700';
    handleStyleChange('fontWeight', isBold ? 'normal' : 'bold');
  };
  const toggleItalic = () => handleStyleChange('fontStyle', currentStyles.fontStyle === 'italic' ? 'normal' : 'italic');
  const toggleUnderline = () => handleStyleChange('textDecoration', currentStyles.textDecoration === 'underline' ? 'none' : 'underline');

  // Font size increment/decrement
  const incrementFontSize = useCallback(() => {
    const newSize = Math.min((currentStyles.fontSize || 13) + 1, 72);
    handleStyleChange('fontSize', newSize);
  }, [currentStyles.fontSize, handleStyleChange]);

  const decrementFontSize = useCallback(() => {
    const newSize = Math.max((currentStyles.fontSize || 13) - 1, 8);
    handleStyleChange('fontSize', newSize);
  }, [currentStyles.fontSize, handleStyleChange]);

  // Font family change
  const handleFontFamilyChange = useCallback((fontDef) => {
    loadGoogleFont(fontDef);
    handleStyleChange('fontFamily', fontDef.value);
    setShowFontPicker(false);
  }, [handleStyleChange]);

  // Copy style from selected element
  const handleCopyStyle = useCallback(() => {
    if (!selectedElements?.length) return;
    const el = selectedElements[0];
    styleClipboard = {
      color: el.color,
      textColor: el.textColor,
      fontFamily: el.fontFamily,
      fontSize: el.fontSize,
      fontWeight: el.fontWeight,
      fontStyle: el.fontStyle,
      textDecoration: el.textDecoration,
      textAlign: el.textAlign,
      verticalAlign: el.verticalAlign,
      borderStyle: el.borderStyle,
      borderWidth: el.borderWidth,
      borderRadius: el.borderRadius,
      borderColor: el.borderColor,
      showShadow: el.showShadow,
      showAccentBar: el.showAccentBar,
      opacity: el.opacity,
    };
    setHasClipboardStyle(true);
  }, [selectedElements]);

  // Paste style to selected elements
  const handlePasteStyle = useCallback(() => {
    if (!styleClipboard || !selectedElements?.length) return;
    selectedElements.forEach(el => {
      updateElement(el.id, { ...styleClipboard });
    });
  }, [selectedElements, updateElement]);

  // Edit label handler
  const handleEditLabel = useCallback(() => {
    if (!selectedElements?.length) return;
    onEditLabel?.(selectedElements[0].id);
  }, [selectedElements, onEditLabel]);

  // Make Same Size handlers
  const handleMakeSameWidth = useCallback(() => {
    if (!selectedElements || selectedElements.length < 2) return;
    // Use the first selected element as reference
    const refWidth = selectedElements[0].size?.width || 100;
    selectedElements.forEach(el => {
      updateElement(el.id, { size: { ...el.size, width: refWidth } });
    });
    setShowSameSizeMenu(false);
  }, [selectedElements, updateElement]);

  const handleMakeSameHeight = useCallback(() => {
    if (!selectedElements || selectedElements.length < 2) return;
    const refHeight = selectedElements[0].size?.height || 60;
    selectedElements.forEach(el => {
      updateElement(el.id, { size: { ...el.size, height: refHeight } });
    });
    setShowSameSizeMenu(false);
  }, [selectedElements, updateElement]);

  const handleMakeSameSize = useCallback(() => {
    if (!selectedElements || selectedElements.length < 2) return;
    const refWidth = selectedElements[0].size?.width || 100;
    const refHeight = selectedElements[0].size?.height || 60;
    selectedElements.forEach(el => {
      updateElement(el.id, { size: { width: refWidth, height: refHeight } });
    });
    setShowSameSizeMenu(false);
  }, [selectedElements, updateElement]);

  // Calculate toolbar position based on selection bounds
  const toolbarPosition = useMemo(() => {
    if (!selectedElements || selectedElements.length === 0 || !viewport) {
      return null;
    }

    // Get canvas container position on screen
    const containerRect = containerRef?.current?.getBoundingClientRect();

    // Calculate bounding box of selection
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    selectedElements.forEach(el => {
      const x = el.x || 0;
      const y = el.y || 0;
      const w = el.size?.width || 100;
      const h = el.size?.height || 60;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });

    // Convert to screen coordinates
    // Formula: (canvasCoord + viewport.offset) * viewport.scale + containerOffset
    const containerLeft = containerRect?.left || 0;
    const containerTop = containerRect?.top || 0;

    const screenX = (minX + viewport.x) * viewport.scale + containerLeft;
    const screenY = (minY + viewport.y) * viewport.scale + containerTop;
    const screenWidth = (maxX - minX) * viewport.scale;

    // Position toolbar centered above the selection
    // Left: center of selection, Top: 30px above the top of the stencil (toolbar bottom)
    return {
      left: screenX + screenWidth / 2,
      top: screenY - 30, // 30px gap above stencil (transform will shift by toolbar height)
    };
  }, [selectedElements, viewport, containerRef]);

  // Check if any selected element is locked
  const hasLockedElements = useMemo(() => {
    return selectedElements?.some(el => el.locked);
  }, [selectedElements]);

  // Check if selected element is a frame
  const isFrameSelected = useMemo(() => {
    if (selectedElements?.length !== 1) return false;
    const el = selectedElements[0];
    return el.type === 'frame' || el.isFrame;
  }, [selectedElements]);

  // Get elements inside frame bounds
  const getElementsInFrame = useCallback((frame) => {
    if (!frame) return [];
    const frameX = frame.x || 0;
    const frameY = frame.y || 0;
    const frameW = frame.size?.width || 400;
    const frameH = frame.size?.height || 300;

    return elements.filter(el => {
      if (el.id === frame.id) return false; // Exclude the frame itself
      const elX = el.x || 0;
      const elY = el.y || 0;
      const elW = el.size?.width || 100;
      const elH = el.size?.height || 60;

      // Check if element is fully inside frame
      return elX >= frameX && elY >= frameY &&
             (elX + elW) <= (frameX + frameW) &&
             (elY + elH) <= (frameY + frameH);
    });
  }, [elements]);

  // Export frame as SVG
  const handleExportFrameSvg = useCallback(() => {
    if (!selectedElements?.length || !isFrameSelected) return;
    const frame = selectedElements[0];
    const frameX = frame.x || 0;
    const frameY = frame.y || 0;
    const frameW = frame.size?.width || 400;
    const frameH = frame.size?.height || 300;

    // Get the canvas SVG element
    const canvasSvg = document.querySelector('.ds-canvas-area svg');
    if (!canvasSvg) return;

    // Clone the SVG
    const clonedSvg = canvasSvg.cloneNode(true);

    // Update viewBox to frame bounds
    clonedSvg.setAttribute('viewBox', `${frameX} ${frameY} ${frameW} ${frameH}`);
    clonedSvg.setAttribute('width', frameW);
    clonedSvg.setAttribute('height', frameH);

    // Remove elements outside frame bounds and the frame element itself
    const elementsToRemove = [];
    clonedSvg.querySelectorAll('[data-element-id]').forEach(el => {
      const elId = el.getAttribute('data-element-id');
      const originalEl = elements.find(e => e.id === elId);
      if (!originalEl) {
        elementsToRemove.push(el);
        return;
      }

      // Remove frame itself
      if (originalEl.id === frame.id) {
        elementsToRemove.push(el);
        return;
      }

      const elX = originalEl.x || 0;
      const elY = originalEl.y || 0;
      const elW = originalEl.size?.width || 100;
      const elH = originalEl.size?.height || 60;

      // Check if element is NOT inside frame
      const isInside = elX >= frameX && elY >= frameY &&
                       (elX + elW) <= (frameX + frameW) &&
                       (elY + elH) <= (frameY + frameH);
      if (!isInside) {
        elementsToRemove.push(el);
      }
    });

    elementsToRemove.forEach(el => el.remove());

    // Remove grid, guides, and other non-content elements
    clonedSvg.querySelectorAll('.ds-grid-pattern, .ds-snap-guides, .ds-selection-box, .ds-marquee').forEach(el => el.remove());

    // Create download
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${frame.label || 'frame'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedElements, isFrameSelected, elements]);

  // Export frame as PNG
  const handleExportFramePng = useCallback(() => {
    if (!selectedElements?.length || !isFrameSelected) return;
    const frame = selectedElements[0];
    const frameX = frame.x || 0;
    const frameY = frame.y || 0;
    const frameW = frame.size?.width || 400;
    const frameH = frame.size?.height || 300;

    // Get the canvas SVG element
    const canvasSvg = document.querySelector('.ds-canvas-area svg');
    if (!canvasSvg) return;

    // Clone the SVG
    const clonedSvg = canvasSvg.cloneNode(true);

    // Update viewBox to frame bounds
    clonedSvg.setAttribute('viewBox', `${frameX} ${frameY} ${frameW} ${frameH}`);
    clonedSvg.setAttribute('width', frameW * 2); // 2x for better quality
    clonedSvg.setAttribute('height', frameH * 2);

    // Remove elements outside frame bounds and the frame element itself
    const elementsToRemove = [];
    clonedSvg.querySelectorAll('[data-element-id]').forEach(el => {
      const elId = el.getAttribute('data-element-id');
      const originalEl = elements.find(e => e.id === elId);
      if (!originalEl) {
        elementsToRemove.push(el);
        return;
      }

      if (originalEl.id === frame.id) {
        elementsToRemove.push(el);
        return;
      }

      const elX = originalEl.x || 0;
      const elY = originalEl.y || 0;
      const elW = originalEl.size?.width || 100;
      const elH = originalEl.size?.height || 60;

      const isInside = elX >= frameX && elY >= frameY &&
                       (elX + elW) <= (frameX + frameW) &&
                       (elY + elH) <= (frameY + frameH);
      if (!isInside) {
        elementsToRemove.push(el);
      }
    });

    elementsToRemove.forEach(el => el.remove());
    clonedSvg.querySelectorAll('.ds-grid-pattern, .ds-snap-guides, .ds-selection-box, .ds-marquee').forEach(el => el.remove());

    // Add white background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', frameX);
    bg.setAttribute('y', frameY);
    bg.setAttribute('width', frameW);
    bg.setAttribute('height', frameH);
    bg.setAttribute('fill', 'white');
    clonedSvg.insertBefore(bg, clonedSvg.firstChild);

    // Convert SVG to PNG via canvas
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = frameW * 2;
      canvas.height = frameH * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${frame.label || 'frame'}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, [selectedElements, isFrameSelected, elements]);

  // Duplicate frame with contents to an empty spot
  const handleDuplicateFrame = useCallback(() => {
    if (!selectedElements?.length || !isFrameSelected) return;
    const frame = selectedElements[0];
    const frameX = frame.x || 0;
    const frameY = frame.y || 0;
    const frameW = frame.size?.width || 400;
    const frameH = frame.size?.height || 300;

    // Find elements inside the frame
    const elementsInFrame = getElementsInFrame(frame);

    // Calculate offset for new frame (place to the right with 50px gap)
    const offsetX = frameW + 50;
    const offsetY = 0;

    // Create new frame with offset position
    const newFrameId = `frame-${Date.now()}`;
    const newFrame = {
      ...frame,
      id: newFrameId,
      x: frameX + offsetX,
      y: frameY + offsetY,
      label: frame.label ? `${frame.label} (copy)` : 'Frame (copy)',
    };

    // Create copies of elements inside frame with offset positions
    const newElements = elementsInFrame.map((el, index) => ({
      ...el,
      id: `${el.type || 'element'}-${Date.now()}-${index}`,
      x: (el.x || 0) + offsetX,
      y: (el.y || 0) + offsetY,
    }));

    // Add frame first (so it's at the bottom layer)
    addElement(newFrame);
    // Then add all elements inside
    newElements.forEach(el => addElement(el));
  }, [selectedElements, isFrameSelected, getElementsInFrame, addElement]);

  // Toggle lock on selected elements
  const handleToggleLock = useCallback(() => {
    selectedElements?.forEach(el => {
      updateElement(el.id, { locked: !el.locked });
    });
  }, [selectedElements, updateElement]);

  // Reset element styles to default (user saved or system default)
  const handleResetToDefault = useCallback(() => {
    selectedElements?.forEach(el => {
      if (!el.packId || !el.type) return;

      // Get the stencil definition for color fallback
      const pack = packRegistry?.get?.(el.packId);
      const stencilDef = pack?.stencils?.find(s => s.id === el.type);

      // Get the reset style (profile style or system defaults)
      const resetStyle = getResetStyle(el.packId, el.type, stencilDef);

      // Clear session cache for this stencil
      clearSessionStyleForStencil(el.packId, el.type);

      // Apply reset style to element
      updateElement(el.id, resetStyle);
    });
  }, [selectedElements, updateElement, packRegistry]);

  // Check if any selected element has session changes (can be reset)
  const canReset = useMemo(() => {
    if (!selectedElements?.length) return false;
    return selectedElements.some(el =>
      el.packId && el.type && hasSessionChanges(el.packId, el.type)
    );
  }, [selectedElements]);

  // Bring to front
  const handleBringToFront = useCallback(() => {
    const maxZ = Math.max(...elements.map(el => el.zIndex || 0));
    selectedElements?.forEach((el, i) => {
      updateElement(el.id, { zIndex: maxZ + i + 1 });
    });
  }, [elements, selectedElements, updateElement]);

  // Send to back
  const handleSendToBack = useCallback(() => {
    const minZ = Math.min(...elements.map(el => el.zIndex || 0));
    selectedElements?.forEach((el, i) => {
      updateElement(el.id, { zIndex: minZ - (selectedElements.length - i) });
    });
  }, [elements, selectedElements, updateElement]);

  // Rotate 90° clockwise
  const handleRotate90CW = useCallback(() => {
    selectedElements?.forEach(el => {
      if (el.locked) return;
      const currentRotation = el.rotation || 0;
      let newRotation = currentRotation + 90;
      // Normalize to -180 to 180
      while (newRotation > 180) newRotation -= 360;
      updateElement(el.id, { rotation: newRotation });
    });
  }, [selectedElements, updateElement]);

  // Rotate 90° counter-clockwise
  const handleRotate90CCW = useCallback(() => {
    selectedElements?.forEach(el => {
      if (el.locked) return;
      const currentRotation = el.rotation || 0;
      let newRotation = currentRotation - 90;
      // Normalize to -180 to 180
      while (newRotation < -180) newRotation += 360;
      updateElement(el.id, { rotation: newRotation });
    });
  }, [selectedElements, updateElement]);

  // Flip horizontal (mirror along vertical axis)
  const handleFlipHorizontal = useCallback(() => {
    selectedElements?.forEach(el => {
      if (el.locked) return;
      const currentScaleX = el.scaleX ?? 1;
      updateElement(el.id, { scaleX: currentScaleX * -1 });
    });
  }, [selectedElements, updateElement]);

  // Flip vertical (mirror along horizontal axis)
  const handleFlipVertical = useCallback(() => {
    selectedElements?.forEach(el => {
      if (el.locked) return;
      const currentScaleY = el.scaleY ?? 1;
      updateElement(el.id, { scaleY: currentScaleY * -1 });
    });
  }, [selectedElements, updateElement]);

  // Reset transform (rotation, scaleX, scaleY back to defaults)
  const handleResetTransform = useCallback(() => {
    selectedElements?.forEach(el => {
      if (el.locked) return;
      updateElement(el.id, { rotation: 0, scaleX: 1, scaleY: 1 });
    });
  }, [selectedElements, updateElement]);

  // Check if any selected element has transforms applied
  const hasTransforms = useMemo(() => {
    return selectedElements?.some(el =>
      (el.rotation && el.rotation !== 0) ||
      (el.scaleX !== undefined && el.scaleX !== 1) ||
      (el.scaleY !== undefined && el.scaleY !== 1)
    );
  }, [selectedElements]);

  // Alignment functions
  const alignElements = useCallback((alignment) => {
    if (!selectedElements || selectedElements.length < 2) return;

    let targetValue;
    const updates = [];

    switch (alignment) {
      case 'left': {
        targetValue = Math.min(...selectedElements.map(el => el.x || 0));
        selectedElements.forEach(el => {
          updates.push({ id: el.id, x: targetValue });
        });
        break;
      }
      case 'center-h': {
        const centers = selectedElements.map(el => (el.x || 0) + (el.size?.width || 100) / 2);
        targetValue = centers.reduce((a, b) => a + b, 0) / centers.length;
        selectedElements.forEach(el => {
          updates.push({ id: el.id, x: targetValue - (el.size?.width || 100) / 2 });
        });
        break;
      }
      case 'right': {
        targetValue = Math.max(...selectedElements.map(el => (el.x || 0) + (el.size?.width || 100)));
        selectedElements.forEach(el => {
          updates.push({ id: el.id, x: targetValue - (el.size?.width || 100) });
        });
        break;
      }
      case 'top': {
        targetValue = Math.min(...selectedElements.map(el => el.y || 0));
        selectedElements.forEach(el => {
          updates.push({ id: el.id, y: targetValue });
        });
        break;
      }
      case 'center-v': {
        const centers = selectedElements.map(el => (el.y || 0) + (el.size?.height || 60) / 2);
        targetValue = centers.reduce((a, b) => a + b, 0) / centers.length;
        selectedElements.forEach(el => {
          updates.push({ id: el.id, y: targetValue - (el.size?.height || 60) / 2 });
        });
        break;
      }
      case 'bottom': {
        targetValue = Math.max(...selectedElements.map(el => (el.y || 0) + (el.size?.height || 60)));
        selectedElements.forEach(el => {
          updates.push({ id: el.id, y: targetValue - (el.size?.height || 60) });
        });
        break;
      }
    }

    updates.forEach(({ id, ...update }) => updateElement(id, update));
  }, [selectedElements, updateElement]);

  // Distribute elements evenly
  const distributeElements = useCallback((direction) => {
    if (!selectedElements || selectedElements.length < 3) return;

    const sorted = [...selectedElements].sort((a, b) =>
      direction === 'horizontal' ? (a.x || 0) - (b.x || 0) : (a.y || 0) - (b.y || 0)
    );

    if (direction === 'horizontal') {
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalWidth = sorted.reduce((sum, el) => sum + (el.size?.width || 100), 0);
      const totalSpace = ((last.x || 0) + (last.size?.width || 100)) - (first.x || 0);
      const gap = (totalSpace - totalWidth) / (sorted.length - 1);

      let currentX = first.x || 0;
      sorted.forEach((el, i) => {
        if (i > 0) {
          updateElement(el.id, { x: currentX });
        }
        currentX += (el.size?.width || 100) + gap;
      });
    } else {
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalHeight = sorted.reduce((sum, el) => sum + (el.size?.height || 60), 0);
      const totalSpace = ((last.y || 0) + (last.size?.height || 60)) - (first.y || 0);
      const gap = (totalSpace - totalHeight) / (sorted.length - 1);

      let currentY = first.y || 0;
      sorted.forEach((el, i) => {
        if (i > 0) {
          updateElement(el.id, { y: currentY });
        }
        currentY += (el.size?.height || 60) + gap;
      });
    }
  }, [selectedElements, updateElement]);

  // Forward wheel events to canvas for panning/zooming
  // NOTE: Must be defined BEFORE early return to maintain consistent hook order
  const handleWheel = useCallback((e) => {
    // Find the canvas element and dispatch the wheel event to it
    const canvas = document.querySelector('.ds-canvas-area');
    if (canvas) {
      const wheelEvent = new WheelEvent('wheel', {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaMode: e.deltaMode,
        clientX: e.clientX,
        clientY: e.clientY,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        bubbles: true,
      });
      canvas.dispatchEvent(wheelEvent);
    }
  }, []);

  // Don't render if nothing selected or position invalid
  // NOTE: All hooks must be called BEFORE this early return
  if (!toolbarPosition || selectedElements?.length === 0) {
    return null;
  }

  const multipleSelected = selectedElements.length > 1;

  const isBold = currentStyles.fontWeight === 'bold' || currentStyles.fontWeight === '600' || currentStyles.fontWeight === '700';
  const isItalic = currentStyles.fontStyle === 'italic';
  const isUnderline = currentStyles.textDecoration === 'underline';

  return (
    <div
      ref={toolbarRef}
      className="ds-contextual-toolbar"
      style={{
        left: toolbarPosition.left,
        top: Math.max(toolbarPosition.top, 80), // Ensure toolbar stays visible (80px accounts for toolbar height + margin)
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={handleWheel}
    >
      {/* Color Picker with Presets and Opacity */}
      <div className="ds-ct-group" style={{ position: 'relative' }}>
        <button
          className="ds-ct-btn"
          onClick={() => {
            closeAllPopovers();
            setShowColorPicker(!showColorPicker);
          }}
          title="Color & Opacity"
        >
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                backgroundColor: currentStyles.color,
                border: '2px solid rgba(0,0,0,0.1)',
                opacity: currentStyles.opacity ?? 1,
              }}
            />
            {/* Opacity indicator bar at bottom */}
            <div style={{
              position: 'absolute',
              bottom: -2,
              left: 0,
              right: 0,
              height: 3,
              background: 'linear-gradient(to right, transparent, currentColor)',
              borderRadius: 1,
              opacity: 0.3,
            }} />
          </div>
        </button>

        {showColorPicker && (
          <div
            className="ds-ct-popover ds-ct-color-popover"
            onWheel={(e) => e.stopPropagation()}
          >
            {/* Preset Tabs */}
            <div className="ds-ct-preset-tabs">
              {COLOR_PRESET_ORDER.map((presetId) => (
                <button
                  key={presetId}
                  className={`ds-ct-preset-tab ${selectedColorPreset === presetId ? 'active' : ''}`}
                  onClick={() => setSelectedColorPreset(presetId)}
                >
                  {COLOR_PRESETS[presetId].name}
                </button>
              ))}
            </div>

            {/* Color Grid */}
            <div className="ds-ct-color-grid">
              {currentPresetColors.map((color) => (
                <button
                  key={color.id}
                  className={`ds-ct-color-option ${currentStyles.color === color.hex ? 'active' : ''}`}
                  style={{ backgroundColor: color.hex }}
                  onClick={() => {
                    handleStyleChange('color', color.hex, true);
                  }}
                  title={color.name}
                />
              ))}
            </div>

            {/* Custom Color */}
            <div className="ds-ct-color-custom">
              <input
                type="color"
                value={currentStyles.color}
                onChange={(e) => handleStyleChange('color', e.target.value, true)}
                title="Custom color"
              />
              <span>Custom</span>
            </div>

            {/* Opacity Slider - Integrated */}
            {supportsStyleVariants && (
              <div className="ds-ct-color-opacity">
                <span className="ds-ct-opacity-label">Opacity</span>
                <div className="ds-ct-opacity-slider">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round((currentStyles.opacity || 1) * 100)}
                    onChange={(e) => {
                      handleStyleChange('opacity', parseInt(e.target.value) / 100);
                    }}
                  />
                  <span className="ds-ct-opacity-value">{Math.round((currentStyles.opacity || 1) * 100)}%</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Label Button */}
      {selectedElements?.length === 1 && (
        <button
          className="ds-ct-btn"
          onClick={handleEditLabel}
          title="Edit Label (Double-click)"
        >
          <EditIcon fontSize="small" style={{ fontSize: 16 }} />
        </button>
      )}

      {/* Copy/Paste Style */}
      <div className="ds-ct-group">
        <button
          className="ds-ct-btn"
          onClick={handleCopyStyle}
          title="Copy Style"
        >
          <FormatPaintIcon fontSize="small" style={{ fontSize: 16 }} />
        </button>
        {hasClipboardStyle && (
          <button
            className="ds-ct-btn"
            onClick={handlePasteStyle}
            title="Paste Style"
          >
            <ContentPasteIcon fontSize="small" style={{ fontSize: 16 }} />
          </button>
        )}
      </div>

      <div className="ds-ct-divider" />

      {/* Border & Shape Picker */}
      {supportsStyleVariants && (
        <div className="ds-ct-group" style={{ position: 'relative' }}>
          <button
            className="ds-ct-btn"
            onClick={() => {
              setShowBorderPicker(!showBorderPicker);
              setShowColorPicker(false);
              setShowStylePicker(false);
              setShowSizePicker(false);
              setShowOpacityPicker(false);
              setShowAlignPicker(false);
            }}
            title="Border & Shape"
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <rect
                x="2" y="2" width="12" height="12"
                rx={currentStyles.borderRadius >= 999 ? 6 : Math.min(currentStyles.borderRadius, 4)}
                fill="none"
                stroke={currentStyles.borderColor || 'currentColor'}
                strokeWidth={Math.max(currentStyles.borderWidth, 1)}
                strokeDasharray={currentStyles.borderStyle === 'dashed' ? '3,2' : currentStyles.borderStyle === 'dotted' ? '1,2' : 'none'}
                opacity={currentStyles.borderWidth === 0 ? 0.3 : 1}
              />
            </svg>
          </button>

          {showBorderPicker && (
            <div
              className="ds-ct-popover ds-ct-border-popover"
              onWheel={(e) => e.stopPropagation()}
            >
              {/* Corner Style */}
              <div className="ds-ct-border-section">
                <span className="ds-ct-border-label">Corners</span>
                <div className="ds-ct-corner-options">
                  {CORNER_STYLES.map((corner) => (
                    <button
                      key={corner.id}
                      className={`ds-ct-corner-option ${currentStyles.borderRadius === corner.value ? 'active' : ''}`}
                      onClick={() => handleStyleChange('borderRadius', corner.value)}
                      title={corner.label}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20">
                        <rect
                          x="3" y="3" width="14" height="14"
                          rx={corner.value >= 999 ? 7 : corner.value}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Border Style */}
              <div className="ds-ct-border-section">
                <span className="ds-ct-border-label">Border Style</span>
                <div className="ds-ct-border-style-options">
                  {BORDER_STYLES.map((style) => (
                    <button
                      key={style.id}
                      className={`ds-ct-border-style-option ${currentStyles.borderStyle === style.value ? 'active' : ''}`}
                      onClick={() => handleStyleChange('borderStyle', style.value)}
                      title={style.label}
                    >
                      <svg width="28" height="8" viewBox="0 0 28 8">
                        {style.value === 'none' ? (
                          <line x1="4" y1="4" x2="24" y2="4" stroke="currentColor" strokeWidth="1.5" opacity="0.3" strokeDasharray="2,2" />
                        ) : (
                          <line
                            x1="2" y1="4" x2="26" y2="4"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray={style.value === 'dashed' ? '6,3' : style.value === 'dotted' ? '2,2' : 'none'}
                          />
                        )}
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Border Thickness */}
              <div className="ds-ct-border-section">
                <span className="ds-ct-border-label">Thickness</span>
                <div className="ds-ct-thickness-options">
                  {BORDER_WIDTHS.map((width) => (
                    <button
                      key={width.id}
                      className={`ds-ct-thickness-option ${currentStyles.borderWidth === width.value ? 'active' : ''}`}
                      onClick={() => handleStyleChange('borderWidth', width.value)}
                      title={width.label}
                    >
                      {width.value === 0 ? (
                        <span style={{ fontSize: 10, opacity: 0.6 }}>None</span>
                      ) : (
                        <div style={{
                          width: 20,
                          height: width.value,
                          backgroundColor: 'currentColor',
                          borderRadius: 1,
                        }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Border Color */}
              <div className="ds-ct-border-section">
                <span className="ds-ct-border-label">Border Color</span>
                <div className="ds-ct-border-color-row">
                  <button
                    className={`ds-ct-border-color-option ${!currentStyles.borderColor ? 'active' : ''}`}
                    onClick={() => handleStyleChange('borderColor', null)}
                    title="Auto (from theme)"
                  >
                    <span style={{ fontSize: 10 }}>Auto</span>
                  </button>
                  {COLOR_PALETTE.slice(0, 6).map((color) => (
                    <button
                      key={color.id}
                      className={`ds-ct-border-color-swatch ${currentStyles.borderColor === color.hex ? 'active' : ''}`}
                      style={{ backgroundColor: color.hex }}
                      onClick={() => handleStyleChange('borderColor', color.hex)}
                      title={color.name}
                    />
                  ))}
                  <div className="ds-ct-border-color-custom">
                    <input
                      type="color"
                      value={currentStyles.borderColor || currentStyles.color}
                      onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                      title="Custom color"
                    />
                  </div>
                </div>
              </div>

              {/* Shadow Toggle */}
              <div className="ds-ct-border-section">
                <button
                  className={`ds-ct-shadow-toggle ${currentStyles.showShadow ? 'active' : ''}`}
                  onClick={() => handleStyleChange('showShadow', !currentStyles.showShadow)}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor" opacity="0.15" />
                    <rect x="4" y="4" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  <span>Shadow</span>
                  <span className="ds-ct-toggle-indicator">{currentStyles.showShadow ? 'On' : 'Off'}</span>
                </button>
              </div>

              {/* Accent Bar Toggle */}
              <div className="ds-ct-border-section">
                <button
                  className={`ds-ct-shadow-toggle ${currentStyles.showAccentBar ? 'active' : ''}`}
                  onClick={() => handleStyleChange('showAccentBar', !currentStyles.showAccentBar)}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />
                    <rect x="2" y="2" width="3" height="12" rx="1" fill={currentStyles.color} />
                  </svg>
                  <span>Accent Bar</span>
                  <span className="ds-ct-toggle-indicator">{currentStyles.showAccentBar ? 'On' : 'Off'}</span>
                </button>
              </div>

              {/* Save as Default for this stencil type */}
              {selectedElements?.length === 1 && selectedElements[0].packId && selectedElements[0].type && (
                <div className="ds-ct-border-section ds-ct-save-section">
                  <button
                    className="ds-ct-save-default-btn"
                    onClick={() => {
                      const el = selectedElements[0];
                      const styleProps = {
                        color: currentStyles.color,
                        borderStyle: currentStyles.borderStyle,
                        borderWidth: currentStyles.borderWidth,
                        borderRadius: currentStyles.borderRadius,
                        borderColor: currentStyles.borderColor,
                        showShadow: currentStyles.showShadow,
                        showAccentBar: currentStyles.showAccentBar,
                        opacity: currentStyles.opacity,
                      };
                      saveStencilStyle(el.packId, el.type, styleProps);
                      setShowBorderPicker(false);
                    }}
                    title="Save these settings as default for all stencils of this type"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14">
                      <path d="M11 1H3C1.9 1 1 1.9 1 3V11C1 12.1 1.9 13 3 13H11C12.1 13 13 12.1 13 11V3C13 1.9 12.1 1 11 1ZM7 11C5.34 11 4 9.66 4 8C4 6.34 5.34 5 7 5C8.66 5 10 6.34 10 8C10 9.66 8.66 11 7 11ZM10 4H4V2H10V4Z" fill="currentColor"/>
                    </svg>
                    <span>Save as Default</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      
      {/* Text Color Picker */}
      <div className="ds-ct-group" style={{ position: 'relative' }}>
        <button
          className="ds-ct-btn"
          onClick={() => {
            closeAllPopovers();
            setShowTextColorPicker(!showTextColorPicker);
          }}
          title="Text Color"
        >
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{
              fontSize: 14,
              fontWeight: 'bold',
              color: currentStyles.textColor || 'var(--text)',
              lineHeight: 1,
            }}>A</span>
            <div style={{
              width: 14,
              height: 4,
              marginTop: 1,
              backgroundColor: currentStyles.textColor || 'var(--text)',
              borderRadius: 2,
            }} />
          </div>
        </button>

        {showTextColorPicker && (
          <div
            className="ds-ct-popover ds-ct-color-popover"
            onWheel={(e) => e.stopPropagation()}
          >
            {/* Preset Tabs */}
            <div className="ds-ct-preset-tabs">
              {COLOR_PRESET_ORDER.map((presetId) => (
                <button
                  key={presetId}
                  className={`ds-ct-preset-tab ${selectedTextColorPreset === presetId ? 'active' : ''}`}
                  onClick={() => setSelectedTextColorPreset(presetId)}
                >
                  {COLOR_PRESETS[presetId].name}
                </button>
              ))}
            </div>

            {/* Auto option */}
            <button
              className={`ds-ct-textcolor-auto ${!currentStyles.textColor ? 'active' : ''}`}
              onClick={() => {
                handleStyleChange('textColor', null);
                setShowTextColorPicker(false);
              }}
            >
              <span style={{ fontSize: 11 }}>Auto</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>Based on background</span>
            </button>

            {/* Color Grid */}
            <div className="ds-ct-color-grid">
              {currentTextColorPresetColors.map((color) => (
                <button
                  key={color.id}
                  className={`ds-ct-color-option ${currentStyles.textColor === color.hex ? 'active' : ''}`}
                  style={{ backgroundColor: color.hex }}
                  onClick={() => {
                    handleStyleChange('textColor', color.hex);
                    setShowTextColorPicker(false);
                  }}
                  title={color.name}
                />
              ))}
            </div>

            {/* Custom Color */}
            <div className="ds-ct-color-custom">
              <input
                type="color"
                value={currentStyles.textColor || '#1f2937'}
                onChange={(e) => handleStyleChange('textColor', e.target.value)}
                title="Custom color"
              />
              <span>Custom</span>
            </div>
          </div>
        )}
      </div>

      {/* Text Formatting */}
      <div className="ds-ct-group">
        <button
          className={`ds-ct-btn ${isBold ? 'active' : ''}`}
          onClick={toggleBold}
          title="Bold (Cmd+B)"
        >
          <strong style={{ fontSize: 13 }}>B</strong>
        </button>
        <button
          className={`ds-ct-btn ${isItalic ? 'active' : ''}`}
          onClick={toggleItalic}
          title="Italic (Cmd+I)"
        >
          <em style={{ fontSize: 13 }}>I</em>
        </button>
        <button
          className={`ds-ct-btn ${isUnderline ? 'active' : ''}`}
          onClick={toggleUnderline}
          title="Underline (Cmd+U)"
        >
          <span style={{ fontSize: 13, textDecoration: 'underline' }}>U</span>
        </button>
      </div>

      {/* Text Alignment - Combined Dropdown */}
      <div className="ds-ct-group" style={{ position: 'relative' }}>
        <button
          className="ds-ct-btn"
          onClick={() => {
            setShowAlignPicker(!showAlignPicker);
            setShowColorPicker(false);
            setShowStylePicker(false);
            setShowSizePicker(false);
            setShowBorderPicker(false);
            setShowOpacityPicker(false);
          }}
          title="Text alignment"
        >
          {/* Dynamic icon showing current alignment */}
          <svg width="16" height="16" viewBox="0 0 16 16">
            {/* Box outline */}
            <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />
            {/* Horizontal position indicator */}
            {currentStyles.textAlign === 'left' && (
              <>
                <rect x="3" y={(currentStyles.verticalAlign === 'top' || currentStyles.verticalAlign === 'flex-start') ? 3 : (currentStyles.verticalAlign === 'bottom' || currentStyles.verticalAlign === 'flex-end') ? 10 : 6.5} width="8" height="1.5" rx="0.5" fill="currentColor" />
                <rect x="3" y={(currentStyles.verticalAlign === 'top' || currentStyles.verticalAlign === 'flex-start') ? 5.5 : (currentStyles.verticalAlign === 'bottom' || currentStyles.verticalAlign === 'flex-end') ? 12.5 : 9} width="5" height="1.5" rx="0.5" fill="currentColor" opacity="0.5" />
              </>
            )}
            {currentStyles.textAlign === 'center' && (
              <>
                <rect x="4" y={(currentStyles.verticalAlign === 'top' || currentStyles.verticalAlign === 'flex-start') ? 3 : (currentStyles.verticalAlign === 'bottom' || currentStyles.verticalAlign === 'flex-end') ? 10 : 6.5} width="8" height="1.5" rx="0.5" fill="currentColor" />
                <rect x="5.5" y={(currentStyles.verticalAlign === 'top' || currentStyles.verticalAlign === 'flex-start') ? 5.5 : (currentStyles.verticalAlign === 'bottom' || currentStyles.verticalAlign === 'flex-end') ? 12.5 : 9} width="5" height="1.5" rx="0.5" fill="currentColor" opacity="0.5" />
              </>
            )}
            {currentStyles.textAlign === 'right' && (
              <>
                <rect x="5" y={(currentStyles.verticalAlign === 'top' || currentStyles.verticalAlign === 'flex-start') ? 3 : (currentStyles.verticalAlign === 'bottom' || currentStyles.verticalAlign === 'flex-end') ? 10 : 6.5} width="8" height="1.5" rx="0.5" fill="currentColor" />
                <rect x="8" y={(currentStyles.verticalAlign === 'top' || currentStyles.verticalAlign === 'flex-start') ? 5.5 : (currentStyles.verticalAlign === 'bottom' || currentStyles.verticalAlign === 'flex-end') ? 12.5 : 9} width="5" height="1.5" rx="0.5" fill="currentColor" opacity="0.5" />
              </>
            )}
          </svg>
        </button>

        {showAlignPicker && (
          <div className="ds-ct-popover ds-ct-align-popover" onWheel={(e) => e.stopPropagation()}>
            <div className="ds-ct-align-grid">
              {/* Row 1: Top */}
              <button
                className={`ds-ct-align-option ${currentStyles.textAlign === 'left' && (currentStyles.verticalAlign === 'top' || currentStyles.verticalAlign === 'flex-start') ? 'active' : ''}`}
                onClick={() => { handleStyleChange('textAlign', 'left'); handleStyleChange('verticalAlign', 'top'); }}
                title="Top Left"
              >
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" />
                  <rect x="4" y="4" width="10" height="2" rx="0.5" fill="currentColor" />
                  <rect x="4" y="7.5" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
                </svg>
              </button>
              <button
                className={`ds-ct-align-option ${currentStyles.textAlign === 'center' && (currentStyles.verticalAlign === 'top' || currentStyles.verticalAlign === 'flex-start') ? 'active' : ''}`}
                onClick={() => { handleStyleChange('textAlign', 'center'); handleStyleChange('verticalAlign', 'top'); }}
                title="Top Center"
              >
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" />
                  <rect x="5" y="4" width="10" height="2" rx="0.5" fill="currentColor" />
                  <rect x="7" y="7.5" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
                </svg>
              </button>
              <button
                className={`ds-ct-align-option ${currentStyles.textAlign === 'right' && (currentStyles.verticalAlign === 'top' || currentStyles.verticalAlign === 'flex-start') ? 'active' : ''}`}
                onClick={() => { handleStyleChange('textAlign', 'right'); handleStyleChange('verticalAlign', 'top'); }}
                title="Top Right"
              >
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" />
                  <rect x="6" y="4" width="10" height="2" rx="0.5" fill="currentColor" />
                  <rect x="10" y="7.5" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
                </svg>
              </button>

              {/* Row 2: Middle */}
              <button
                className={`ds-ct-align-option ${currentStyles.textAlign === 'left' && (currentStyles.verticalAlign === 'center' || currentStyles.verticalAlign === 'middle' || !currentStyles.verticalAlign) ? 'active' : ''}`}
                onClick={() => { handleStyleChange('textAlign', 'left'); handleStyleChange('verticalAlign', 'center'); }}
                title="Middle Left"
              >
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" />
                  <rect x="4" y="8" width="10" height="2" rx="0.5" fill="currentColor" />
                  <rect x="4" y="11.5" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
                </svg>
              </button>
              <button
                className={`ds-ct-align-option ${currentStyles.textAlign === 'center' && (currentStyles.verticalAlign === 'center' || currentStyles.verticalAlign === 'middle' || !currentStyles.verticalAlign) ? 'active' : ''}`}
                onClick={() => { handleStyleChange('textAlign', 'center'); handleStyleChange('verticalAlign', 'center'); }}
                title="Middle Center"
              >
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" />
                  <rect x="5" y="8" width="10" height="2" rx="0.5" fill="currentColor" />
                  <rect x="7" y="11.5" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
                </svg>
              </button>
              <button
                className={`ds-ct-align-option ${currentStyles.textAlign === 'right' && (currentStyles.verticalAlign === 'center' || currentStyles.verticalAlign === 'middle' || !currentStyles.verticalAlign) ? 'active' : ''}`}
                onClick={() => { handleStyleChange('textAlign', 'right'); handleStyleChange('verticalAlign', 'center'); }}
                title="Middle Right"
              >
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" />
                  <rect x="6" y="8" width="10" height="2" rx="0.5" fill="currentColor" />
                  <rect x="10" y="11.5" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
                </svg>
              </button>

              {/* Row 3: Bottom */}
              <button
                className={`ds-ct-align-option ${currentStyles.textAlign === 'left' && (currentStyles.verticalAlign === 'bottom' || currentStyles.verticalAlign === 'flex-end') ? 'active' : ''}`}
                onClick={() => { handleStyleChange('textAlign', 'left'); handleStyleChange('verticalAlign', 'bottom'); }}
                title="Bottom Left"
              >
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" />
                  <rect x="4" y="10.5" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
                  <rect x="4" y="14" width="10" height="2" rx="0.5" fill="currentColor" />
                </svg>
              </button>
              <button
                className={`ds-ct-align-option ${currentStyles.textAlign === 'center' && (currentStyles.verticalAlign === 'bottom' || currentStyles.verticalAlign === 'flex-end') ? 'active' : ''}`}
                onClick={() => { handleStyleChange('textAlign', 'center'); handleStyleChange('verticalAlign', 'bottom'); }}
                title="Bottom Center"
              >
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" />
                  <rect x="7" y="10.5" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
                  <rect x="5" y="14" width="10" height="2" rx="0.5" fill="currentColor" />
                </svg>
              </button>
              <button
                className={`ds-ct-align-option ${currentStyles.textAlign === 'right' && (currentStyles.verticalAlign === 'bottom' || currentStyles.verticalAlign === 'flex-end') ? 'active' : ''}`}
                onClick={() => { handleStyleChange('textAlign', 'right'); handleStyleChange('verticalAlign', 'bottom'); }}
                title="Bottom Right"
              >
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" />
                  <rect x="10" y="10.5" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
                  <rect x="6" y="14" width="10" height="2" rx="0.5" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Font Family Picker */}
      <div className="ds-ct-group" style={{ position: 'relative' }}>
        <button
          className="ds-ct-btn ds-ct-font-btn"
          onClick={() => {
            closeAllPopovers();
            setShowFontPicker(!showFontPicker);
          }}
          title="Font Family"
          style={{ fontFamily: currentFontDef?.value || 'inherit', fontSize: 11, minWidth: 60 }}
        >
          {currentFontDef?.name?.substring(0, 8) || 'Font'}
          <svg width="8" height="8" viewBox="0 0 8 8" style={{ marginLeft: 2 }}>
            <path d="M1 3L4 6L7 3" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>

        {showFontPicker && (
          <div
            className="ds-ct-popover ds-ct-font-popover"
            onWheel={(e) => e.stopPropagation()}
          >
            {FONT_CATEGORIES.map((category) => (
              <div key={category} className="ds-ct-font-category">
                <span className="ds-ct-font-category-label">{category}</span>
                <div className="ds-ct-font-list">
                  {FONT_FAMILIES.filter(f => f.category === category).map((font) => {
                    // Load font on hover for preview
                    return (
                      <button
                        key={font.id}
                        className={`ds-ct-font-option ${currentFontDef?.id === font.id ? 'active' : ''}`}
                        onClick={() => handleFontFamilyChange(font)}
                        onMouseEnter={() => loadGoogleFont(font)}
                        style={{ fontFamily: font.value }}
                      >
                        {font.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Font Size with Arrows */}
      <div className="ds-ct-group ds-ct-fontsize-group">
        <button
          className="ds-ct-btn ds-ct-size-btn"
          onClick={decrementFontSize}
          title="Decrease font size"
        >
          <KeyboardArrowDownIcon fontSize="small" style={{ fontSize: 16 }} />
        </button>
        <span className="ds-ct-size-display" title="Font size">
          {currentStyles.fontSize}
        </span>
        <button
          className="ds-ct-btn ds-ct-size-btn"
          onClick={incrementFontSize}
          title="Increase font size"
        >
          <KeyboardArrowUpIcon fontSize="small" style={{ fontSize: 16 }} />
        </button>
      </div>

      <div className="ds-ct-divider" />

      {/* Make Same Size (multi-select) */}
      {multipleSelected && (
        <div className="ds-ct-group" style={{ position: 'relative' }}>
          <button
            className="ds-ct-btn"
            onClick={() => {
              closeAllPopovers();
              setShowSameSizeMenu(!showSameSizeMenu);
            }}
            title="Make Same Size"
          >
            <PhotoSizeSelectSmallIcon fontSize="small" style={{ fontSize: 16 }} />
          </button>

          {showSameSizeMenu && (
            <div
              className="ds-ct-popover ds-ct-samesize-popover"
              onWheel={(e) => e.stopPropagation()}
            >
              <button className="ds-ct-samesize-option" onClick={handleMakeSameWidth}>
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect x="2" y="6" width="16" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="2" y1="3" x2="2" y2="17" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="18" y1="3" x2="18" y2="17" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <span>Same Width</span>
              </button>
              <button className="ds-ct-samesize-option" onClick={handleMakeSameHeight}>
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect x="6" y="2" width="8" height="16" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="3" y1="2" x2="17" y2="2" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="3" y1="18" x2="17" y2="18" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <span>Same Height</span>
              </button>
              <button className="ds-ct-samesize-option" onClick={handleMakeSameSize}>
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect x="4" y="4" width="12" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="4" y1="1" x2="4" y2="19" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                  <line x1="16" y1="1" x2="16" y2="19" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                  <line x1="1" y1="4" x2="19" y2="4" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                  <line x1="1" y1="16" x2="19" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                </svg>
                <span>Same Size</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="ds-ct-divider" />

      {/* Transform Actions - Rotate & Flip */}
      <div className="ds-ct-group">
        <button
          className="ds-ct-btn"
          onClick={handleRotate90CCW}
          title="Rotate 90° Left ( [ )"
        >
          <RotateLeftIcon fontSize="small" />
        </button>
        <button
          className="ds-ct-btn"
          onClick={handleRotate90CW}
          title="Rotate 90° Right ( ] )"
        >
          <RotateRightIcon fontSize="small" />
        </button>
        <button
          className="ds-ct-btn"
          onClick={handleFlipHorizontal}
          title="Flip Horizontal (Shift+H)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v18" />
            <path d="M16 7l4 5-4 5" />
            <path d="M8 7l-4 5 4 5" />
          </svg>
        </button>
        <button
          className="ds-ct-btn"
          onClick={handleFlipVertical}
          title="Flip Vertical (Shift+V)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h18" />
            <path d="M7 8l5-4 5 4" />
            <path d="M7 16l5 4 5-4" />
          </svg>
        </button>
        {hasTransforms && (
          <button
            className="ds-ct-btn ds-ct-btn-reset"
            onClick={handleResetTransform}
            title="Reset Transform (rotation, flip)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        )}
      </div>

      <div className="ds-ct-divider" />

      {/* Primary Actions */}
      <div className="ds-ct-group">
        <button
          className="ds-ct-btn"
          onClick={() => duplicateSelected?.()}
          title="Duplicate (Ctrl+D)"
        >
          <ContentCopyIcon fontSize="small" />
        </button>
        <button
          className="ds-ct-btn danger"
          onClick={() => deleteSelected?.()}
          title="Delete (Del)"
        >
          <DeleteOutlineIcon fontSize="small" />
        </button>
      </div>

      {/* Frame-specific Actions */}
      {isFrameSelected && (
        <>
          <div className="ds-ct-divider" />
          <div className="ds-ct-group">
            <button
              className="ds-ct-btn"
              onClick={handleExportFrameSvg}
              title="Export frame as SVG"
            >
              <CropFreeIcon fontSize="small" />
            </button>
            <button
              className="ds-ct-btn"
              onClick={handleExportFramePng}
              title="Export frame as PNG"
            >
              <ImageIcon fontSize="small" />
            </button>
            <button
              className="ds-ct-btn"
              onClick={handleDuplicateFrame}
              title="Duplicate frame with contents"
            >
              <ContentCopyIcon fontSize="small" style={{ color: 'var(--accent)' }} />
            </button>
          </div>
        </>
      )}

      <div className="ds-ct-divider" />

      {/* Overflow Menu - Contains secondary actions */}
      <div className="ds-ct-group" style={{ position: 'relative' }}>
        <button
          className={`ds-ct-btn ${showOverflowMenu ? 'active' : ''}`}
          onClick={() => {
            setShowOverflowMenu(!showOverflowMenu);
            setShowColorPicker(false);
            setShowStylePicker(false);
            setShowSizePicker(false);
          }}
          title="More options"
        >
          <MoreHorizIcon fontSize="small" />
        </button>

        {showOverflowMenu && (
          <div className="ds-ct-overflow-menu" onWheel={(e) => e.stopPropagation()}>
            {/* Reset to Default */}
            {supportsStyleVariants && (
              <button
                className="ds-ct-overflow-item"
                onClick={() => { handleResetToDefault(); setShowOverflowMenu(false); }}
                title="Reset styles to your saved default or system default"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10C4 6.68629 6.68629 4 10 4C12.0503 4 13.8682 5.00476 14.9497 6.55025" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M16 10C16 13.3137 13.3137 16 10 16C7.94975 16 6.13183 14.9952 5.05025 13.4497" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M14 3.5V7H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6 16.5V13H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Reset to Default</span>
              </button>
            )}

            {/* Lock/Unlock */}
            <button
              className="ds-ct-overflow-item"
              onClick={() => { handleToggleLock(); setShowOverflowMenu(false); }}
            >
              {hasLockedElements ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
              <span>{hasLockedElements ? 'Unlock' : 'Lock'}</span>
            </button>

            <div className="ds-ct-overflow-divider" />

            {/* Z-order */}
            <button
              className="ds-ct-overflow-item"
              onClick={() => { handleBringToFront(); setShowOverflowMenu(false); }}
            >
              <FlipToFrontIcon fontSize="small" />
              <span>Bring to front</span>
            </button>
            <button
              className="ds-ct-overflow-item"
              onClick={() => { handleSendToBack(); setShowOverflowMenu(false); }}
            >
              <FlipToBackIcon fontSize="small" />
              <span>Send to back</span>
            </button>

            {/* Alignment (only show for multiple selection) */}
            {multipleSelected && (
              <>
                <div className="ds-ct-overflow-divider" />
                <div className="ds-ct-overflow-section">
                  <span className="ds-ct-overflow-label">Align</span>
                  <div className="ds-ct-overflow-grid">
                    <button
                      className="ds-ct-btn"
                      onClick={() => { alignElements('left'); setShowOverflowMenu(false); }}
                      title="Align Left"
                    >
                      <FormatAlignLeftIcon fontSize="small" />
                    </button>
                    <button
                      className="ds-ct-btn"
                      onClick={() => { alignElements('center-h'); setShowOverflowMenu(false); }}
                      title="Align Center"
                    >
                      <FormatAlignCenterIcon fontSize="small" />
                    </button>
                    <button
                      className="ds-ct-btn"
                      onClick={() => { alignElements('right'); setShowOverflowMenu(false); }}
                      title="Align Right"
                    >
                      <FormatAlignRightIcon fontSize="small" />
                    </button>
                    <button
                      className="ds-ct-btn"
                      onClick={() => { alignElements('top'); setShowOverflowMenu(false); }}
                      title="Align Top"
                    >
                      <VerticalAlignTopIcon fontSize="small" />
                    </button>
                    <button
                      className="ds-ct-btn"
                      onClick={() => { alignElements('center-v'); setShowOverflowMenu(false); }}
                      title="Align Middle"
                    >
                      <VerticalAlignCenterIcon fontSize="small" />
                    </button>
                    <button
                      className="ds-ct-btn"
                      onClick={() => { alignElements('bottom'); setShowOverflowMenu(false); }}
                      title="Align Bottom"
                    >
                      <VerticalAlignBottomIcon fontSize="small" />
                    </button>
                  </div>
                </div>

                {/* Distribution (only for 3+ elements) */}
                {selectedElements.length >= 3 && (
                  <div className="ds-ct-overflow-section">
                    <span className="ds-ct-overflow-label">Distribute</span>
                    <div className="ds-ct-overflow-grid">
                      <button
                        className="ds-ct-btn"
                        onClick={() => { distributeElements('horizontal'); setShowOverflowMenu(false); }}
                        title="Distribute Horizontally"
                      >
                        <ViewColumnIcon fontSize="small" />
                      </button>
                      <button
                        className="ds-ct-btn"
                        onClick={() => { distributeElements('vertical'); setShowOverflowMenu(false); }}
                        title="Distribute Vertically"
                      >
                        <TableRowsIcon fontSize="small" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Close button */}
      {onClose && (
        <div className="ds-ct-divider" />
      )}
      {onClose && (
        <button
          className="ds-ct-btn ds-ct-close"
          onClick={onClose}
          title="Hide toolbar (toggle in right-click menu)"
        >
          <CloseIcon fontSize="small" style={{ fontSize: 14 }} />
        </button>
      )}

      <style jsx>{`
        .ds-contextual-toolbar {
          position: fixed;
          transform: translate(-50%, -100%);
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 4px 6px;
          background: white;
          border-radius: 8px;
          box-shadow: var(--ds-shadow-toolbar, 0 2px 12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04));
          z-index: 150;
          pointer-events: auto;
        }

        .ds-ct-group {
          display: flex;
          gap: 2px;
        }

        .ds-ct-btn {
          width: 28px;
          height: 28px;
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

        .ds-ct-btn:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
          color: var(--text, #1f2937);
        }

        .ds-ct-btn.danger:hover {
          background: rgba(220, 38, 38, 0.1);
          color: #dc2626;
        }

        .ds-ct-btn.ds-ct-close {
          width: 22px;
          height: 22px;
          opacity: 0.5;
        }

        .ds-ct-btn.ds-ct-close:hover {
          opacity: 1;
          background: rgba(0, 0, 0, 0.06);
        }

        .ds-ct-btn.active {
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.1));
          color: var(--ds-active-color, #0e74a3);
        }

        .ds-ct-divider {
          width: 1px;
          height: 20px;
          background: rgba(0, 0, 0, 0.08);
          margin: 0 2px;
        }

        /* Popovers */
        .ds-ct-popover {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 8px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 10px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
          padding: 8px;
          z-index: 200;
          animation: ds-popover-in 0.15s ease-out;
        }

        @keyframes ds-popover-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        /* Color Grid */
        .ds-ct-color-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
          margin-bottom: 8px;
        }

        .ds-ct-color-option {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-ct-color-option:hover {
          transform: scale(1.1);
        }

        .ds-ct-color-option.active {
          border-color: var(--text);
          box-shadow: 0 0 0 2px var(--panel);
        }

        .ds-ct-color-custom {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--border);
        }

        .ds-ct-color-custom input[type="color"] {
          width: 24px;
          height: 24px;
          padding: 0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .ds-ct-color-custom span {
          font-size: 11px;
          color: var(--text-muted);
        }

        /* Style Picker */
        .ds-ct-style-popover {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 120px;
        }

        .ds-ct-style-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          background: transparent;
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 12px;
          color: var(--text);
        }

        .ds-ct-style-option:hover {
          background: var(--bg-alt);
        }

        .ds-ct-style-option.active {
          background: var(--accent-soft);
        }

        /* Size Picker */
        .ds-ct-size-popover {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 80px;
        }

        .ds-ct-size-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          border: none;
          border-radius: 4px;
          background: transparent;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-ct-size-option:hover {
          background: var(--bg-alt);
        }

        .ds-ct-size-option.active {
          background: var(--accent-soft);
        }

        .ds-ct-size-value {
          font-size: 10px;
          color: var(--text-muted);
        }

        /* Overflow Menu */
        .ds-ct-overflow-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 8px;
          min-width: 180px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 10px;
          box-shadow: var(--ds-shadow-flyout, 0 8px 30px rgba(0, 0, 0, 0.15));
          padding: 6px;
          z-index: 200;
          animation: ds-popover-in 0.15s ease-out;
        }

        .ds-ct-overflow-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text);
          cursor: pointer;
          font-size: 13px;
          transition: all 0.15s ease;
        }

        .ds-ct-overflow-item:hover {
          background: var(--accent-soft);
          color: var(--accent);
        }

        .ds-ct-overflow-divider {
          height: 1px;
          background: var(--border);
          margin: 6px 0;
        }

        .ds-ct-overflow-section {
          padding: 6px;
        }

        .ds-ct-overflow-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
          margin-bottom: 6px;
          padding-left: 4px;
        }

        .ds-ct-overflow-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
        }

        .ds-ct-overflow-grid .ds-ct-btn {
          width: 32px;
          height: 32px;
        }

        /* Border Picker */
        .ds-ct-border-popover {
          min-width: 200px;
          padding: 10px;
        }

        .ds-ct-border-section {
          margin-bottom: 12px;
        }

        .ds-ct-border-section:last-child {
          margin-bottom: 0;
        }

        .ds-ct-border-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
          margin-bottom: 6px;
        }

        /* Corner Options */
        .ds-ct-corner-options {
          display: flex;
          gap: 4px;
        }

        .ds-ct-corner-option {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: var(--bg-alt, #f3f4f6);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-ct-corner-option:hover {
          background: var(--accent-soft);
          color: var(--text);
        }

        .ds-ct-corner-option.active {
          background: var(--accent);
          color: white;
        }

        /* Border Style Options */
        .ds-ct-border-style-options {
          display: flex;
          gap: 4px;
        }

        .ds-ct-border-style-option {
          flex: 1;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: var(--bg-alt, #f3f4f6);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-ct-border-style-option:hover {
          background: var(--accent-soft);
          color: var(--text);
        }

        .ds-ct-border-style-option.active {
          background: var(--accent);
          color: white;
        }

        /* Thickness Options */
        .ds-ct-thickness-options {
          display: flex;
          gap: 4px;
        }

        .ds-ct-thickness-option {
          flex: 1;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: var(--bg-alt, #f3f4f6);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-ct-thickness-option:hover {
          background: var(--accent-soft);
          color: var(--text);
        }

        .ds-ct-thickness-option.active {
          background: var(--accent);
          color: white;
        }

        /* Border Color */
        .ds-ct-border-color-row {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .ds-ct-border-color-option {
          height: 24px;
          padding: 0 8px;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: var(--bg-alt, #f3f4f6);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-ct-border-color-option:hover {
          border-color: var(--accent);
        }

        .ds-ct-border-color-option.active {
          border-color: var(--accent);
          background: var(--accent-soft);
          color: var(--accent);
        }

        .ds-ct-border-color-swatch {
          width: 20px;
          height: 20px;
          border: 2px solid transparent;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-ct-border-color-swatch:hover {
          transform: scale(1.1);
        }

        .ds-ct-border-color-swatch.active {
          border-color: var(--text);
          box-shadow: 0 0 0 2px var(--panel);
        }

        .ds-ct-border-color-custom {
          margin-left: 4px;
        }

        .ds-ct-border-color-custom input[type="color"] {
          width: 20px;
          height: 20px;
          padding: 0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        /* Shadow Toggle */
        .ds-ct-shadow-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: transparent;
          color: var(--text);
          cursor: pointer;
          font-size: 12px;
          transition: all 0.15s ease;
        }

        .ds-ct-shadow-toggle:hover {
          background: var(--bg-alt);
        }

        .ds-ct-shadow-toggle.active {
          border-color: var(--accent);
          background: var(--accent-soft);
        }

        .ds-ct-shadow-toggle span:first-of-type {
          flex: 1;
          text-align: left;
        }

        .ds-ct-toggle-indicator {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          background: var(--bg-alt, #f3f4f6);
          color: var(--text-muted);
        }

        .ds-ct-shadow-toggle.active .ds-ct-toggle-indicator {
          background: var(--accent);
          color: white;
        }

        /* Save as Default Button */
        .ds-ct-save-section {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--border);
        }

        .ds-ct-save-default-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          background: var(--accent);
          color: white;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.15s ease;
        }

        .ds-ct-save-default-btn:hover {
          background: var(--accent-hover, #0a5a80);
          transform: translateY(-1px);
        }

        .ds-ct-save-default-btn:active {
          transform: translateY(0);
        }

        /* Opacity Picker */
        .ds-ct-opacity-popover {
          min-width: 160px;
          padding: 12px;
        }

        .ds-ct-opacity-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          margin-bottom: 10px;
        }

        .ds-ct-opacity-slider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .ds-ct-opacity-slider input[type="range"] {
          flex: 1;
          height: 4px;
          -webkit-appearance: none;
          appearance: none;
          background: var(--border);
          border-radius: 2px;
          outline: none;
        }

        .ds-ct-opacity-slider input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          background: var(--accent);
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .ds-ct-opacity-value {
          font-size: 11px;
          font-weight: 600;
          color: var(--text);
          min-width: 36px;
          text-align: right;
        }

        .ds-ct-opacity-presets {
          display: flex;
          gap: 4px;
        }

        .ds-ct-opacity-preset {
          flex: 1;
          padding: 4px 0;
          border: none;
          border-radius: 4px;
          background: var(--bg-alt);
          color: var(--text-muted);
          font-size: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-ct-opacity-preset:hover {
          background: var(--accent-soft);
          color: var(--accent);
        }

        .ds-ct-opacity-preset.active {
          background: var(--accent);
          color: white;
        }

        /* Alignment Picker */
        .ds-ct-align-popover {
          padding: 6px;
        }

        .ds-ct-align-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
        }

        .ds-ct-align-option {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-ct-align-option:hover {
          background: var(--bg-alt);
          color: var(--text);
        }

        .ds-ct-align-option.active {
          background: var(--accent-soft);
          color: var(--accent);
        }

        /* Color Picker with Presets */
        .ds-ct-color-popover {
          min-width: 220px;
          padding: 8px;
        }

        .ds-ct-preset-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
        }

        .ds-ct-preset-tab {
          padding: 4px 8px;
          border: none;
          border-radius: 4px;
          background: transparent;
          color: var(--text-muted);
          font-size: 10px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-ct-preset-tab:hover {
          background: var(--bg-alt);
          color: var(--text);
        }

        .ds-ct-preset-tab.active {
          background: var(--accent);
          color: white;
        }

        .ds-ct-color-opacity {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--border);
        }

        /* Font Size Arrows */
        .ds-ct-fontsize-group {
          display: flex;
          align-items: center;
          gap: 0;
        }

        .ds-ct-size-display {
          min-width: 24px;
          text-align: center;
          font-size: 11px;
          font-weight: 500;
          color: var(--text);
          user-select: none;
        }

        .ds-ct-size-btn {
          width: 22px !important;
          height: 22px !important;
        }

        /* Font Family Picker */
        .ds-ct-font-btn {
          width: auto !important;
          padding: 0 8px !important;
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .ds-ct-font-popover {
          min-width: 200px;
          max-height: 400px;
          overflow-y: auto;
          padding: 8px;
        }

        .ds-ct-font-category {
          margin-bottom: 8px;
        }

        .ds-ct-font-category-label {
          display: block;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
          padding: 4px 8px;
          background: var(--bg-alt);
          border-radius: 4px;
          margin-bottom: 4px;
        }

        .ds-ct-font-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .ds-ct-font-option {
          padding: 6px 8px;
          border: none;
          border-radius: 4px;
          background: transparent;
          color: var(--text);
          font-size: 13px;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-ct-font-option:hover {
          background: var(--bg-alt);
        }

        .ds-ct-font-option.active {
          background: var(--accent-soft);
          color: var(--accent);
        }

        /* Make Same Size Menu */
        .ds-ct-samesize-popover {
          min-width: 140px;
          padding: 6px;
        }

        .ds-ct-samesize-option {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-ct-samesize-option:hover {
          background: var(--accent-soft);
          color: var(--accent);
        }

        /* Text Color Auto Button */
        .ds-ct-textcolor-auto {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 10px;
          margin-bottom: 8px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: transparent;
          color: var(--text);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-ct-textcolor-auto:hover {
          background: var(--bg-alt);
        }

        .ds-ct-textcolor-auto.active {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
      `}</style>
    </div>
  );
}
