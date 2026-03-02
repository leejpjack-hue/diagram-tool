import { useState } from 'react';
import { GANTT_TEMPLATES, applyTemplate, type GanttTemplate } from '../../data/ganttTemplates';
import { useGanttStore } from './ganttStore';
import type { GanttTask, Dependency } from './types';

interface GanttTemplatePickerProps {
  onClose: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  software: '💻',
  marketing: '📢',
  general: '📋',
  event: '🎉',
  construction: '🏗️',
};

const CATEGORY_COLORS: Record<string, string> = {
  software: 'bg-blue-100 border-blue-300',
  marketing: 'bg-purple-100 border-purple-300',
  general: 'bg-gray-100 border-gray-300',
  event: 'bg-pink-100 border-pink-300',
  construction: 'bg-yellow-100 border-yellow-300',
};

export function GanttTemplatePicker({ onClose }: GanttTemplatePickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<GanttTemplate | null>(null);
  const { setProject, tasks: currentTasks } = useGanttStore();
  
  const categories = [...new Set(GANTT_TEMPLATES.map(t => t.category))];
  
  const filteredTemplates = selectedCategory 
    ? GANTT_TEMPLATES.filter(t => t.category === selectedCategory)
    : GANTT_TEMPLATES;
  
  const handleApplyTemplate = (replace: boolean) => {
    if (!selectedTemplate) return;
    
    const { tasks, dependencies } = applyTemplate(selectedTemplate);
    
    if (replace) {
      setProject(tasks, dependencies);
    } else {
      // Append to existing tasks
      const newTasks: GanttTask[] = [...currentTasks, ...tasks];
      const newDependencies: Dependency[] = [
        ...useGanttStore.getState().dependencies,
        ...dependencies,
      ];
      setProject(newTasks, newDependencies);
    }
    
    onClose();
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Task Templates</h2>
            <p className="text-sm text-gray-500">Choose a template to kickstart your project</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex h-[60vh]">
          {/* Category Sidebar */}
          <div className="w-48 border-r border-gray-200 bg-gray-50 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Categories
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === null 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                All Templates
              </button>
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    selectedCategory === category 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>{CATEGORY_ICONS[category] || '📁'}</span>
                  <span className="capitalize">{category}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Templates Grid */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              {filteredTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedTemplate?.id === template.id
                      ? 'border-blue-500 bg-blue-50'
                      : `border-gray-200 hover:border-gray-300 ${CATEGORY_COLORS[template.category]}`
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{CATEGORY_ICONS[template.category] || '📁'}</span>
                    <h4 className="font-semibold text-gray-900">{template.name}</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {template.tasks.length} tasks
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      {template.dependencies.length} dependencies
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        {selectedTemplate && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{selectedTemplate.name}</span> selected
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApplyTemplate(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Add to Project
              </button>
              <button
                onClick={() => handleApplyTemplate(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Replace Project
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
