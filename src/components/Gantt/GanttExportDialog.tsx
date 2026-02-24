import React, { useState } from 'react';
import type { GanttExportOptions } from './types';

interface GanttExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: GanttExportOptions) => void;
}

export function GanttExportDialog({ isOpen, onClose, onExport }: GanttExportDialogProps) {
  const [options, setOptions] = useState<GanttExportOptions>({
    format: 'png',
    includeTaskList: true,
    dateRange: 'current',
  });
  
  if (!isOpen) return null;
  
  const handleExport = () => {
    onExport(options);
    onClose();
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-96 max-w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Export Gantt Chart</h3>
          <p className="text-sm text-gray-500 mt-1">Choose export format and options</p>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              <FormatButton
                format="png"
                label="PNG"
                icon="📷"
                selected={options.format === 'png'}
                onClick={() => setOptions({ ...options, format: 'png' })}
              />
              <FormatButton
                format="pdf"
                label="PDF"
                icon="📄"
                selected={options.format === 'pdf'}
                onClick={() => setOptions({ ...options, format: 'pdf' })}
              />
              <FormatButton
                format="svg"
                label="SVG"
                icon="🎨"
                selected={options.format === 'svg'}
                onClick={() => setOptions({ ...options, format: 'svg' })}
              />
            </div>
          </div>
          
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              value={options.dateRange}
              onChange={(e) => setOptions({ 
                ...options, 
                dateRange: e.target.value as GanttExportOptions['dateRange'] 
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="current">Current view</option>
              <option value="full">Full project</option>
              <option value="custom">Custom range</option>
            </select>
            
            {options.dateRange === 'custom' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start</label>
                  <input
                    type="date"
                    value={options.customStart ? formatDateForInput(options.customStart) : ''}
                    onChange={(e) => setOptions({
                      ...options,
                      customStart: e.target.value ? new Date(e.target.value) : undefined,
                    })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End</label>
                  <input
                    type="date"
                    value={options.customEnd ? formatDateForInput(options.customEnd) : ''}
                    onChange={(e) => setOptions({
                      ...options,
                      customEnd: e.target.value ? new Date(e.target.value) : undefined,
                    })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Options */}
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeTaskList}
                onChange={(e) => setOptions({ ...options, includeTaskList: e.target.checked })}
                className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
              />
              Include task list (left panel)
            </label>
          </div>
          
          {/* Format info */}
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
            {options.format === 'png' && (
              <p>📸 PNG - High quality image, best for presentations and sharing.</p>
            )}
            {options.format === 'pdf' && (
              <p>📄 PDF - Vector format, scalable and print-ready.</p>
            )}
            {options.format === 'svg' && (
              <p>🎨 SVG - Vector format, editable in design tools like Figma.</p>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

interface FormatButtonProps {
  format: string;
  label: string;
  icon: string;
  selected: boolean;
  onClick: () => void;
}

function FormatButton({ label, icon, selected, onClick }: FormatButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-3 border rounded-lg text-center transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-sm font-medium">{label}</div>
    </button>
  );
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default GanttExportDialog;
