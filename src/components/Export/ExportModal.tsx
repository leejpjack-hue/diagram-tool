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
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[99998]"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-[99999] bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-fade-in max-h-[95vh] sm:max-h-none overflow-y-auto">
        {/* Header */}
        <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gradient-to-br from-blue-500 to-purple-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-white">Export Diagram</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center text-white hover:bg-opacity-30 transition min-h-[44px] sm:min-h-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-8">
          {/* Format Selection */}
          <div className="mb-6 sm:mb-8">
            <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-3 sm:mb-4 uppercase tracking-wide">
              Select Format
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <button
                onClick={() => setSelectedFormat('png')}
                className={`group p-3 sm:p-6 rounded-xl border-2 transition-all min-h-[80px] sm:min-h-0 ${
                  selectedFormat === 'png'
                    ? 'border-blue-500 bg-blue-50 shadow-lg scale-105 active:scale-100'
                    : 'border-gray-300 hover:border-blue-300 active:bg-gray-100'
                }`}
              >
                <div className={`text-2xl sm:text-4xl mb-1 sm:mb-3 ${selectedFormat === 'png' ? 'transform scale-110' : ''} transition-transform`}>
                  🖼️
                </div>
                <div className="font-bold text-gray-900 mb-0.5 sm:mb-1 text-sm sm:text-base">PNG</div>
                <div className="text-xs text-gray-600 hidden sm:block">Raster Image</div>
                {selectedFormat === 'png' && (
                  <div className="mt-1 sm:mt-2 text-xs text-blue-600 font-semibold">✓</div>
                )}
              </button>

              <button
                onClick={() => setSelectedFormat('svg')}
                className={`group p-3 sm:p-6 rounded-xl border-2 transition-all min-h-[80px] sm:min-h-0 ${
                  selectedFormat === 'svg'
                    ? 'border-purple-500 bg-purple-50 shadow-lg scale-105 active:scale-100'
                    : 'border-gray-300 hover:border-purple-300 active:bg-gray-100'
                }`}
              >
                <div className={`text-2xl sm:text-4xl mb-1 sm:mb-3 ${selectedFormat === 'svg' ? 'transform scale-110' : ''} transition-transform`}>
                  📐
                </div>
                <div className="font-bold text-gray-900 mb-0.5 sm:mb-1 text-sm sm:text-base">SVG</div>
                <div className="text-xs text-gray-600 hidden sm:block">Vector Image</div>
                {selectedFormat === 'svg' && (
                  <div className="mt-1 sm:mt-2 text-xs text-purple-600 font-semibold">✓</div>
                )}
              </button>

              <button
                onClick={() => setSelectedFormat('json')}
                className={`group p-3 sm:p-6 rounded-xl border-2 transition-all min-h-[80px] sm:min-h-0 ${
                  selectedFormat === 'json'
                    ? 'border-green-500 bg-green-50 shadow-lg scale-105 active:scale-100'
                    : 'border-gray-300 hover:border-green-300 active:bg-gray-100'
                }`}
              >
                <div className={`text-2xl sm:text-4xl mb-1 sm:mb-3 ${selectedFormat === 'json' ? 'transform scale-110' : ''} transition-transform`}>
                  📄
                </div>
                <div className="font-bold text-gray-900 mb-0.5 sm:mb-1 text-sm sm:text-base">JSON</div>
                <div className="text-xs text-gray-600 hidden sm:block">Data Export</div>
                {selectedFormat === 'json' && (
                  <div className="mt-1 sm:mt-2 text-xs text-green-600 font-semibold">✓</div>
                )}
              </button>
            </div>
          </div>

          {/* Quality Settings (PNG only) */}
          {selectedFormat === 'png' && (
            <div className="mb-6 sm:mb-8">
              <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-3 sm:mb-4 uppercase tracking-wide">
                Resolution Quality
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full p-3 sm:p-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 font-semibold transition min-h-[44px] sm:min-h-0"
              >
                <option value={1}>1x - Standard Resolution</option>
                <option value={2}>2x - High Quality</option>
                <option value={3}>3x - Presentation Quality ⭐</option>
                <option value={4}>4x - Print Ready</option>
              </select>
            </div>
          )}

          {/* Info Box */}
          <div className={`rounded-xl p-3 sm:p-5 ${
            selectedFormat === 'png' ? 'bg-blue-50 border-2 border-blue-200' :
            selectedFormat === 'svg' ? 'bg-purple-50 border-2 border-purple-200' :
            'bg-green-50 border-2 border-green-200'
          }`}>
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="text-xl sm:text-2xl">💡</div>
              <div>
                <div className={`font-bold mb-1 sm:mb-2 text-sm sm:text-base ${
                  selectedFormat === 'png' ? 'text-blue-900' :
                  selectedFormat === 'svg' ? 'text-purple-900' :
                  'text-green-900'
                }`}>
                  {selectedFormat === 'png' && 'PNG Format'}
                  {selectedFormat === 'svg' && 'SVG Format'}
                  {selectedFormat === 'json' && 'JSON Format'}
                </div>
                <div className={`text-xs sm:text-sm leading-relaxed ${
                  selectedFormat === 'png' ? 'text-blue-800' :
                  selectedFormat === 'svg' ? 'text-purple-800' :
                  'text-green-800'
                }`}>
                  {selectedFormat === 'png' && `Best for presentations and documents. ${quality}x resolution provides crisp output.`}
                  {selectedFormat === 'svg' && 'Best for editing in design tools. Infinitely scalable without quality loss.'}
                  {selectedFormat === 'json' && 'Export diagram data for backup, import, or programmatic use.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-8 py-3 sm:py-6 bg-gray-50 border-t-2 border-gray-200 flex justify-end gap-2 sm:gap-4">
          <button
            onClick={onClose}
            className="px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-bold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition shadow-sm min-h-[44px] sm:min-h-0"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-bold text-white bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl hover:shadow-xl active:scale-95 transition-all duration-200 min-h-[44px] sm:min-h-0"
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
