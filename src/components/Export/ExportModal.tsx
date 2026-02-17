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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-panel-light border-b border-border-gray flex justify-between items-center">
          <h2 className="text-lg font-semibold text-deep-navy">📤 Export Diagram</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Format Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Export Format
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setSelectedFormat('png')}
                className={`p-4 rounded-lg border-2 transition ${
                  selectedFormat === 'png'
                    ? 'border-electric-blue bg-blue-50'
                    : 'border-border-gray hover:border-electric-blue'
                }`}
              >
                <div className="text-2xl mb-2">🖼️</div>
                <div className="font-semibold text-sm">PNG</div>
                <div className="text-xs text-slate-500">Raster Image</div>
              </button>

              <button
                onClick={() => setSelectedFormat('svg')}
                className={`p-4 rounded-lg border-2 transition ${
                  selectedFormat === 'svg'
                    ? 'border-vivid-purple bg-purple-50'
                    : 'border-border-gray hover:border-vivid-purple'
                }`}
              >
                <div className="text-2xl mb-2">📐</div>
                <div className="font-semibold text-sm">SVG</div>
                <div className="text-xs text-slate-500">Vector Image</div>
              </button>

              <button
                onClick={() => setSelectedFormat('json')}
                className={`p-4 rounded-lg border-2 transition ${
                  selectedFormat === 'json'
                    ? 'border-emerald bg-green-50'
                    : 'border-border-gray hover:border-emerald'
                }`}
              >
                <div className="text-2xl mb-2">📄</div>
                <div className="font-semibold text-sm">JSON</div>
                <div className="text-xs text-slate-500">Data Export</div>
              </button>
            </div>
          </div>

          {/* Quality Settings (PNG only) */}
          {selectedFormat === 'png' && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Resolution Quality
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full p-3 border border-border-gray rounded-lg focus:outline-none focus:border-electric-blue"
              >
                <option value={1}>1x - Standard (1x)</option>
                <option value={2}>2x - High Quality (2x)</option>
                <option value={3}>3x - Presentation (3x) ⭐</option>
                <option value={4}>4x - Print Ready (4x)</option>
              </select>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
            {selectedFormat === 'png' && (
              <>
                <div className="font-semibold text-blue-900 mb-1">💡 PNG Format</div>
                <div className="text-blue-700">
                  Best for presentations and documents. {quality}x resolution provides crisp output for large screens.
                </div>
              </>
            )}
            {selectedFormat === 'svg' && (
              <>
                <div className="font-semibold text-purple-900 mb-1">💡 SVG Format</div>
                <div className="text-purple-700">
                  Best for editing in design tools (Figma, Illustrator). Infinitely scalable without quality loss.
                </div>
              </>
            )}
            {selectedFormat === 'json' && (
              <>
                <div className="font-semibold text-green-900 mb-1">💡 JSON Format</div>
                <div className="text-green-700">
                  Export diagram data structure for backup, import, or programmatic use.
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-panel-light border-t border-border-gray flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 border border-border-gray rounded-lg hover:bg-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm font-semibold text-white bg-electric-blue rounded-lg hover:bg-blue-600 transition"
          >
            📥 Download {selectedFormat.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}
