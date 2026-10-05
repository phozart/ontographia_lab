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

  it('renders zoom controls', () => {
    render(
      <Wrapper>
        <FloatingToolbar {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByTitle('Zoom Out')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom In')).toBeInTheDocument();
    expect(screen.getByTitle('Fit to Screen')).toBeInTheDocument();
  });

  it('displays current zoom level', () => {
    render(
      <Wrapper>
        <FloatingToolbar {...defaultProps} />
      </Wrapper>
    );

    // Default zoom is 100%
    expect(screen.getByText('100%')).toBeInTheDocument();
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
