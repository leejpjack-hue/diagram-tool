/**
 * Gantt Baseline Panel Component
 * 
 * Shows baseline comparison (planned vs actual dates)
 * Similar to MS Project's baseline tracking feature
 */

import React, { useState, useMemo } from 'react';
import { useGanttStore } from './ganttStore';
import { 
  createBaseline, 
  calculateBaselineVariance, 
  type Baseline 
} from './ganttEnhancements';

interface Props {
  onClose?: () => void;
}

// Store baselines in memory (in real app, this would be persisted)
const baselines: Baseline[] = [];

export const GanttBaselinePanel: React.FC<Props> = ({ onClose }) => {
  const { tasks } = useGanttStore();
  const [selectedBaselineId, setSelectedBaselineId] = useState<string | null>(
    baselines.length > 0 ? baselines[baselines.length - 1].id : null
  );
  const [showBaselineBars, setShowBaselineBars] = useState(true);
  const [newBaselineName, setNewBaselineName] = useState('');
  
  const selectedBaseline = useMemo(() => {
    return baselines.find(b => b.id === selectedBaselineId) || null;
  }, [selectedBaselineId]);
  
  const handleCreateBaseline = () => {
    const name = newBaselineName.trim() || `Baseline ${baselines.length + 1}`;
    const baseline = createBaseline(tasks, name);
    baselines.push(baseline);
    setSelectedBaselineId(baseline.id);
    setNewBaselineName('');
  };
  
  const varianceData = useMemo(() => {
    if (!selectedBaseline) return [];
    
    return tasks.map(task => {
      const variance = calculateBaselineVariance(task, selectedBaseline);
      return {
        task,
        variance,
      };
    }).filter(item => item.variance !== null);
  }, [tasks, selectedBaseline]);
  
  const summaryStats = useMemo(() => {
    if (varianceData.length === 0) return null;
    
    const withStartVariance = varianceData.filter(v => v.variance!.startVariance !== 0);
    const withEndVariance = varianceData.filter(v => v.variance!.endVariance !== 0);
    
    const avgStartVariance = varianceData.reduce((sum, v) => sum + v.variance!.startVariance, 0) / varianceData.length;
    const avgEndVariance = varianceData.reduce((sum, v) => sum + v.variance!.endVariance, 0) / varianceData.length;
    
    const delayed = varianceData.filter(v => v.variance!.endVariance > 0).length;
    const ahead = varianceData.filter(v => v.variance!.endVariance < 0).length;
    
    return {
      totalTasks: varianceData.length,
      withStartVariance: withStartVariance.length,
      withEndVariance: withEndVariance.length,
      avgStartVariance,
      avgEndVariance,
      delayed,
      ahead,
    };
  }, [varianceData]);
  
  return (
    <div className="bg-white rounded-lg shadow-lg max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-gray-800">Baseline Comparison</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>
      
      {/* Content */}
      <div className="p-3">
        {/* Create Baseline */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Create New Baseline
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newBaselineName}
              onChange={(e) => setNewBaselineName(e.target.value)}
              placeholder="Baseline name..."
              className="flex-1 px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleCreateBaseline}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
        
        {/* Baseline Selector */}
        {baselines.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Compare Against
            </label>
            <select
              value={selectedBaselineId || ''}
              onChange={(e) => setSelectedBaselineId(e.target.value)}
              className="w-full px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {baselines.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.createdAt.toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        )}
        
        {/* Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="showBaselineBars"
            checked={showBaselineBars}
            onChange={(e) => setShowBaselineBars(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="showBaselineBars" className="text-sm text-gray-700">
            Show baseline bars on chart
          </label>
        </div>
        
        {/* Summary Stats */}
        {summaryStats && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500">Avg Start Variance</div>
                <div className={`font-semibold ${
                  summaryStats.avgStartVariance > 0 ? 'text-red-600' : 
                  summaryStats.avgStartVariance < 0 ? 'text-green-600' : 'text-gray-700'
                }`}>
                  {summaryStats.avgStartVariance > 0 ? '+' : ''}{summaryStats.avgStartVariance.toFixed(1)} days
                </div>
              </div>
              <div>
                <div className="text-gray-500">Avg End Variance</div>
                <div className={`font-semibold ${
                  summaryStats.avgEndVariance > 0 ? 'text-red-600' : 
                  summaryStats.avgEndVariance < 0 ? 'text-green-600' : 'text-gray-700'
                }`}>
                  {summaryStats.avgEndVariance > 0 ? '+' : ''}{summaryStats.avgEndVariance.toFixed(1)} days
                </div>
              </div>
              <div>
                <div className="text-gray-500">Delayed</div>
                <div className="font-semibold text-red-600">{summaryStats.delayed}</div>
              </div>
              <div>
                <div className="text-gray-500">Ahead of Schedule</div>
                <div className="font-semibold text-green-600">{summaryStats.ahead}</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Variance Table */}
        {selectedBaseline && varianceData.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Task</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">Start</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">End</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {varianceData.slice(0, 10).map(({ task, variance }) => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-800">{task.name}</td>
                    <td className={`px-3 py-2 text-center font-medium ${
                      variance!.startVariance > 0 ? 'text-red-600' : 
                      variance!.startVariance < 0 ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {variance!.startVariance > 0 ? '+' : ''}{variance!.startVariance}d
                    </td>
                    <td className={`px-3 py-2 text-center font-medium ${
                      variance!.endVariance > 0 ? 'text-red-600' : 
                      variance!.endVariance < 0 ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {variance!.endVariance > 0 ? '+' : ''}{variance!.endVariance}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {varianceData.length > 10 && (
              <div className="px-3 py-2 bg-gray-50 text-center text-xs text-gray-500">
                +{varianceData.length - 10} more tasks
              </div>
            )}
          </div>
        )}
        
        {baselines.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <div className="mb-2">📊</div>
            <p className="text-sm">No baselines created yet.</p>
            <p className="text-xs mt-1">Create a baseline to track schedule changes.</p>
          </div>
        )}
      </div>
      
      {/* Legend */}
      {showBaselineBars && selectedBaseline && (
        <div className="p-3 border-t bg-gray-50 rounded-b-lg">
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <div className="w-4 h-2 bg-blue-500 rounded" />
              <span>Current</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-2 bg-gray-300 border border-gray-400 rounded" />
              <span>Baseline</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GanttBaselinePanel;
