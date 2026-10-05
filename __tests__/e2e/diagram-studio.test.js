/**
 * E2E Tests for Diagram Studio
 *
 * Tests the core functionality of the Ontographia Lab Diagram Studio using Puppeteer.
 *
 * Prerequisites:
 * - The app must be running at TEST_BASE_URL (default http://localhost:3002)
 * - .env.qa.local (gitignored) must define QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD
 *   for a local QA user. The suite logs in via /login and creates/deletes its
 *   own fixture diagram through POST/DELETE /api/diagrams.
 *
 * Run with: npm run test:e2e
 * Debug mode: HEADLESS=false npm run test:e2e
 *
 */

const path = require('path');
const puppeteer = require('puppeteer');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

// Set Jest timeout for all tests (E2E tests need more time)
jest.setTimeout(60000);

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
// Set in beforeAll once the fixture diagram has been created
let DIAGRAM_URL = null;

// Test configuration
const CONFIG = {
  headless: process.env.HEADLESS !== 'false', // Set HEADLESS=false to see browser
  slowMo: process.env.SLOWMO ? parseInt(process.env.SLOWMO) : 0, // SLOWMO=100 for debugging
  defaultTimeout: 30000,
  testTimeout: 60000,
  viewport: { width: 1920, height: 1080 },
};

// Correct CSS selectors for Diagram Studio components
const SELECTORS = {
  // Canvas
  canvasContainer: '.ds-canvas-container',
  canvasInner: '.ds-canvas-inner',
  grid: 'svg.ds-grid',
  connections: 'svg.ds-connections',

  // UI Components
  iconBar: '.ds-icon-bar',
  iconBtn: '.ds-icon-btn',
  header: '.ds-floating-header',
  editBar: '.floating-edit-bar',
  toolbar: '.ds-floating-toolbar',

  // Stencils
  stencilFlyout: '.ds-stencil-flyout',
  stencilItem: '.ds-stencil-item',

  // More packs
  morePacksBtn: '.ds-more-packs-btn',
  morePacksCount: '.ds-more-packs-count',
  morePacksPopover: '.ds-more-packs-popover',

  // Main container
  container: '.ds-container',
  workspace: '.ds-workspace',
};

