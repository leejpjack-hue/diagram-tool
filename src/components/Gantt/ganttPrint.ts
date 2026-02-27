/**
 * Gantt Print Styles
 * 
 * Optimized print layout for Gantt charts
 */

export const ganttPrintStyles = `
@media print {
  /* Hide interactive elements */
  .gantt-controls,
  .gantt-filter-bar,
  .gantt-sidebar,
  .no-print {
    display: none !important;
  }
  
  /* Reset backgrounds for printing */
  body {
    background: white !important;
  }
  
  .gantt-container {
    overflow: visible !important;
    height: auto !important;
    width: 100% !important;
  }
  
  /* Ensure all content is visible */
  .gantt-timeline {
    overflow: visible !important;
    transform: none !important;
  }
  
  /* Page break handling */
  .gantt-task-row {
    page-break-inside: avoid;
  }
  
  /* Print header */
  .gantt-print-header {
    display: block !important;
    text-align: center;
    margin-bottom: 20px;
  }
  
  .gantt-print-header h1 {
    font-size: 24px;
    margin-bottom: 5px;
  }
  
  .gantt-print-header .subtitle {
    font-size: 12px;
    color: #666;
  }
  
  /* Ensure task bars have sufficient contrast */
  .gantt-task-bar {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  
  /* Legend for print */
  .gantt-print-legend {
    display: flex !important;
    justify-content: center;
    gap: 20px;
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px solid #ddd;
  }
  
  /* Page margins */
  @page {
    margin: 1cm;
    size: landscape;
  }
  
  /* Scale chart to fit page */
  .gantt-chart-svg {
    max-width: 100%;
    height: auto;
  }
  
  /* Ensure grid lines print */
  .gantt-grid-line {
    stroke: #ddd !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  
  /* Today line should be visible */
  .gantt-today-line {
    stroke: #ef4444 !important;
    stroke-width: 2 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  
  /* Dependencies arrows */
  .gantt-dependency-arrow {
    stroke: #666 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}

/* Screen styles (hidden when not printing) */
.gantt-print-header,
.gantt-print-legend {
  display: none;
}

/* Print-specific container class */
.gantt-print-container {
  position: relative;
}

.gantt-print-container::before {
  display: none;
  content: '';
}

@media print {
  .gantt-print-container::before {
    display: block;
    content: 'Gantt Chart - Project Timeline';
    font-size: 24px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 20px;
  }
}
`;

/**
 * Generate print-friendly HTML for Gantt chart
 */
export function generatePrintContent(
  title: string,
  projectStart: Date,
  projectEnd: Date,
  taskCount: number
): string {
  return `
    <div class="gantt-print-header">
      <h1>${title}</h1>
      <div class="subtitle">
        Project Timeline: ${projectStart.toLocaleDateString()} - ${projectEnd.toLocaleDateString()}
      </div>
      <div class="subtitle">
        ${taskCount} tasks • Generated on ${new Date().toLocaleDateString()}
      </div>
    </div>
    <div class="gantt-print-legend">
      <div><span style="display:inline-block;width:12px;height:12px;background:#3b82f6;margin-right:4px;"></span> In Progress</div>
      <div><span style="display:inline-block;width:12px;height:12px;background:#10b981;margin-right:4px;"></span> Complete</div>
      <div><span style="display:inline-block;width:12px;height:12px;background:#ef4444;margin-right:4px;"></span> Critical</div>
      <div><span style="display:inline-block;width:12px;height:12px;background:#f59e0b;margin-right:4px;"></span> At Risk</div>
    </div>
  `;
}

/**
 * Print the Gantt chart
 */
export function printGanttChart(): void {
  window.print();
}

/**
 * Export Gantt as PDF (requires print to PDF)
 */
export function exportGanttAsPDF(filename: string = 'gantt-chart'): void {
  // Set document title for PDF filename
  const originalTitle = document.title;
  document.title = filename;
  
  // Trigger print dialog
  window.print();
  
  // Restore original title
  setTimeout(() => {
    document.title = originalTitle;
  }, 1000);
}
