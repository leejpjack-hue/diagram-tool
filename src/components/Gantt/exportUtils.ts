/**
 * Gantt Chart Export Utilities
 * 
 * Handle export to PNG, PDF, and SVG formats
 */

import type { GanttExportOptions } from './types';

/**
 * Export the Gantt chart to the specified format
 */
export async function exportGanttChart(
  canvasElement: HTMLElement,
  options: GanttExportOptions,
  projectName: string
): Promise<void> {
  const filename = `${projectName.replace(/\s+/g, '-').toLowerCase()}-${formatDateForFilename(new Date())}`;
  
  switch (options.format) {
    case 'png':
      await exportAsPng(canvasElement, filename, options);
      break;
    case 'pdf':
      await exportAsPdf(canvasElement, filename, options);
      break;
    case 'svg':
      await exportAsSvg(canvasElement, filename, options);
      break;
  }
}

/**
 * Export as PNG using html2canvas
 */
async function exportAsPng(
  element: HTMLElement,
  filename: string,
  _options: GanttExportOptions
): Promise<void> {
  try {
    // Dynamic import to avoid bundling if not used
    const html2canvas = (await import('html2canvas')).default;
    
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2, // High resolution
      logging: false,
      useCORS: true,
    });
    
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('Failed to export PNG:', error);
    // Fallback: try without html2canvas
    fallbackExportAsPng(element, filename);
  }
}

/**
 * Fallback PNG export using native canvas
 */
function fallbackExportAsPng(element: HTMLElement, filename: string): void {
  // Find SVG element
  const svg = element.querySelector('svg');
  if (!svg) {
    alert('Could not find chart to export');
    return;
  }
  
  const svgData = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
    
    URL.revokeObjectURL(url);
  };
  
  img.src = url;
}

/**
 * Export as PDF using jsPDF
 */
async function exportAsPdf(
  element: HTMLElement,
  filename: string,
  _options: GanttExportOptions
): Promise<void> {
  try {
    // Dynamic imports
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]);
    
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
    });
    
    const imgData = canvas.toDataURL('image/png');
    
    // Calculate PDF dimensions (A4 landscape)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
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
  element: HTMLElement,
  filename: string,
  options: GanttExportOptions
): Promise<void> {
  const svg = element.querySelector('svg');
  if (!svg) {
    alert('Could not find chart to export');
    return;
  }
  
  // Clone SVG to avoid modifying original
  const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
  
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