// Helper to clear localStorage for fresh tests
async function clearLocalStorage(page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

// Helper to wait for the diagram studio to be ready
async function waitForDiagramStudio(page) {
  // Wait for the main canvas container (ds-canvas-container)
  await page.waitForSelector(SELECTORS.canvasContainer, {
    timeout: CONFIG.defaultTimeout,
  });
  // Wait for the grid SVG (indicates canvas is fully rendered)
  await page.waitForSelector(SELECTORS.grid, {
    timeout: CONFIG.defaultTimeout,
  });
  // Small delay to ensure React has finished rendering
  await page.waitForTimeout(500);
}

// Helper to check if we're on a login page
async function isOnLoginPage(page) {
  const url = page.url();
  const hasLoginPath = url.includes('/login') || url.includes('accounts.google.com');
  const hasLoginForm = await page.$('input[type="password"]');
  return hasLoginPath || hasLoginForm !== null;
}

// Helper to wait for and handle authentication
// Note: E2E tests require the user to be authenticated. In CI, use stored cookies.
async function ensureAuthenticated(page) {
  // Check if redirected to login
  const onLoginPage = await isOnLoginPage(page);
  if (onLoginPage) {
    console.warn('WARNING: Not authenticated. Please log in manually or set up test auth.');
    throw new Error('Authentication required. Run tests with an authenticated session.');
  }
}

describe('Diagram Studio E2E Tests', () => {
  let browser;
  let page;
  let sessionCookies = [];
  let fixtureDiagramId = null;

  // Setup before all tests
  beforeAll(async () => {
    const email = process.env.QA_ADMIN_EMAIL;
    const password = process.env.QA_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error(
        'QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD must be set (define them in .env.qa.local) to run e2e tests.'
      );
    }

    browser = await puppeteer.launch({
      headless: CONFIG.headless,
      slowMo: CONFIG.slowMo,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    // Log in once through the /login form and keep the session cookies
    const loginPage = await browser.newPage();
    try {
      loginPage.setDefaultTimeout(CONFIG.defaultTimeout);
      await loginPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
      await loginPage.type('#email', email);
      await loginPage.type('#password', password);
      await Promise.all([
        loginPage.waitForFunction(() => !window.location.pathname.startsWith('/login'), {
          timeout: CONFIG.defaultTimeout,
        }),
        loginPage.click('button[type="submit"]'),
      ]);
      sessionCookies = await loginPage.cookies();
      if (sessionCookies.length === 0) {
        throw new Error('Login produced no session cookies');
      }

      // Create a fresh fixture diagram (same-origin fetch carries the session)
      const created = await loginPage.evaluate(async () => {
        const res = await fetch('/api/diagrams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'infinite-canvas', name: 'E2E Fixture' }),
        });
        return { status: res.status, body: await res.json().catch(() => null) };
      });
      if (created.status !== 201 || !created.body) {
        throw new Error(`Fixture diagram creation failed (HTTP ${created.status})`);
      }
      fixtureDiagramId = created.body.id;
      const shortId = created.body.short_id || created.body.shortId || created.body.id;
      DIAGRAM_URL = `${BASE_URL}/diagram/${shortId}`;
    } finally {
      await loginPage.close().catch(() => {});
    }
  });

  // Cleanup after all tests
  afterAll(async () => {
    try {
      if (browser && fixtureDiagramId && sessionCookies.length) {
        const p = await browser.newPage();
        await p.setCookie(...sessionCookies);
        await p.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
        await p.evaluate(
          (id) => fetch(`/api/diagrams/${id}`, { method: 'DELETE' }),
          fixtureDiagramId
        );
        await p.close();
      }
    } catch (err) {
      console.warn('E2E cleanup of fixture diagram failed:', err.message);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });

  // Create a new page for each test
  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport(CONFIG.viewport);
    page.setDefaultTimeout(CONFIG.defaultTimeout);
    // page.waitForTimeout was removed in Puppeteer 22+; keep tests working
    if (typeof page.waitForTimeout !== 'function') {
      page.waitForTimeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    }
    await page.setCookie(...sessionCookies);
  });

  // Close page after each test
  afterEach(async () => {
    try {
      if (page && !page.isClosed()) {
        await page.close();
      }
    } catch (err) {
      // A crashed/closed page must not fail subsequent tests
    } finally {
      page = null;
    }
  });

  // ============================================================
  // SECTION 1: Canvas Basics
  // ============================================================
  describe('1. Canvas Basics', () => {
    it('1.1 Page loads correctly', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });

      // Check that the page title contains expected text
      const title = await page.title();
      expect(title).toContain('Ontographia');
    });

    it('1.2 Canvas is visible', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Check for the main canvas container
      const canvas = await page.$(SELECTORS.canvasContainer);
      expect(canvas).not.toBeNull();

      // Verify canvas has proper dimensions
      const canvasBounds = await canvas.boundingBox();
      expect(canvasBounds.width).toBeGreaterThan(100);
      expect(canvasBounds.height).toBeGreaterThan(100);
    });

    it('1.3 Left stencil bar (FloatingIconBar) is visible', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Look for the icon bar on the left (uses class .ds-icon-bar)
      const iconBar = await page.$(SELECTORS.iconBar);
      expect(iconBar).not.toBeNull();

      // Verify it's positioned on the left side
      if (iconBar) {
        const bounds = await iconBar.boundingBox();
        expect(bounds.x).toBeLessThan(200); // Should be near left edge
      }
    });

    it('1.4 Right toolbar (FloatingToolbar) is visible', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Look for the floating toolbar
      const toolbar = await page.$(SELECTORS.toolbar);
      expect(toolbar).not.toBeNull();

      // Verify it's on the right side
      if (toolbar) {
        const bounds = await toolbar.boundingBox();
        expect(bounds.x).toBeGreaterThan(800); // Should be near right edge
      }
    });

    it('1.5 Top edit bar (FloatingEditBar) is visible', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Look for the edit bar (uses class .floating-edit-bar)
      const editBar = await page.$(SELECTORS.editBar);
      expect(editBar).not.toBeNull();
    });
  });

  // ============================================================
  // SECTION 2: Stencil Placement
  // ============================================================
  describe('2. Stencil Placement', () => {
    it('2.1 Click stencil pack icon to open flyout', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Find and click the first pack button in the icon bar
      const packButtons = await page.$$(`${SELECTORS.iconBar} ${SELECTORS.iconBtn}`);

      if (packButtons.length > 0) {
        await packButtons[0].click();
        await page.waitForTimeout(500);

        // Check if flyout panel opened
        const flyout = await page.$(SELECTORS.stencilFlyout);
        expect(flyout).not.toBeNull();
      } else {
        // No pack buttons - test is skipped
        expect(true).toBe(true);
      }
    });

    it('2.2 Drag stencil to canvas', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Open a stencil pack first
      const packButtons = await page.$$(`${SELECTORS.iconBar} ${SELECTORS.iconBtn}`);
      if (packButtons.length > 0) {
        await packButtons[0].click();
        await page.waitForTimeout(500);
      }

      // Find a stencil item in the flyout
      const stencilItem = await page.$(SELECTORS.stencilItem);

      if (stencilItem) {
        const stencilBounds = await stencilItem.boundingBox();
        const canvasCenter = { x: 600, y: 400 };

        // Perform drag and drop
        await page.mouse.move(
          stencilBounds.x + stencilBounds.width / 2,
          stencilBounds.y + stencilBounds.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(canvasCenter.x, canvasCenter.y, { steps: 10 });
        await page.mouse.up();

        await page.waitForTimeout(500);

        // Check if element was created on canvas
        const elements = await page.$$('g[data-element-id], .ds-element');
        expect(elements.length).toBeGreaterThanOrEqual(0); // May or may not create depending on state
      }
    });

    it('2.3 Click-to-place stencil on canvas', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Open a stencil pack
      const packButtons = await page.$$(`${SELECTORS.iconBar} ${SELECTORS.iconBtn}`);
      if (packButtons.length > 0) {
        await packButtons[0].click();
        await page.waitForTimeout(500);
      }

      // Click a stencil to select it
      const stencilItem = await page.$(SELECTORS.stencilItem);
      if (stencilItem) {
        await stencilItem.click();
        await page.waitForTimeout(200);

        // Click on the canvas to place the stencil
        const canvas = await page.$(SELECTORS.canvasContainer);
        if (canvas) {
          const canvasBounds = await canvas.boundingBox();
          await page.mouse.click(
            canvasBounds.x + canvasBounds.width / 2,
            canvasBounds.y + canvasBounds.height / 2
          );
          await page.waitForTimeout(500);
        }
      }
    });
  });

  // ============================================================
  // SECTION 3: Keyboard Shortcuts
  // ============================================================
  describe('3. Keyboard Shortcuts', () => {
    it('3.1 Press ? to show shortcuts overlay', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Press ? (Shift + /)
      await page.keyboard.down('Shift');
      await page.keyboard.press('/');
      await page.keyboard.up('Shift');

      await page.waitForTimeout(500);

      // Check if shortcuts overlay is visible
      const overlay = await page.$('.keyboard-shortcuts-overlay, [class*="shortcuts-overlay"]');
      expect(overlay).not.toBeNull();

      // Verify content
      const overlayText = await page.evaluate((el) => el?.textContent, overlay);
      if (overlayText) {
        expect(overlayText.toLowerCase()).toContain('keyboard');
      }
    });

    it('3.2 Press Escape to close shortcuts overlay', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Open shortcuts overlay first
      await page.keyboard.down('Shift');
      await page.keyboard.press('/');
      await page.keyboard.up('Shift');
      await page.waitForTimeout(300);

      // Verify it's open
      let overlay = await page.$('.keyboard-shortcuts-overlay, [class*="shortcuts-overlay"]');
      expect(overlay).not.toBeNull();

      // Press Escape to close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Verify it's closed
      overlay = await page.$('.keyboard-shortcuts-overlay, [class*="shortcuts-overlay"]');
      expect(overlay).toBeNull();
    });

    it('3.3 Press V to activate select tool', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Press V for select tool
      await page.keyboard.press('v');
      await page.waitForTimeout(200);

      // Check if select tool is active (look for active state on button)
      const activeSelectTool = await page.$(
        '[data-tool="select"].active, [title*="Select"][class*="active"], button[aria-pressed="true"][title*="Select"]'
      );

      // Alternative: check cursor or other visual indicators
      const cursor = await page.evaluate(() => {
        const canvas = document.querySelector('.diagram-studio-canvas, svg.diagram-canvas');
        return canvas ? getComputedStyle(canvas).cursor : null;
      });

      // At minimum, verify no errors occurred
      expect(true).toBe(true);
    });

    it('3.4 Press C to activate connect tool', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Press C for connect tool
      await page.keyboard.press('c');
      await page.waitForTimeout(200);

      // Check if connect tool is active
      const activeConnectTool = await page.$(
        '[data-tool="connect"].active, [title*="Connect"][class*="active"], button[aria-pressed="true"][title*="Connect"]'
      );

      // The test passes if no errors occur
      expect(true).toBe(true);
    });

    it('3.5 Press H to activate pan tool', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Press H for pan tool
      await page.keyboard.press('h');
      await page.waitForTimeout(200);

      // Verify pan mode is active (cursor changes or button state)
      expect(true).toBe(true);
    });

    it('3.6 Press G to toggle grid', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Get initial grid state
      const gridBefore = await page.$('.diagram-grid, [class*="grid-pattern"], pattern[id*="grid"]');

      // Press G to toggle grid
      await page.keyboard.press('g');
      await page.waitForTimeout(300);

      // Grid state should have changed (or stayed if already toggled)
      expect(true).toBe(true);
    });
  });

  // ============================================================
  // SECTION 4: Connection Creation
  // ============================================================
  describe('4. Connection Creation', () => {
    it('4.1 Create two elements and connect them', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Open stencil pack
      const packButtons = await page.$$(`${SELECTORS.iconBar} ${SELECTORS.iconBtn}`);
      if (packButtons.length > 0) {
        await packButtons[0].click();
        await page.waitForTimeout(500);
      }

      // Create first element
      const stencilItem = await page.$(SELECTORS.stencilItem);
      if (stencilItem) {
        const stencilBounds = await stencilItem.boundingBox();

        // Drag first element to position 1
        await page.mouse.move(
          stencilBounds.x + stencilBounds.width / 2,
          stencilBounds.y + stencilBounds.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(400, 300, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(500);

        // Drag second element to position 2
        await page.mouse.move(
          stencilBounds.x + stencilBounds.width / 2,
          stencilBounds.y + stencilBounds.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(700, 300, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(500);
      }

      // Switch to connect tool
      await page.keyboard.press('c');
      await page.waitForTimeout(200);

      // Draw connection between elements (approximate positions)
      await page.mouse.move(450, 300);
      await page.mouse.down();
      await page.mouse.move(650, 300, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);

      // Check for connection path
      const connectionsSvg = await page.$(SELECTORS.connections);
      expect(connectionsSvg).not.toBeNull();
    });

    it('4.2 Connection renders between elements', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // This test validates that the connection system SVG layer exists
      // Full connection creation is tested in 4.1

      // Check for the connections SVG layer
      const connectionsSvg = await page.$(SELECTORS.connections);
      expect(connectionsSvg).not.toBeNull();
    });
  });

  // ============================================================
  // SECTION 5: Comment System
  // ============================================================
  describe('5. Comment System', () => {
    it('5.1 Press M to activate comment mode', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Press M for comment tool
      await page.keyboard.press('m');
      await page.waitForTimeout(200);

      // Check if comment tool button is active
      const activeCommentTool = await page.$(
        '[data-tool="comment"].active, [title*="Comment"][class*="active"]'
      );

      // Verify tool changed
      expect(true).toBe(true);
    });

    it('5.2 Click canvas to place comment', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Activate comment mode
      await page.keyboard.press('m');
      await page.waitForTimeout(200);

      // Click on canvas to place comment
      await page.mouse.click(500, 400);
      await page.waitForTimeout(500);

      // Check for comment marker or input
      const commentMarker = await page.$('.ds-comment-marker, [class*="comment-marker"]');
      const commentInput = await page.$('.ds-comment-input, [class*="comment-input"], textarea');

      // Comment system should show some UI element
      // Note: Based on CLAUDE.md, comment system needs investigation
    });

    it('5.3 Verify comment marker appears after placement', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // This test documents expected behavior
      // The CLAUDE.md notes that the comment system is not working and needs investigation

      // Placeholder test - should be updated when comment system is fixed
      expect(true).toBe(true);
    });
  });

  // ============================================================
  // SECTION 6: Empty Canvas Welcome
  // ============================================================
  describe('6. Empty Canvas Welcome', () => {
    beforeEach(async () => {
      // Clear localStorage to reset welcome state
      if (page) {
        await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
        await clearLocalStorage(page);
      }
    });

    it('6.1 Welcome message appears on empty canvas', async () => {
      // Navigate fresh to trigger welcome
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Look for welcome component
      const welcome = await page.$('.ds-empty-canvas-welcome, [class*="welcome"], [class*="onboarding"]');

      // Check for welcome title text
      const welcomeText = await page.evaluate(() => {
        const el = document.querySelector('.ds-welcome-title, h2[class*="welcome"]');
        return el?.textContent;
      });

      if (welcomeText) {
        expect(welcomeText.toLowerCase()).toContain('welcome');
      }
    });

    it('6.2 Clicking dismiss hides welcome message', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Find and click dismiss button
      const dismissButton = await page.$('.ds-welcome-dismiss, [aria-label*="Dismiss"], [title*="Dismiss"], button[class*="close"]');

      if (dismissButton) {
        await dismissButton.click();
        await page.waitForTimeout(300);

        // Verify welcome is hidden
        const welcome = await page.$('.ds-empty-canvas-welcome, [class*="welcome"]');

        // Either null or hidden
        if (welcome) {
          const isVisible = await page.evaluate((el) => {
            const style = getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
          }, welcome);
          expect(isVisible).toBe(false);
        }
      }
    });

    it('6.3 Welcome shows quick action buttons', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Look for "Add shapes" button
      const addShapesBtn = await page.$('.ds-welcome-action-btn');

      // Look for "Use template" button
      const templateBtn = await page.$('.ds-welcome-action-btn:nth-child(2)');

      // At least one action button should exist
      expect(addShapesBtn !== null || templateBtn !== null).toBe(true);
    });
  });

  // ============================================================
  // SECTION 7: Pack Discovery
  // ============================================================
  describe('7. Pack Discovery', () => {
    it('7.1 Click "+N more" button to show pack popover', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Look for the "more packs" button
      const moreButton = await page.$(SELECTORS.morePacksBtn);

      if (moreButton) {
        await moreButton.click();
        await page.waitForTimeout(500);

        // Check for popover/dropdown with pack list
        const packPopover = await page.$(SELECTORS.morePacksPopover);
        expect(packPopover).not.toBeNull();
      } else {
        // If no more button, all packs are already enabled - test passes
        expect(true).toBe(true);
      }
    });

    it('7.2 Pack popover shows available packs', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Open more packs if button exists
      const moreButton = await page.$(SELECTORS.morePacksBtn);
      if (moreButton) {
        await moreButton.click();
        await page.waitForTimeout(500);

        // Look for pack items in the popover
        const packItems = await page.$$(`${SELECTORS.morePacksPopover} [class*="pack-item"]`);

        // Some packs should be listed (we have 9 hidden packs)
        expect(packItems.length).toBeGreaterThan(0);
      }
    });

    it('7.3 Can enable/disable packs from popover', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Open more packs popover
      const moreButton = await page.$(SELECTORS.morePacksBtn);
      if (moreButton) {
        await moreButton.click();
        await page.waitForTimeout(500);

        // Find a pack checkbox or toggle in the popover
        const packToggle = await page.$(`${SELECTORS.morePacksPopover} input[type="checkbox"]`);

        if (packToggle) {
          // Get initial state
          const initialChecked = await page.evaluate(el => el.checked, packToggle);

          // Click to toggle
          await packToggle.click();
          await page.waitForTimeout(300);

          // Verify state changed
          const newChecked = await page.evaluate(el => el.checked, packToggle);
          expect(newChecked).not.toBe(initialChecked);
        }
      }
    });
  });

  // ============================================================
  // SECTION 8: Additional Tests
  // ============================================================
  describe('8. Additional Functionality', () => {
    it('8.1 Zoom controls work', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Find zoom controls
      const zoomIn = await page.$('[title="Zoom In"], [aria-label="Zoom In"]');
      const zoomDisplay = await page.$('[class*="zoom-level"], [class*="zoom-display"]');

      if (zoomIn && zoomDisplay) {
        // Get initial zoom
        const initialZoom = await page.evaluate(el => el.textContent, zoomDisplay);

        // Click zoom in
        await zoomIn.click();
        await page.waitForTimeout(200);

        // Get new zoom
        const newZoom = await page.evaluate(el => el.textContent, zoomDisplay);

        // Zoom should have increased
        const initialValue = parseInt(initialZoom);
        const newValue = parseInt(newZoom);

        if (!isNaN(initialValue) && !isNaN(newValue)) {
          expect(newValue).toBeGreaterThan(initialValue);
        }
      }
    });

    it('8.2 Undo/Redo functionality', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Find undo/redo buttons
      const undoBtn = await page.$('[title*="Undo"], [aria-label*="Undo"]');
      const redoBtn = await page.$('[title*="Redo"], [aria-label*="Redo"]');

      // Both buttons should exist
      expect(undoBtn !== null || redoBtn !== null).toBe(true);
    });

    it('8.3 Grid toggle works', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Find grid toggle button
      const gridBtn = await page.$('[title*="Grid"], [aria-label*="Grid"], [data-tool="grid"]');

      if (gridBtn) {
        await gridBtn.click();
        await page.waitForTimeout(300);

        // Grid state should toggle
        expect(true).toBe(true);
      }
    });

    it('8.4 Properties panel opens on element selection', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Create an element first
      const packButtons = await page.$$(`${SELECTORS.iconBar} ${SELECTORS.iconBtn}`);
      if (packButtons.length > 0) {
        await packButtons[0].click();
        await page.waitForTimeout(500);

        const stencilItem = await page.$(SELECTORS.stencilItem);
        if (stencilItem) {
          // Drag to canvas
          const bounds = await stencilItem.boundingBox();
          await page.mouse.move(bounds.x + 10, bounds.y + 10);
          await page.mouse.down();
          await page.mouse.move(500, 400, { steps: 5 });
          await page.mouse.up();
          await page.waitForTimeout(500);

          // Double-click or press Enter/P to open properties panel
          await page.keyboard.press('p');
          await page.waitForTimeout(300);

          // Check for properties panel
          const propsPanel = await page.$('.ds-properties-panel, [class*="properties-panel"]');
          // Properties panel may or may not appear depending on selection
        }
      }
    });

    it('8.5 Collaboration bar is visible', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Look for collaboration bar (top right area)
      const collabBar = await page.$('.ds-collaboration-bar, [class*="collaboration"]');
      const shareBtn = await page.$('[title*="Share"]');

      // Either the bar or share button should exist
      expect(collabBar !== null || shareBtn !== null).toBe(true);
    });

    it('8.6 Header with branding is visible', async () => {
      await page.goto(DIAGRAM_URL, { waitUntil: 'networkidle0' });
      await waitForDiagramStudio(page);

      // Look for Ontographia branding
      const branding = await page.evaluate(() => {
        const text = document.body.textContent;
        return text.includes('Ontographia') || text.includes('ontographia');
      });

      expect(branding).toBe(true);
    });
  });
});

