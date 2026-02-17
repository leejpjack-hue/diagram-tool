import { toPng, toSvg } from 'html-to-image';
import { useDiagramStore } from '../store/diagramStore';

export const useExport = () => {
  const { parsedDiagram, diagramMode } = useDiagramStore();

  const getFileName = (format: string) => {
    const title = parsedDiagram?.title || 'diagram';
    const mode = diagramMode;
    const date = new Date().toISOString().split('T')[0];
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${cleanTitle}-${mode}-${date}.${format}`;
  };

  const exportPNG = async () => {
    const canvas = document.querySelector('.react-flow') as HTMLElement;
    if (!canvas) {
      console.error('Canvas not found');
      return;
    }

    try {
      const dataUrl = await toPng(canvas, {
        quality: 2,
        backgroundColor: '#FDFDFD',
        pixelRatio: 3, // 3x resolution for presentation quality
      });

      const link = document.createElement('a');
      link.download = getFileName('png');
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const exportSVG = async () => {
    const canvas = document.querySelector('.react-flow') as HTMLElement;
    if (!canvas) {
      console.error('Canvas not found');
      return;
    }

    try {
      const dataUrl = await toSvg(canvas, {
        backgroundColor: '#FDFDFD',
      });

      const link = document.createElement('a');
      link.download = getFileName('svg');
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const exportJSON = () => {
    if (!parsedDiagram) return;

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      diagram: parsedDiagram,
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.download = getFileName('json');
    link.href = url;
    link.click();

    URL.revokeObjectURL(url);
  };

  return {
    exportPNG,
    exportSVG,
    exportJSON,
  };
};
