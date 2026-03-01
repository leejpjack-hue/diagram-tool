import { useState } from 'react';
import type { GanttTask, Dependency } from './types';
import {
  calculateDelayImpact,
  formatDelay,
  getImpactColor,
  getRiskLevelColor,
  type DelayImpactResult,
} from './delayImpactUtils';
import { useToast } from '../../utils/useToast';

interface DelayImpactPanelProps {
  tasks: GanttTask[];
  dependencies: Dependency[];
  onApply?: (result: DelayImpactResult) => void;
}

export function DelayImpactPanel({
  tasks,
  dependencies,
  onApply,
}: DelayImpactPanelProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [delayDays, setDelayDays] = useState<number>(1);
  const [result, setResult] = useState<DelayImpactResult | null>(null);
  const toast = useToast();

  const handleAnalyze = () => {
    if (!selectedTaskId) {
      alert('Please select a task');
      return;
    }

    try {
      const impactResult = calculateDelayImpact(
        selectedTaskId,
        delayDays,
        tasks,
        dependencies
      );
      setResult(impactResult);
    } catch (error) {
      console.error('Error calculating delay impact:', error);
      alert('Error calculating impact. Please try again.');
    }
  };

  const handleApply = () => {
    if (result && onApply) {
      onApply(result);
      
      // Clear visualization after applying
      localStorage.removeItem('delayImpactVisualization');
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'delayImpactVisualization',
        newValue: null,
      }));
    }
  };

  const handleReset = () => {
    setResult(null);
    setDelayDays(1);
    
    // Clear visualization when resetting
    localStorage.removeItem('delayImpactVisualization');
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'delayImpactVisualization',
      newValue: null,
    }));
  };

  const handleVisualize = () => {
    if (result) {
      const vizData = {
        enabled: true,
        result: result,
        timestamp: Date.now(),
      };
      
      // Store in localStorage
      localStorage.setItem('delayImpactVisualization', JSON.stringify(vizData));
      
      // Dispatch custom event to notify GanttCanvas
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'delayImpactVisualization',
        newValue: JSON.stringify(vizData),
      }));
      
      toast.success('Visualization enabled! Check the Gantt chart. Click "🗑️ Clear Viz" to remove.');
    }
  };

  return (
    <div className="p-4 bg-white border-l border-gray-200 h-full overflow-y-auto">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          ⚡ Delay Impact Prediction
        </h3>
        <p className="text-sm text-gray-500">
          Predict how task delays affect your project
        </p>
      </div>

      {/* Task Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Task to Delay
        </label>
        <select
          value={selectedTaskId}
          onChange={(e) => setSelectedTaskId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Choose a task...</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.name} ({task.progress}% complete)
            </option>
          ))}
        </select>
      </div>

      {/* Delay Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Delay (days)
        </label>
        <input
          type="number"
          min="1"
          max="30"
          value={delayDays}
          onChange={(e) => setDelayDays(parseInt(e.target.value) || 1)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={!selectedTaskId}
        className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
      >
        🔍 Analyze Impact
      </button>

      {/* Results */}
      {result && (
        <div className="mt-6 space-y-4">
          {/* Impact Summary Card */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-3">📊 Impact Summary</h4>
            
            <div className="space-y-3">
              {/* Tasks Affected */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tasks Affected</span>
                <span className="font-semibold text-gray-900">
                  {result.affectedTasks.filter(t => t.delayDays > 0).length}
                </span>
              </div>

              {/* Project Delay */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Project Delay</span>
                <span className="font-semibold text-gray-900">
                  {formatDelay(result.projectDelay)}
                </span>
              </div>

              {/* Risk Level */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Risk Level</span>
                <span
                  className="px-2 py-1 rounded text-xs font-bold uppercase"
                  style={{
                    backgroundColor: `${getRiskLevelColor(result.riskLevel)}20`,
                    color: getRiskLevelColor(result.riskLevel),
                  }}
                >
                  {result.riskLevel}
                </span>
              </div>

              {/* Risk Score */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Risk Score</span>
                <span className="font-semibold text-gray-900">
                  {result.riskScore}/100
                </span>
              </div>

              {/* Critical Path Warning */}
              {result.criticalPathImpacted && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  ⚡ <strong>Critical Path Impacted!</strong>
                  <br />
                  This delay will affect your project deadline.
                </div>
              )}
            </div>
          </div>

          {/* Affected Tasks List */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <h4 className="font-semibold text-gray-900 p-4 border-b border-gray-200">
              📋 Affected Tasks
            </h4>
            <div className="max-h-60 overflow-y-auto">
              {result.affectedTasks
                .filter(t => t.delayDays > 0)
                .map((affected) => (
                  <div
                    key={affected.task.id}
                    className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">
                        {affected.task.name}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: `${getImpactColor(affected.impactLevel)}20`,
                          color: getImpactColor(affected.impactLevel),
                        }}
                      >
                        {formatDelay(affected.delayDays)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {affected.impactLevel === 'direct' ? '⚠️ Directly delayed' : '↪️ Indirectly affected'}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleVisualize}
              disabled={!result}
              className="w-full px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              🎨 Visualize on Gantt
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium"
              >
                Reset
              </button>
              <button
                onClick={handleApply}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 font-medium"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