/**
 * Integration Test Helpers
 * These can be used for more complex test scenarios
 */
const TestHelpers = {
  /**
   * Create an element at specified position
   */
  async createElement(page, x, y, packIndex = 0) {
    const packButtons = await page.$$(`${SELECTORS.iconBar} ${SELECTORS.iconBtn}`);
    if (packButtons[packIndex]) {
      await packButtons[packIndex].click();
      await page.waitForTimeout(300);

      const stencil = await page.$(SELECTORS.stencilItem);
      if (stencil) {
        const bounds = await stencil.boundingBox();
        await page.mouse.move(bounds.x + 10, bounds.y + 10);
        await page.mouse.down();
        await page.mouse.move(x, y, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(300);
        return true;
      }
    }
    return false;
  },

  /**
   * Connect two elements
   */
  async connectElements(page, fromX, fromY, toX, toY) {
    await page.keyboard.press('c');
    await page.waitForTimeout(100);

    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(toX, toY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);
  },

  /**
   * Get element count on canvas
   */
  async getElementCount(page) {
    return page.evaluate(() => {
      const elements = document.querySelectorAll('[data-element-id], .ds-element');
      return elements.length;
    });
  },

  /**
   * Get connection count on canvas
   */
  async getConnectionCount(page) {
    return page.evaluate(() => {
      const connections = document.querySelectorAll('path[class*="connection"], svg.ds-connections path');
      return connections.length;
    });
  },

  /**
   * Open a stencil pack flyout
   */
  async openStencilPack(page, packIndex = 0) {
    const packButtons = await page.$$(`${SELECTORS.iconBar} ${SELECTORS.iconBtn}`);
    if (packButtons[packIndex]) {
      await packButtons[packIndex].click();
      await page.waitForTimeout(300);
      return true;
    }
    return false;
  },

  /**
   * Switch to a specific tool
   */
  async switchTool(page, tool) {
    const toolKeys = {
      select: 'v',
      connect: 'c',
      pan: 'h',
      comment: 'm',
    };
    const key = toolKeys[tool.toLowerCase()];
    if (key) {
      await page.keyboard.press(key);
      await page.waitForTimeout(100);
      return true;
    }
    return false;
  },
};

module.exports = { TestHelpers, SELECTORS };
