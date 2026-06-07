/**
 * Gantt Chart Export Utilities
 * 
 * Handle export to PNG, PDF, and SVG formats
 */

import type { GanttExportOptions } from './types';
import { useGanttStore } from './ganttStore';

/**
 * Export the Gantt chart to the specified format
 */
export async function exportGanttChart(
  canvasElement: HTMLElement,
  options: GanttExportOptions,
  projectName: string
): Promise<void> {
  const filename = `${projectName.replace(/\s+/g, '-').toLowerCase()}-${formatDateForFilename(new Date())}`;

  // CSV export does not touch the DOM/SVG; short-circuit early.
  if (options.format === 'csv') {
    exportAsCsv(filename);
    return;
  }

  // Create a clone of the SVG with full height for all tasks
  const fullSvg = createFullHeightSvg(canvasElement);

  switch (options.format) {
    case 'png':
      await exportAsRaster(fullSvg, filename, options, 'image/png', 'png');
      break;
    case 'jpg':
      await exportAsRaster(fullSvg, filename, options, 'image/jpeg', 'jpg');
      break;
    case 'pdf':
      await exportAsPdf(fullSvg, filename, options);
      break;
    case 'svg':
      await exportAsSvg(fullSvg, filename, options);
      break;
  }
}

/**
 * Export tasks + dependencies as CSV
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatDateOnly(d: Date): string {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function exportAsCsv(filename: string): void {
  const { tasks, dependencies } = useGanttStore.getState();

  const depsByTask = new Map<string, string[]>();
  dependencies.forEach(d => {
    const list = depsByTask.get(d.successorId) || [];
    list.push(d.predecessorId);
    depsByTask.set(d.successorId, list);
  });

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
        formatDateOnly(t.startDate),
        formatDateOnly(t.endDate),
        String(t.progress ?? 0),
        t.assignee ?? '',
        t.color ?? '',
        t.milestone ? 'true' : 'false',
        depNames,
      ];
    }),
  ];

  const csv = '\uFEFF' + rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = `${filename}.csv`;
  link.href = url;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * Create a full-height SVG clone that includes all tasks (even off-screen ones)
 */
function createFullHeightSvg(element: HTMLElement): SVGSVGElement {
  const originalSvg = element.querySelector('svg');
  if (!originalSvg) {
    throw new Error('Could not find SVG element');
  }
  
  // Clone the SVG
  const clonedSvg = originalSvg.cloneNode(true) as SVGSVGElement;
  
  // Find all task rows by looking for task name cells
  // Each task has a task name cell rect at the left with width="200" (TASK_NAME_WIDTH)
  const allRects = clonedSvg.querySelectorAll('rect');
  let taskCount = 0;
  
  allRects.forEach(rect => {
    const width = rect.getAttribute('width');
    const x = rect.getAttribute('x');
    // Task name cells have width="200" and x="0"
    if (width === '200' && x === '0') {
      taskCount++;
    }
  });
  
  // If we can't find tasks via rect, try alternative method
  if (taskCount === 0) {
    // Fallback: count based on current height
    const currentHeight = originalSvg.clientHeight || 600;
    const HEADER_HEIGHT = 60;
    const ROW_HEIGHT = 40;
    taskCount = Math.max(1, Math.floor((currentHeight - HEADER_HEIGHT) / ROW_HEIGHT));
  }
  
  // Constants from GanttCanvas.tsx
  const HEADER_HEIGHT = 60;
  const ROW_HEIGHT = 40;  // Updated to match actual value in GanttCanvas.tsx
  const calculatedHeight = HEADER_HEIGHT + (taskCount * ROW_HEIGHT) + 20;
  
  // Get current viewBox
  const currentViewBox = originalSvg.getAttribute('viewBox') || '0 0 1200 600';
  const [minX, minY, , ] = currentViewBox.split(' ').map(Number);
  const width = originalSvg.clientWidth || 1200;
  
  // Set new viewBox to include all tasks
  clonedSvg.setAttribute('viewBox', `${minX} ${minY} ${width} ${calculatedHeight}`);
  clonedSvg.setAttribute('height', `${calculatedHeight}`);
  clonedSvg.setAttribute('width', `${width}`);
  
  // Remove scroll clipping
  const style = clonedSvg.getAttribute('style') || '';
  clonedSvg.setAttribute('style', style.replace(/overflow:\s*hidden;?/gi, ''));
  
  // Make sure all content is visible
  clonedSvg.style.overflow = 'visible';
  
  console.log(`Export: Found ${taskCount} tasks, calculated height: ${calculatedHeight}px`);
  
  return clonedSvg;
}

/**
 * Export as PNG using html2canvas
 */
