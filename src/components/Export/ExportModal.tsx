import { useState } from 'react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'png' | 'svg' | 'json', quality?: number) => void;
}

export function ExportModal({ isOpen, onClose, onExport }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<'png' | 'svg' | 'json'>('png');
  const [quality, setQuality] = useState(3);

  if (!isOpen) return null;

  const handleExport = () => {
    onExport(selectedFormat, quality);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black"
        style={{ opacity: 0.7 }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-blue-500 to-purple-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white">Export Diagram</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center text-white hover:bg-opacity-30 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-8">
          {/* Format Selection */}
          <div className="mb-8">
            <label className="block text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide">
              Select Format
            </label>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setSelectedFormat('png')}
                className={`group p-6 rounded-xl border-2 transition-all ${
                  selectedFormat === 'png'
                    ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                    : 'border-gray-300 hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div className={`text-4xl mb-3 ${selectedFormat === 'png' ? 'transform scale-110' : ''} transition-transform`}>
                  🖼️
                </div>
                <div className="font-bold text-gray-900 mb-1">PNG</div>
                <div className="text-xs text-gray-600">Raster Image</div>
                {selectedFormat === 'png' && (
                  <div className="mt-2 text-xs text-blue-600 font-semibold">✓ Selected</div>
                )}
              </button>

              <button
                onClick={() => setSelectedFormat('svg')}
                className={`group p-6 rounded-xl border-2 transition-all ${
                  selectedFormat === 'svg'
                    ? 'border-purple-500 bg-purple-50 shadow-lg scale-105'
                    : 'border-gray-300 hover:border-purple-300 hover:shadow-md'
                }`}
              >
                <div className={`text-4xl mb-3 ${selectedFormat === 'svg' ? 'transform scale-110' : ''} transition-transform`}>
                  📐
                </div>
                <div className="font-bold text-gray-900 mb-1">SVG</div>
                <div className="text-xs text-gray-600">Vector Image</div>
                {selectedFormat === 'svg' && (
                  <div className="mt-2 text-xs text-purple-600 font-semibold">✓ Selected</div>
                )}
              </button>

              <button
                onClick={() => setSelectedFormat('json')}
                className={`group p-6 rounded-xl border-2 transition-all ${
                  selectedFormat === 'json'
                    ? 'border-green-500 bg-green-50 shadow-lg scale-105'
                    : 'border-gray-300 hover:border-green-300 hover:shadow-md'
                }`}
              >
                <div className={`text-4xl mb-3 ${selectedFormat === 'json' ? 'transform scale-110' : ''} transition-transform`}>
                  📄
                </div>
                <div className="font-bold text-gray-900 mb-1">JSON</div>
                <div className="text-xs text-gray-600">Data Export</div>
                {selectedFormat === 'json' && (
                  <div className="mt-2 text-xs text-green-600 font-semibold">✓ Selected</div>
                )}
              </button>
            </div>
          </div>

          {/* Quality Settings (PNG only) */}
          {selectedFormat === 'png' && (
            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide">
                Resolution Quality
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full p-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 font-semibold transition"
              >
                <option value={1}>1x - Standard Resolution</option>
                <option value={2}>2x - High Quality</option>
                <option value={3}>3x - Presentation Quality ⭐</option>
                <option value={4}>4x - Print Ready</option>
              </select>
            </div>
          )}

          {/* Info Box */}
          <div className={`rounded-xl p-5 ${
            selectedFormat === 'png' ? 'bg-blue-50 border-2 border-blue-200' :
            selectedFormat === 'svg' ? 'bg-purple-50 border-2 border-purple-200' :
            'bg-green-50 border-2 border-green-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div>
                <div className={`font-bold mb-2 ${
                  selectedFormat === 'png' ? 'text-blue-900' :
                  selectedFormat === 'svg' ? 'text-purple-900' :
                  'text-green-900'
                }`}>
                  {selectedFormat === 'png' && 'PNG Format'}
                  {selectedFormat === 'svg' && 'SVG Format'}
                  {selectedFormat === 'json' && 'JSON Format'}
                </div>
                <div className={`text-sm leading-relaxed ${
                  selectedFormat === 'png' ? 'text-blue-800' :
                  selectedFormat === 'svg' ? 'text-purple-800' :
                  'text-green-800'
                }`}>
                  {selectedFormat === 'png' && `Best for presentations and documents. ${quality}x resolution provides crisp output for large screens and printed materials.`}
                  {selectedFormat === 'svg' && 'Best for editing in design tools (Figma, Illustrator, Inkscape). Infinitely scalable without quality loss. Perfect for documentation.'}
                  {selectedFormat === 'json' && 'Export diagram data structure for backup, import capability, or programmatic use. Includes all nodes, edges, and metadata.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-50 border-t-2 border-gray-200 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-3 text-sm font-bold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl hover:from-blue-600 hover:to-blue-700 transition shadow-lg hover:shadow-xl"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download {selectedFormat.toUpperCase()}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
