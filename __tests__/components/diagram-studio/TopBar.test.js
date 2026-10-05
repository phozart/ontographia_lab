// __tests__/components/diagram-studio/TopBar.test.js
import { render, screen, fireEvent } from '@testing-library/react';
import TopBar from '../../../components/diagram-studio/ui/TopBar';
import { DiagramProvider } from '../../../components/diagram-studio/DiagramContext';

// Wrapper component
const Wrapper = ({ children }) => (
  <DiagramProvider diagramId="test-diagram" defaultPack="process-flow">
    {children}
  </DiagramProvider>
);

const defaultProps = {
  profile: {
    editingPolicy: { readOnly: false },
  },
  diagramName: 'Test Diagram',
  onOpenCommandPalette: jest.fn(),
  onOpenShortcuts: jest.fn(),
};

describe('TopBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the diagram name', () => {
    render(
      <Wrapper>
        <TopBar {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByText('Test Diagram')).toBeInTheDocument();
  });

  it('renders tool buttons', () => {
    render(
      <Wrapper>
        <TopBar {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByTitle('Select (V)')).toBeInTheDocument();
    expect(screen.getByTitle('Connect (C)')).toBeInTheDocument();
    expect(screen.getByTitle('Pan (Space)')).toBeInTheDocument();
    expect(screen.getByTitle('Comment (M)')).toBeInTheDocument();
  });

  it('renders undo/redo buttons when not read-only', () => {
    render(
      <Wrapper>
        <TopBar {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByTitle('Undo (Ctrl+Z)')).toBeInTheDocument();
    expect(screen.getByTitle('Redo (Ctrl+Y)')).toBeInTheDocument();
  });

  it('hides undo/redo buttons when read-only', () => {
    const readOnlyProps = {
      ...defaultProps,
      profile: { editingPolicy: { readOnly: true } },
    };

    render(
      <Wrapper>
        <TopBar {...readOnlyProps} />
      </Wrapper>
    );

    expect(screen.queryByTitle('Undo (Ctrl+Z)')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Redo (Ctrl+Y)')).not.toBeInTheDocument();
  });

  it('calls onOpenCommandPalette when search button is clicked', () => {
    render(
      <Wrapper>
        <TopBar {...defaultProps} />
      </Wrapper>
    );

    const searchButton = screen.getByTitle('Search (Cmd+K)');
    fireEvent.click(searchButton);

    expect(defaultProps.onOpenCommandPalette).toHaveBeenCalled();
  });

  it('calls onOpenShortcuts when keyboard shortcuts button is clicked', () => {
    render(
      <Wrapper>
        <TopBar {...defaultProps} />
      </Wrapper>
    );

    const shortcutsButton = screen.getByTitle('Keyboard Shortcuts (?)');
    fireEvent.click(shortcutsButton);

    expect(defaultProps.onOpenShortcuts).toHaveBeenCalled();
  });

  it('opens grid style dropdown when grid button is clicked', () => {
    render(
      <Wrapper>
        <TopBar {...defaultProps} />
      </Wrapper>
    );

    const gridButton = screen.getByTitle('Grid style (G)');
    fireEvent.click(gridButton);

    expect(screen.getByText('Dots')).toBeInTheDocument();
    expect(screen.getByText('Lines')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('renders save button with correct status', () => {
    render(
      <Wrapper>
        <TopBar {...defaultProps} />
      </Wrapper>
    );

    // Initially saved
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('renders dashboard link', () => {
    render(
      <Wrapper>
        <TopBar {...defaultProps} />
      </Wrapper>
    );

    const dashboardLink = screen.getByTitle('Back to Dashboard');
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
  });
});
