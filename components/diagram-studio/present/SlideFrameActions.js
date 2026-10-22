// components/diagram-studio/present/SlideFrameActions.js
// Frame toolbar additions (ADR-0007 P1): the slide shape (16:9 / 4:3 / 1:1 / free) and "Add to presentation".
// Rendered inside the ContextualToolbar's frame group. Hidden for read-only roles.

import { useState } from 'react';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import { useDiagram } from '../DiagramContext';
import { canWrite as accessCanWrite } from '../sharing/accessMode';
import { FRAME_ASPECTS } from '../../../lib/present/presentationSchema';
import { frameAspectOf } from '../../../lib/present/presentationModel';
import { addFramesToDeck, setFrameShape } from './deckActions';
import { getPresentState, setPresentState } from './presentStore';

const LABEL = { '16:9': '16:9 slide', '4:3': '4:3 slide', '1:1': '1:1 slide', free: 'Free shape' };

export default function SlideFrameActions({ frame }) {
  const { diagram, presentations, patchPresentation, updateElement } = useDiagram();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(null);
  if (!frame || !accessCanWrite(diagram?.access)) return null;
  const aspect = frameAspectOf(frame) || 'free';
  const inDecks = (presentations || []).filter((p) => (p.slides || []).some((s) => s.frameId === frame.id)).length;

  const add = () => {
    const r = addFramesToDeck({ patchPresentation, presentations, activeId: getPresentState().activeId, frameIds: [frame.id] });
    if (r.ok) { setPresentState({ panelOpen: true, activeId: r.presentationId }); setNote(null); } else setNote(r.errors?.[0] || 'Could not add the slide.');
  };

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button type="button" className="ds-ct-btn" data-testid="frame-slide-shape" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} title={`Slide shape: ${LABEL[aspect]}`}>
          <AspectRatioIcon fontSize="small" />
        </button>
        {open && (
          <div role="menu" aria-label="Slide shape" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 20, background: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.14)', padding: 4, display: 'flex', flexDirection: 'column', minWidth: 130 }}>
            {FRAME_ASPECTS.map((a) => (
              <button
                key={a}
                type="button"
                role="menuitemradio"
                aria-checked={a === aspect}
                data-testid={`frame-shape-${a.replace(':', 'x')}`}
                onClick={() => { setFrameShape(frame, a, updateElement); setOpen(false); }}
                style={{ textAlign: 'left', padding: '6px 10px', border: 0, background: a === aspect ? 'var(--bg-alt, #f3f4f6)' : 'transparent', borderRadius: 6, cursor: 'pointer', font: 'inherit', fontWeight: a === aspect ? 600 : 400, color: 'inherit' }}
              >{LABEL[a]}</button>
            ))}
          </div>
        )}
      </div>
      <button type="button" className="ds-ct-btn" data-testid="frame-add-to-presentation" onClick={add} title={inDecks ? `Add to presentation (already in ${inDecks})` : 'Add to presentation'}>
        <SlideshowIcon fontSize="small" style={{ color: 'var(--accent)' }} />
      </button>
      {note && <span role="alert" style={{ fontSize: 11, color: '#b91c1c', maxWidth: 160 }}>{note}</span>}
    </>
  );
}
