import { toPng, toSvg } from 'html-to-image';
import { useDiagramStore } from '../store/diagramStore';
import { useGanttStore } from '../components/Gantt/ganttStore';

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

  const csvEscape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const downloadCSV = (rows: string[][], filenameExt: string) => {
    const csv = '\uFEFF' + rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.download = getFileName(filenameExt);
    link.href = url;
    link.click();

    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    if (diagramMode === 'gantt') {
      const { tasks, dependencies } = useGanttStore.getState();
      const depsByTask = new Map<string, string[]>();
      dependencies.forEach(d => {
        const list = depsByTask.get(d.successorId) || [];
        list.push(d.predecessorId);
        depsByTask.set(d.successorId, list);
      });

      const fmtDate = (d: Date) => {
        const dt = d instanceof Date ? d : new Date(d);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const rows: string[][] = [
        ['id', 'name', 'start', 'end', 'progress', 'assignee', 'color', 'milestone', 'depends'],
        ...tasks.map(t => {
          const depIds = depsByTask.get(t.id) || [];
          const depNames = depIds
            .map(id => tasks.find(x => x.id === id)?.name ?? id)
            .join(';');
          return [
            t.id,
            t.name,
            fmtDate(t.startDate),
            fmtDate(t.endDate),
            String(t.progress ?? 0),
            t.assignee ?? '',
            t.color ?? '',
            t.milestone ? 'true' : 'false',
            depNames,
          ];
        }),
      ];
      downloadCSV(rows, 'csv');
      return;
    }

    if (!parsedDiagram) {
      console.warn('No diagram to export');
      return;
    }

    const nodeById = new Map(parsedDiagram.nodes.map(n => [n.id, n]));

    const protocolOf = (node: any): string => {
      if (!node) return '';
      if (node.type === 'database') return node.properties?.type || 'database';
      if (node.type === 'queue') return node.properties?.type || 'queue';
      if (node.type === 'service') return node.properties?.tech || 'http';
      return node.type || '';
    };

    const rows: string[][] = [
      ['source_service', 'target_service', 'protocol', 'operation', 'details'],
    ];

    if (parsedDiagram.edges && parsedDiagram.edges.length > 0) {
      parsedDiagram.edges.forEach(edge => {
        const fromNode = nodeById.get(edge.from);
        const toNode = nodeById.get(edge.to);
        rows.push([
          fromNode?.name ?? edge.from,
          toNode?.name ?? edge.to,
          protocolOf(toNode),
          edge.label ?? '',
          '',
        ]);
      });
    } else {
      parsedDiagram.nodes.forEach(node => {
        if (node.type === 'service' && Array.isArray((node as any).connections)) {
          (node as any).connections.forEach((targetId: string) => {
            const toNode = nodeById.get(targetId);
            rows.push([
              node.name,
              toNode?.name ?? targetId,
              protocolOf(toNode),
              '',
              '',
            ]);
          });
        }
      });
    }

    downloadCSV(rows, 'csv');
  };

  return {
    exportPNG,
    exportSVG,
    exportJSON,
    exportCSV,
  };
};
