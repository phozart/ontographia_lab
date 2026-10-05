// __tests__/components/diagram-studio/FloatingToolbar.test.js
import { render, screen, fireEvent } from '@testing-library/react';
import FloatingToolbar from '../../../components/diagram-studio/ui/FloatingToolbar';
import { DiagramProvider } from '../../../components/diagram-studio/DiagramContext';

// Wrapper component
const Wrapper = ({ children }) => (
  <DiagramProvider diagramId="test-diagram" defaultPack="process-flow">
    {children}
  </DiagramProvider>
);

const defaultProps = {
  profile: {
    exportPolicy: { formats: ['svg', 'png', 'json'] },
  },
  onExport: jest.fn(),
};

describe('FloatingToolbar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Zoom controls moved out of FloatingToolbar into TitleBar; the toolbar is export-only.
  it('does not render zoom controls (export-only toolbar)', () => {
    render(
      <Wrapper>
        <FloatingToolbar {...defaultProps} />
      </Wrapper>
    );

    expect(screen.queryByTitle('Zoom Out')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Zoom In')).not.toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
  });

  it('renders export button', () => {
    render(
      <Wrapper>
        <FloatingToolbar {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByTitle('Export')).toBeInTheDocument();
  });

  it('opens export menu when export button is clicked', () => {
    render(
      <Wrapper>
        <FloatingToolbar {...defaultProps} />
      </Wrapper>
    );

    const exportButton = screen.getByTitle('Export');
    fireEvent.click(exportButton);

    expect(screen.getByText('SVG')).toBeInTheDocument();
    expect(screen.getByText('PNG')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });

  it('calls onExport with correct format when export option is clicked', () => {
    render(
      <Wrapper>
        <FloatingToolbar {...defaultProps} />
      </Wrapper>
    );

    const exportButton = screen.getByTitle('Export');
    fireEvent.click(exportButton);

    const svgOption = screen.getByText('SVG');
    fireEvent.click(svgOption);

    expect(defaultProps.onExport).toHaveBeenCalledWith('svg');
  });

  it('closes export menu after selecting format', () => {
    render(
      <Wrapper>
        <FloatingToolbar {...defaultProps} />
      </Wrapper>
    );

    const exportButton = screen.getByTitle('Export');
    fireEvent.click(exportButton);

    const svgOption = screen.getByText('SVG');
    fireEvent.click(svgOption);

    expect(screen.queryByText('PNG')).not.toBeInTheDocument();
  });

  it('uses custom export formats from profile', () => {
    const customProps = {
      ...defaultProps,
      profile: {
        exportPolicy: { formats: ['pdf', 'svg'] },
      },
    };

    render(
      <Wrapper>
        <FloatingToolbar {...customProps} />
      </Wrapper>
    );

    const exportButton = screen.getByTitle('Export');
    fireEvent.click(exportButton);

    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('SVG')).toBeInTheDocument();
    expect(screen.queryByText('PNG')).not.toBeInTheDocument();
  });

  it('defaults to svg, png, json if no formats specified', () => {
    const noFormatProps = {
      ...defaultProps,
      profile: {},
    };

    render(
      <Wrapper>
        <FloatingToolbar {...noFormatProps} />
      </Wrapper>
    );

    const exportButton = screen.getByTitle('Export');
    fireEvent.click(exportButton);

    expect(screen.getByText('SVG')).toBeInTheDocument();
    expect(screen.getByText('PNG')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });
});
