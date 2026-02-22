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
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 shrink-0">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">📤 Export Diagram</h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain">
        {/* Format Selection */}
        <div className="mb-4 sm:mb-6">
          <label className="block text-xs font-bold text-gray-700 mb-2 sm:mb-3 uppercase">
            Select Format
          </label>
          <div className="space-y-2">
            <button
              onClick={() => setSelectedFormat('png')}
              className={`w-full p-3 rounded-lg border-2 text-left transition flex items-center gap-3 min-h-[56px] ${
                selectedFormat === 'png'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-blue-300 active:bg-gray-100'
              }`}
            >
              <span className="text-xl sm:text-2xl">🖼️</span>
              <div>
                <div className="font-bold text-gray-900 text-sm sm:text-base">PNG</div>
                <div className="text-xs text-gray-600">Raster Image</div>
              </div>
              {selectedFormat === 'png' && (
                <span className="ml-auto text-blue-600">✓</span>
              )}
            </button>

            <button
              onClick={() => setSelectedFormat('svg')}
              className={`w-full p-3 rounded-lg border-2 text-left transition flex items-center gap-3 min-h-[56px] ${
                selectedFormat === 'svg'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-300 hover:border-purple-300 active:bg-gray-100'
              }`}
            >
              <span className="text-xl sm:text-2xl">📐</span>
              <div>
                <div className="font-bold text-gray-900 text-sm sm:text-base">SVG</div>
                <div className="text-xs text-gray-600">Vector Image</div>
              </div>
              {selectedFormat === 'svg' && (
                <span className="ml-auto text-purple-600">✓</span>
              )}
            </button>

            <button
              onClick={() => setSelectedFormat('json')}
              className={`w-full p-3 rounded-lg border-2 text-left transition flex items-center gap-3 min-h-[56px] ${
                selectedFormat === 'json'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-green-300 active:bg-gray-100'
              }`}
            >
              <span className="text-xl sm:text-2xl">📄</span>
              <div>
                <div className="font-bold text-gray-900 text-sm sm:text-base">JSON</div>
                <div className="text-xs text-gray-600">Data Export</div>
              </div>
              {selectedFormat === 'json' && (
                <span className="ml-auto text-green-600">✓</span>
              )}
            </button>
          </div>
        </div>

        {/* Quality Settings (PNG only) */}
        {selectedFormat === 'png' && (
          <div className="mb-4 sm:mb-6">
            <label className="block text-xs font-bold text-gray-700 mb-2 sm:mb-3 uppercase">
              Resolution Quality
            </label>
            <select
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full p-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 hover:border-gray-300 transition-colors min-h-[44px]"
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
          className="w-full py-3 sm:py-4 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg font-bold hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 min-h-[44px]"
        >
          Download {selectedFormat.toUpperCase()}
        </button>
      </div>
    </div>
  );
}
