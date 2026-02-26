import { useState } from 'react';

interface ExportPanelProps {
  onExport: (format: 'png' | 'svg' | 'json', quality?: number) => void;
}

export function ExportPanel({ onExport }: ExportPanelProps) {
  const [selectedFormat, setSelectedFormat] = useState<'png' | 'svg' | 'json'>('png');
  const [quality, setQuality] = useState(3);

  const handleExport = () => {
    onExport(selectedFormat, quality);
  };

  return (
    <div className="side-panel">
      {/* Header */}
      <div className="panel-header">
        <h2 className="panel-title">📤 Export Diagram</h2>
      </div>

      {/* Body */}
      <div className="panel-content">
        {/* Format Selection */}
        <div className="property-group">
          <label className="property-label">
            Select Format
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
                <div className="text-xs text-gray-600">Raster Image</div>
              </div>
              {selectedFormat === 'png' && (
                <span className="ml-auto text-primary-600">✓</span>
              )}
            </button>

            <button
              onClick={() => setSelectedFormat('svg')}
              className={`w-full p-3 rounded-lg border-2 text-left transition flex items-center gap-3 ${
                selectedFormat === 'svg'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-300 hover:border-purple-300'
              }`}
            >
              <span className="text-2xl">📐</span>
              <div>
                <div className="font-bold text-gray-900">SVG</div>
                <div className="text-xs text-gray-600">Vector Image</div>
              </div>
              {selectedFormat === 'svg' && (
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
                <div className="text-xs text-gray-600">Data Export</div>
              </div>
              {selectedFormat === 'json' && (
                <span className="ml-auto text-success-600">✓</span>
              )}
            </button>
          </div>
        </div>

        {/* Quality Settings (PNG only) */}
        {selectedFormat === 'png' && (
          <div className="property-group">
            <label className="property-label">
              Resolution Quality
            </label>
            <select
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="input"
            >
              <option value={1}>1x - Standard</option>
              <option value={2}>2x - High Quality</option>
              <option value={3}>3x - Presentation ⭐</option>
              <option value={4}>4x - Print Ready</option>
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
      </div>
    </div>
  );
}
