import { useState } from 'react';

type ExportFormat = 'png' | 'svg' | 'jpg' | 'pdf' | 'json' | 'csv';

interface ExportPanelProps {
  onExport: (format: ExportFormat, quality?: number) => void;
}

const RASTER_FORMATS: ExportFormat[] = ['png', 'jpg', 'pdf'];

export function ExportPanel({ onExport }: ExportPanelProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState(3);

  const handleExport = () => {
    onExport(selectedFormat, quality);
  };

  return (
    <div className="side-panel">
      {/* Header */}
      <div className="panel-header">
        <h2 className="panel-title">📤 Export</h2>
      </div>

      {/* Body */}
      <div className="panel-content">
        {/* Format Selection */}
        <div className="property-group">
          <label className="property-label">
            Format
          </label>
          <div className="space-y-2">
            <button
              onClick={() => setSelectedFormat('png')}
              className={`w-full p-3 rounded-lg border-2 text-left transition flex items-center gap-3 ${
                selectedFormat === 'png'
                  ? 'border-primary-600 bg-blue-50'
                  : 'border-gray-300 hover:border-primary-600'
              }`}
            >
              <span className="text-2xl">🖼️</span>
              <div>
                <div className="font-bold text-gray-900">PNG</div>
                <div className="text-xs text-gray-600">Crisp image for docs and wikis</div>
              </div>
              {selectedFormat === 'png' && (
                <span className="ml-auto text-primary-600">✓</span>
              )}
            </button>

            <button
              onClick={() => setSelectedFormat('svg')}
              className={`w-full p-3 rounded-lg border-2 text-left transition flex items-center gap-3 ${
                selectedFormat === 'svg'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-300 hover:border-indigo-300'
              }`}
            >
              <span className="text-2xl">📐</span>
              <div>
                <div className="font-bold text-gray-900">SVG</div>
                <div className="text-xs text-gray-600">Vector, free and portable</div>
              </div>
              {selectedFormat === 'svg' && (
                <span className="ml-auto text-indigo-600">✓</span>
              )}
            </button>

            <button
              onClick={() => setSelectedFormat('jpg')}
              className={`w-full p-3 rounded-lg border-2 text-left transition flex items-center gap-3 ${
                selectedFormat === 'jpg'
                  ? 'border-rose-500 bg-rose-50'
                  : 'border-gray-300 hover:border-rose-300'
              }`}
            >
              <span className="text-2xl">📷</span>
              <div>
                <div className="font-bold text-gray-900">JPG</div>
                <div className="text-xs text-gray-600">Smaller file for quick sharing</div>
              </div>
              {selectedFormat === 'jpg' && (
                <span className="ml-auto text-rose-600">✓</span>
              )}
            </button>

            <button
              onClick={() => setSelectedFormat('pdf')}
              className={`w-full p-3 rounded-lg border-2 text-left transition flex items-center gap-3 ${
                selectedFormat === 'pdf'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-300 hover:border-purple-300'
              }`}
            >
              <span className="text-2xl">📄</span>
              <div>
                <div className="font-bold text-gray-900">PDF</div>
                <div className="text-xs text-gray-600">Print-ready document</div>
              </div>
              {selectedFormat === 'pdf' && (
                <span className="ml-auto text-purple-600">✓</span>
              )}
            </button>

            <button
              onClick={() => setSelectedFormat('json')}
              className={`w-full p-3 rounded-lg border-2 text-left transition flex items-center gap-3 ${
                selectedFormat === 'json'
                  ? 'border-success-500 bg-green-50'
                  : 'border-gray-300 hover:border-green-300'
              }`}
            >
              <span className="text-2xl">📄</span>
              <div>
                <div className="font-bold text-gray-900">JSON</div>
                <div className="text-xs text-gray-600">Structured data for tools</div>
              </div>
              {selectedFormat === 'json' && (
                <span className="ml-auto text-success-600">✓</span>
              )}
            </button>

            <button
              onClick={() => setSelectedFormat('csv')}
              className={`w-full p-3 rounded-lg border-2 text-left transition flex items-center gap-3 ${
                selectedFormat === 'csv'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-300 hover:border-amber-300'
              }`}
            >
              <span className="text-2xl">📊</span>
              <div>
                <div className="font-bold text-gray-900">CSV</div>
                <div className="text-xs text-gray-600">Open in Excel or Sheets</div>
              </div>
              {selectedFormat === 'csv' && (
                <span className="ml-auto text-amber-600">✓</span>
              )}
            </button>
          </div>
        </div>

        {/* Quality Settings (raster formats) */}
        {RASTER_FORMATS.includes(selectedFormat) && (
          <div className="property-group">
            <label className="property-label">
              Image resolution
            </label>
            <select
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="input"
            >
              <option value={1}>1× — Standard</option>
              <option value={2}>2× — High quality</option>
              <option value={3}>3× — Presentation (recommended)</option>
              <option value={4}>4× — Print</option>
            </select>
          </div>
        )}

        {/* Export Button */}
        <button
          onClick={handleExport}
          className="w-full py-3 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
        >
          Download {selectedFormat.toUpperCase()}
        </button>

        <p data-testid="export-portable-copy" className="mt-4 text-xs leading-5 text-gray-600">
          This format is portable and free. SVG, PNG at 1×–4× (including 2×), PDF, and JSON backup
          download on this device with no account and no watermark.
        </p>
      </div>
    </div>
  );
}
