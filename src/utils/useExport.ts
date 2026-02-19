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

  const hideControls = () => {
    const minimap = document.querySelector('.react-flow__minimap') as HTMLElement;
    const controls = document.querySelector('.react-flow__controls') as HTMLElement;
    const attribution = document.querySelector('.react-flow__attribution') as HTMLElement;
    
    if (minimap) minimap.style.display = 'none';
    if (controls) controls.style.display = 'none';
    if (attribution) attribution.style.display = 'none';
  };

  const showControls = () => {
    const minimap = document.querySelector('.react-flow__minimap') as HTMLElement;
    const controls = document.querySelector('.react-flow__controls') as HTMLElement;
    const attribution = document.querySelector('.react-flow__attribution') as HTMLElement;
    
    if (minimap) minimap.style.display = 'block';
    if (controls) controls.style.display = 'flex';
    if (attribution) attribution.style.display = 'block';
  };

  const exportPNG = async () => {
    const canvas = document.querySelector('.react-flow') as HTMLElement;
    if (!canvas) {
      console.error('Canvas not found');
      return;
    }

    try {
      hideControls();
      
      // Wait a bit for DOM to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toPng(canvas, {
        quality: 2,
        backgroundColor: '#FDFDFD',
        pixelRatio: 3,
      });

      const link = document.createElement('a');
      link.download = getFileName('png');
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      showControls();
    }
  };

  const exportSVG = async () => {
    const canvas = document.querySelector('.react-flow') as HTMLElement;
    if (!canvas) {
      console.error('Canvas not found');
      return;
    }

    try {
      hideControls();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toSvg(canvas, {
        backgroundColor: '#FDFDFD',
      });

      const link = document.createElement('a');
      link.download = getFileName('svg');
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      showControls();
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