async function exportAsRaster(
  svgElement: SVGSVGElement,
  filename: string,
  options: GanttExportOptions,
  mimeType: 'image/png' | 'image/jpeg',
  ext: 'png' | 'jpg'
): Promise<void> {
  // Options available for future enhancements (includeTaskList, dateRange, etc.)
  void options;
  try {
    // Create a temporary container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.backgroundColor = '#ffffff';
    document.body.appendChild(container);
    
    // Add white background rect to SVG
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', '#ffffff');
    clonedSvg.insertBefore(rect, clonedSvg.firstChild);
    
    container.appendChild(clonedSvg);
    
    // Dynamic import to avoid bundling if not used
    const html2canvas = (await import('html2canvas')).default;
    
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 2, // High resolution
      logging: false,
      useCORS: true,
      width: parseInt(clonedSvg.getAttribute('width') || '1200'),
      height: parseInt(clonedSvg.getAttribute('height') || '600'),
      windowWidth: parseInt(clonedSvg.getAttribute('width') || '1200'),
      windowHeight: parseInt(clonedSvg.getAttribute('height') || '600'),
    });
    
    // Clean up
    document.body.removeChild(container);
    
    const link = document.createElement('a');
    link.download = `${filename}.${ext}`;
    link.href = mimeType === 'image/jpeg'
      ? canvas.toDataURL('image/jpeg', 0.95)
      : canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error(`Failed to export ${ext.toUpperCase()}:`, error);
    // Fallback: try without html2canvas
    fallbackExportAsRaster(svgElement, filename, mimeType, ext);
  }
}

/**
 * Fallback raster export using native canvas
 */
function fallbackExportAsRaster(
  svgElement: SVGSVGElement,
  filename: string,
  mimeType: 'image/png' | 'image/jpeg',
  ext: 'png' | 'jpg'
): void {
  try {
    // Add white background
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', '#ffffff');
    clonedSvg.insertBefore(rect, clonedSvg.firstChild);
    
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const width = parseInt(svgElement.getAttribute('width') || '1200');
      const height = parseInt(svgElement.getAttribute('height') || '600');
      canvas.width = width * 2;
      canvas.height = height * 2;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const link = document.createElement('a');
        link.download = `${filename}.${ext}`;
        link.href = mimeType === 'image/jpeg'
          ? canvas.toDataURL('image/jpeg', 0.95)
          : canvas.toDataURL('image/png');
        link.click();
      }

      URL.revokeObjectURL(url);
    };

    img.src = url;
  } catch (error) {
    console.error(`Fallback ${ext.toUpperCase()} export failed:`, error);
    alert(`Failed to export ${ext.toUpperCase()}. Please try PDF format instead.`);
  }
}

/**
 * Export as PDF using jsPDF
 */
async function exportAsPdf(
  svgElement: SVGSVGElement,
  filename: string,
  options: GanttExportOptions
): Promise<void> {
  // Options available for future enhancements (includeTaskList, dateRange, etc.)
  void options;
  try {
    // Create a temporary container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.backgroundColor = '#ffffff';
    document.body.appendChild(container);
    
    // Add white background rect to SVG
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', '#ffffff');
    clonedSvg.insertBefore(rect, clonedSvg.firstChild);
    
    container.appendChild(clonedSvg);
    
    // Dynamic imports
    const jsPDF = (await import('jspdf')).default;
    const html2canvas = (await import('html2canvas')).default;
    
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
      width: parseInt(clonedSvg.getAttribute('width') || '1200'),
      height: parseInt(clonedSvg.getAttribute('height') || '600'),
    });
    
    // Clean up
    document.body.removeChild(container);
    
    const imgData = canvas.toDataURL('image/png');
    
    // Calculate PDF dimensions based on content
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    // Use A3 or larger if needed, otherwise A4 landscape
    const isLarge = imgHeight > 2000;
    const pdf = new jsPDF({
      orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
      unit: 'mm',
      format: isLarge ? [297, 420] : 'a4', // A3 if large, A4 otherwise
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight) * 0.9;
    
    const finalWidth = imgWidth * ratio;
    const finalHeight = imgHeight * ratio;
    
    const x = (pageWidth - finalWidth) / 2;
    const y = (pageHeight - finalHeight) / 2;
    
    pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Failed to export PDF:', error);
    alert('PDF export requires jspdf and html2canvas packages. Please install them or use PNG export.');
  }
}

/**
 * Export as SVG (direct SVG download)
 */
async function exportAsSvg(
  svgElement: SVGSVGElement,
  filename: string,
  options: GanttExportOptions
): Promise<void> {
  // Options available for future enhancements (includeTaskList, dateRange, etc.)
  void options;
  
  // Clone SVG to avoid modifying original
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  
  // Add white background
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', '#ffffff');
  clonedSvg.insertBefore(rect, clonedSvg.firstChild);
  
  // Add XML declaration and namespace
  const svgData = new XMLSerializer().serializeToString(clonedSvg);
  const svgWithNamespace = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" ${svgData.slice(4)}`;
  
  const blob = new Blob([svgWithNamespace], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.download = `${filename}.svg`;
  link.href = url;
  link.click();
  
  URL.revokeObjectURL(url);
}

/**
 * Format date for filename
 */
function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
