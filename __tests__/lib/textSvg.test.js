/**
 * @jest-environment node
 */
// ADR-0008 T3: textLayoutToSvg draws the lines of a layout (pinned tspans, badge, escaping, fallback-font pinning).
import { layoutText } from '../../lib/text/layout';
import { textLayoutToSvg, escapeXml, FONT_STACK } from '../../lib/text/svg';

const lay = (text, extra = {}) => layoutText({ text, font: { size: 14, weight: 500, lineHeight: 1.3 }, box: { width: 100, height: 60 }, mode: 'fixed', align: 'center', valign: 'middle', ...extra });

describe('textLayoutToSvg', () => {
  test('one <text>, one <tspan x y> per layout line, at the layout positions', () => {
    const l = lay('Customer Order Service');
    const svg = textLayoutToSvg(l, { x: 10, y: 20 });
    const spans = [...svg.matchAll(/<tspan x="([\d.]+)" y="([\d.]+)"/g)];
    expect(spans).toHaveLength(l.lines.length);
    l.lines.forEach((ln, i) => {
      expect(Number(spans[i][1])).toBeCloseTo(10 + ln.x, 1);
      expect(Number(spans[i][2])).toBeCloseTo(20 + ln.y, 1);
    });
    expect(svg).toContain(`font-size="${l.fontSize}"`);
    expect(svg).toContain('font-weight="500"');
  });

  test('lines of Inter glyphs are pinned to their measured width; CJK, Arabic and emoji lines are not', () => {
    expect(textLayoutToSvg(lay('Billing'), { x: 0, y: 0 })).toMatch(/textLength="[\d.]+" lengthAdjust="spacing"/);
    expect(textLayoutToSvg(lay('顧客満足度分析'), { x: 0, y: 0 })).not.toContain('textLength');
    expect(textLayoutToSvg(lay('🚀 Launch'), { x: 0, y: 0 })).not.toContain('textLength');
    const ar = textLayoutToSvg(lay('تحليل رضا العملاء'), { x: 0, y: 0 });
    expect(ar).toContain('direction="rtl"');
    expect(ar).not.toContain('textLength');
    expect(textLayoutToSvg(lay('Billing'), { x: 0, y: 0 }, { pin: false })).not.toContain('textLength');
  });

  test('a clamped layout carries the full text as <title> and a badge at the bottom-right of the box', () => {
    const l = lay('word '.repeat(80), { box: { width: 100, height: 40 }, limits: { maxLines: 2 } });
    expect(l.overflow).toBeTruthy();
    const svg = textLayoutToSvg(l, { x: 0, y: 0 }, { box: { x: 0, y: 0, width: 100, height: 40 } });
    expect(svg).toContain(`<title>${escapeXml(l.text)}</title>`);
    expect(svg).toContain('data-text-badge="true"');
    expect(textLayoutToSvg(lay('short'), { x: 0, y: 0 }, { box: { x: 0, y: 0, width: 100, height: 40 } })).not.toContain('data-text-badge');
  });

  test('escapes text and attributes; empty layouts draw nothing; the font stack starts with Inter', () => {
    const svg = textLayoutToSvg(lay('<b>"&"</b>'), { x: 0, y: 0 }, { fill: '#123456', family: 'Georgia' });
    expect(svg).toContain('&lt;b&gt;&quot;&amp;&quot;&lt;/b&gt;');
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('font-family="Georgia, Inter');
    expect(textLayoutToSvg(lay(''), { x: 0, y: 0 })).toBe('');
    expect(FONT_STACK.startsWith('Inter,')).toBe(true);
  });
});
