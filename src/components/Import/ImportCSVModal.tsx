import { useState, useRef } from 'react';
import { parseCSV, getCSVStats } from '../../utils/csvParser';
import type { SimpleCSVRow } from '../../utils/csvParser';

interface ImportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: SimpleCSVRow[], filename: string) => void;
}

export function ImportCSVModal({ isOpen, onClose, onImport }: ImportCSVModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<SimpleCSVRow[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof getCSVStats> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setError(null);
    setFile(selectedFile);

    // Read and parse file
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsedRows = parseCSV(content);
        const csvStats = getCSVStats(parsedRows);

        setRows(parsedRows);
        setStats(csvStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse CSV');
        setRows([]);
        setStats(null);
      }
    };

    reader.onerror = () => {
      setError('Failed to read file');
      setRows([]);
      setStats(null);
    };

    reader.readAsText(selectedFile);
  };

  const handleImport = () => {
    if (rows.length === 0) {
      setError('No data to import');
      return;
    }

    const filename = file?.name.replace(/\.csv$/i, '') || 'APM Service Map';
    onImport(rows, filename);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setRows([]);
    setStats(null);
    setError(null);
    onClose();
  };

  const protocolColors: Record<string, string> = {
    'http': 'bg-blue-100 text-blue-900',
    'https': 'bg-blue-100 text-blue-900',
    'rest': 'bg-blue-100 text-blue-900',
    'grpc': 'bg-purple-100 text-purple-900',
    'postgresql': 'bg-pink-100 text-pink-900',
    'mysql': 'bg-pink-100 text-pink-900',
    'mongodb': 'bg-pink-100 text-pink-900',
    'redis': 'bg-pink-100 text-pink-900',
    'kafka': 'bg-green-100 text-green-900',
    'rabbitmq': 'bg-green-100 text-green-900',
  };

  const getProtocolColor = (protocol: string) => {
    const normalized = protocol.toLowerCase().trim();
    return protocolColors[normalized] || 'bg-gray-100 text-gray-900';
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[99998]"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
        {/* Header */}
        <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gradient-to-r from-emerald-500 to-teal-600 border-b-2 border-emerald-600 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h2 className="text-lg sm:text-2xl font-bold text-white">Import APM Data</h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center text-white hover:bg-opacity-30 transition min-h-[44px] sm:min-h-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
          {/* File Upload */}
          {!file ? (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 sm:p-12 text-center hover:border-blue-500 hover:bg-blue-50 transition cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer"
              >
                <div className="text-3xl sm:text-5xl mb-4">📄</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-4 sm:px-6 py-2.5 sm:py-2 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg active:scale-95 transition-all duration-200 min-h-[44px] sm:min-h-0"
                >
                  Choose CSV File
                </button>
                <p className="text-gray-500 text-sm mt-4">
                  or drag and drop a CSV file here
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* File Info */}
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 border-2 border-green-300 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="text-2xl sm:text-3xl">📄</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{file.name}</div>
                    <div className="text-sm text-green-700">
                      {stats ? `${stats.uniqueServices} services, ${stats.totalRows} connections` : 'Processing...'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setRows([]);
                      setStats(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border-2 border-red-300 rounded-xl">
                  <div className="flex items-center gap-2 text-red-900">
                    <span className="text-xl">⚠️</span>
                    <span className="font-semibold">{error}</span>
                  </div>
                </div>
              )}

              {/* Preview */}
              {stats && rows.length > 0 && (
                <>
                  <div className="mb-4">
                    <div className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                      PREVIEW (FIRST 5 ROWS)
                    </div>
                    <div className="border-2 border-gray-300 rounded-xl overflow-x-auto">
                      <table className="w-full min-w-[400px]">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-2 sm:p-3 text-xs font-semibold text-gray-600 border-b-2 border-gray-300">
                              Source → Target
                            </th>
                            <th className="text-left p-2 sm:p-3 text-xs font-semibold text-gray-600 border-b-2 border-gray-300">
                              Protocol
                            </th>
                            <th className="text-left p-2 sm:p-3 text-xs font-semibold text-gray-600 border-b-2 border-gray-300">
                              Operation
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(0, 5).map((row, i) => (
                            <tr key={i} className="hover:bg-blue-50">
                              <td className="p-2 sm:p-3 text-xs sm:text-sm text-gray-900 border-b border-gray-200">
                                {row.source_service} → {row.target_service}
                              </td>
                              <td className="p-2 sm:p-3 border-b border-gray-200">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${getProtocolColor(row.protocol)}`}>
                                  {row.protocol}
                                </span>
                              </td>
                              <td className="p-2 sm:p-3 text-xs sm:text-sm text-gray-600 border-b border-gray-200">
                                {row.operation || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-blue-900 font-semibold mb-2 text-sm sm:text-base">
                      <span>📊</span>
                      <span>Import Summary</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
                      <div>
                        <div className="text-blue-700">Total Rows</div>
                        <div className="text-xl sm:text-2xl font-bold text-blue-900">{stats.totalRows}</div>
                      </div>
                      <div>
                        <div className="text-blue-700">Services</div>
                        <div className="text-xl sm:text-2xl font-bold text-blue-900">{stats.uniqueServices}</div>
                      </div>
                      <div>
                        <div className="text-blue-700">Protocols</div>
                        <div className="text-xl sm:text-2xl font-bold text-blue-900">{stats.uniqueProtocols}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t-2 border-gray-200 flex justify-end gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2.5 sm:py-2 text-sm font-semibold text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-white active:bg-gray-100 transition min-h-[44px] sm:min-h-0"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={rows.length === 0}
            className={`px-4 py-2.5 sm:py-2 text-sm font-semibold rounded-lg transition-all duration-200 min-h-[44px] sm:min-h-0 ${
              rows.length > 0
                ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white hover:shadow-lg active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            🔄 Generate Diagram
          </button>
        </div>
      </div>
    </div>
  );
}
