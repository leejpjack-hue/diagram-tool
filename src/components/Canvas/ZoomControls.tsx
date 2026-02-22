import { useCallback, useEffect, useState } from 'react';
import { useReactFlow } from '@xyflow/react';

interface ZoomControlsProps {
  className?: string;
  showLabel?: boolean;
}

export function ZoomControls({ className = '', showLabel = false }: ZoomControlsProps) {
  const { zoomIn, zoomOut, fitView, getZoom, setViewport } = useReactFlow();
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 200 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 200 });
  }, [zoomOut]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  const handleResetZoom = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 });
  }, [setViewport]);

  // Update zoom state periodically
  useEffect(() => {
    const updateZoom = () => {
      setZoom(Math.round(getZoom() * 100));
    };
    
    // Initial update
    updateZoom();
    
    // Update every 200ms
    const interval = setInterval(updateZoom, 200);
    return () => clearInterval(interval);
  }, [getZoom]);

  // Listen for keyboard shortcut events
  useEffect(() => {
    const handleZoomInEvent = () => handleZoomIn();
    const handleZoomOutEvent = () => handleZoomOut();
    const handleFitViewEvent = () => handleFitView();

    window.addEventListener('diagram-zoom-in', handleZoomInEvent);
    window.addEventListener('diagram-zoom-out', handleZoomOutEvent);
    window.addEventListener('diagram-zoom-fit', handleFitViewEvent);

    return () => {
      window.removeEventListener('diagram-zoom-in', handleZoomInEvent);
      window.removeEventListener('diagram-zoom-out', handleZoomOutEvent);
      window.removeEventListener('diagram-zoom-fit', handleFitViewEvent);
    };
  }, [handleZoomIn, handleZoomOut, handleFitView]);

  return (
    <div className={`flex items-center gap-1 mobile:gap-2 ${className}`}>
      {showLabel && (
        <span className="text-gray-500 text-sm mr-1 hidden mobile:inline">Zoom:</span>
      )}
      
      <button
        onClick={handleZoomOut}
        className="p-1.5 mobile:p-3 min-h-[28px] mobile:min-h-[44px] min-w-[28px] mobile:min-w-[44px] rounded hover:bg-gray-200 active:bg-gray-300 transition-colors text-gray-600 hover:text-gray-900 flex items-center justify-center"
        title="Zoom Out (-)"
        aria-label="Zoom Out"
      >
        <svg className="w-4 h-4 mobile:w-5 mobile:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
        </svg>
      </button>
      
      <button
        onClick={handleResetZoom}
        className="px-2 py-1 mobile:px-3 mobile:py-2 min-w-[50px] mobile:min-w-[60px] min-h-[28px] mobile:min-h-[44px] text-center text-sm mobile:text-base font-semibold text-gray-900 hover:bg-gray-200 active:bg-gray-300 rounded transition-colors cursor-pointer"
        title="Reset to 100%"
        aria-label={`Zoom level ${zoom}%, tap to reset`}
      >
        {zoom}%
      </button>
      
      <button
        onClick={handleZoomIn}
        className="p-1.5 mobile:p-3 min-h-[28px] mobile:min-h-[44px] min-w-[28px] mobile:min-w-[44px] rounded hover:bg-gray-200 active:bg-gray-300 transition-colors text-gray-600 hover:text-gray-900 flex items-center justify-center"
        title="Zoom In (+)"
        aria-label="Zoom In"
      >
        <svg className="w-4 h-4 mobile:w-5 mobile:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
        </svg>
      </button>
      
      <button
        onClick={handleFitView}
        className="p-1.5 mobile:p-3 min-h-[28px] mobile:min-h-[44px] min-w-[28px] mobile:min-w-[44px] rounded hover:bg-gray-200 active:bg-gray-300 transition-colors text-gray-600 hover:text-gray-900 ml-1 mobile:ml-2 flex items-center justify-center"
        title="Fit to Screen (0)"
        aria-label="Fit to Screen"
      >
        <svg className="w-4 h-4 mobile:w-5 mobile:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
        </svg>
      </button>
    </div>
  );
}
