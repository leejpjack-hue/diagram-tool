import { useState, useRef } from 'react';
import { parseCSV, getCSVStats } from '../../utils/csvParser';
import type { SimpleCSVRow } from '../../utils/csvParser';

interface ImportPanelProps {
  onImport: (rows: SimpleCSVRow[], filename: string) => void;
}

export function ImportPanel({ onImport }: ImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<SimpleCSVRow[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof getCSVStats> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('That file isn\'t a CSV. Choose a .csv export.');
      return;
    }

    setError(null);
    setFile(selectedFile);

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
      setError('Nothing to import yet — choose a CSV file first.');
      return;
    }

    const filename = file?.name.replace(/\.csv$/i, '') || 'APM Service Map';
    onImport(rows, filename);
    
    // Reset after import
    setFile(null);
    setRows([]);
    setStats(null);
    setError(null);
  };

  return (
    <div className="side-panel">
      {/* Header */}
      <div className="panel-header">
        <h2 className="panel-title">📥 Import from CSV</h2>
      </div>

      {/* Body */}
      <div className="panel-content">
        {/* File Upload */}
        <div className="property-group">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {!file ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition text-center"
            >
              <div className="text-3xl mb-2">📄</div>
              <div className="font-semibold text-gray-700">Choose a CSV file</div>
              <div className="text-xs text-gray-500 mt-1">Service maps from Datadog, Jaeger, or OpenTelemetry</div>
            </button>
          ) : (
            <div className="p-4 bg-green-50 border-2 border-green-300 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✓</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{file.name}</div>
                  {stats && (
                    <div className="text-xs text-green-700">
                      {stats.uniqueServices} services, {stats.totalRows} connections
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border-2 border-red-300 rounded-xl text-red-700 text-sm font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Stats */}
        {stats && rows.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
            <div className="text-sm font-bold text-blue-900 mb-3">What we found</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-lg font-bold text-blue-900">{stats.totalRows}</div>
                <div className="text-xs text-blue-700">Rows</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-lg font-bold text-blue-900">{stats.uniqueServices}</div>
                <div className="text-xs text-blue-700">Services</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-lg font-bold text-blue-900">{stats.uniqueProtocols}</div>
                <div className="text-xs text-blue-700">Protocols</div>
              </div>
            </div>
          </div>
        )}

        {/* Import Button */}
        <button
          onClick={handleImport}
          disabled={rows.length === 0}
          className={`w-full py-3 rounded-xl font-bold transition-all duration-200 ${
            rows.length > 0
              ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white hover:shadow-lg hover:-translate-y-0.5'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Generate diagram
        </button>
      </div>
    </div>
  );
}
