import { useCallback, useEffect, useState } from 'react';
import { useReactFlow } from '@xyflow/react';

interface ZoomControlsProps {
  className?: string;
  showLabel?: boolean;
}

export function ZoomControls({ className = '' }: ZoomControlsProps) {
  const { zoomIn, zoomOut, fitView, getNodes, getZoom } = useReactFlow();
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 200 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 200 });
  }, [zoomOut]);

  const fitCurrentGraph = useCallback(() => {
    const nodes = getNodes();
    void fitView({
      nodes: nodes.length > 0 ? nodes : undefined,
      padding: 0.2,
      duration: 250,
      maxZoom: 1.5,
    });
  }, [fitView, getNodes]);

  useEffect(() => {
    const updateZoom = () => {
      const currentZoom = Math.round(getZoom() * 100);
      setZoom(currentZoom);
    };

    updateZoom();
    const interval = setInterval(updateZoom, 500);
    return () => clearInterval(interval);
  }, [getZoom]);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* Zoom In */}
      <button
        type="button"
        onClick={handleZoomIn}
        className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900"
        title="Zoom In"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
        </svg>
      </button>

      {/* Zoom Percentage */}
      <button
        type="button"
        onClick={fitCurrentGraph}
        data-testid="zoom-reset"
        className="px-2 py-1 min-w-[50px] text-center text-sm font-semibold text-gray-900 hover:bg-gray-200 rounded transition-colors cursor-pointer"
        title="Reset zoom to fit"
        aria-label="Reset zoom to fit"
      >
        {zoom}%
      </button>

      {/* Zoom Out */}
      <button
        type="button"
        onClick={handleZoomOut}
        className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900"
        title="Zoom Out"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM7 10h6" />
        </svg>
      </button>

      {/* Fit to Screen */}
      <button
        type="button"
        onClick={fitCurrentGraph}
        data-testid="fit-to-screen"
        className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900 ml-1"
        title="Fit to Screen"
        aria-label="Fit to Screen"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
    </div>
  );
}
