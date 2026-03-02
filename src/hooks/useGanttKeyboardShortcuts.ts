import { useEffect, useCallback } from 'react';
import { useGanttStore } from '../components/Gantt/ganttStore';

/**
 * Sprint 11: Keyboard shortcuts for Gantt chart
 * 
 * Shortcuts:
 * - Ctrl+Z / Cmd+Z: Undo
 * - Ctrl+Shift+Z / Cmd+Shift+Z: Redo
 * - Ctrl+Y / Cmd+Y: Redo (alternative)
 * - Delete / Backspace: Delete selected task(s)
 * - Escape: Clear selection
 * - Ctrl+A / Cmd+A: Select all tasks
 * - Ctrl+F / Cmd+F: Focus search input
 * - Arrow Up/Down: Navigate between tasks
 * - Arrow Left/Right: Change task dates (when task selected)
 * - + / = : Zoom in
 * - - : Zoom out
 * - 1: Day zoom
 * - 2: Week zoom
 * - 3: Month zoom
 * - C: Toggle critical path
 * - G: Toggle groups expand/collapse
 */
export function useGanttKeyboardShortcuts(
  searchInputRef?: React.RefObject<HTMLInputElement | null>,
  onAddTask?: () => void
) {
  const {
    selectedTaskId,
    selectedTaskIds,
    canUndo,
    canRedo,
    undo,
    redo,
    deleteSelectedTasks,
    clearSelection,
    selectAllTasks,
    setZoomLevel,
    toggleCriticalPath,
    expandAllGroups,
    collapseAllGroups,
    updateTask,
    tasks,
  } = useGanttStore();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
    
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    
    // Undo: Ctrl+Z / Cmd+Z
    if (ctrlKey && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      if (canUndo) {
        undo();
      }
      return;
    }
    
    // Redo: Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y / Cmd+Y
    if ((ctrlKey && e.shiftKey && e.key === 'z') || (ctrlKey && e.key === 'y')) {
      e.preventDefault();
      if (canRedo) {
        redo();
      }
      return;
    }
    
    // Skip remaining shortcuts if in input (except Escape)
    if (isInput) {
      if (e.key === 'Escape') {
        (target as HTMLElement).blur();
      }
      return;
    }
    
    // Delete selected tasks: Delete / Backspace
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedTaskIds.size > 0 || selectedTaskId) {
        e.preventDefault();
        deleteSelectedTasks();
      }
      return;
    }
    
    // Clear selection: Escape
    if (e.key === 'Escape') {
      clearSelection();
      return;
    }
    
    // Select all: Ctrl+A / Cmd+A
    if (ctrlKey && e.key === 'a') {
      e.preventDefault();
      selectAllTasks();
      return;
    }
    
    // Focus search: Ctrl+F / Cmd+F
    if (ctrlKey && e.key === 'f') {
      e.preventDefault();
      searchInputRef?.current?.focus();
      return;
    }
    
    // Zoom controls
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      const levels: ('day' | 'week' | 'month')[] = ['month', 'week', 'day'];
      const current = useGanttStore.getState().zoomLevel;
      const idx = levels.indexOf(current);
      if (idx < levels.length - 1) {
        setZoomLevel(levels[idx + 1]);
      }
      return;
    }
    
    if (e.key === '-') {
      e.preventDefault();
      const levels: ('day' | 'week' | 'month')[] = ['day', 'week', 'month'];
      const current = useGanttStore.getState().zoomLevel;
      const idx = levels.indexOf(current);
      if (idx < levels.length - 1) {
        setZoomLevel(levels[idx + 1]);
      }
      return;
    }
    
    // Direct zoom levels: 1, 2, 3
    if (e.key === '1') {
      setZoomLevel('day');
      return;
    }
    if (e.key === '2') {
      setZoomLevel('week');
      return;
    }
    if (e.key === '3') {
      setZoomLevel('month');
      return;
    }
    
    // Toggle critical path: C
    if (e.key === 'c' || e.key === 'C') {
      toggleCriticalPath();
      return;
    }
    
    // Toggle groups: G
    if (e.key === 'g' || e.key === 'G') {
      const { expandedGroups } = useGanttStore.getState();
      if (expandedGroups.size > 0) {
        collapseAllGroups();
      } else {
        expandAllGroups();
      }
      return;
    }
    
    // Add task: N
    if ((e.key === 'n' || e.key === 'N') && onAddTask) {
      e.preventDefault();
      onAddTask();
      return;
    }
    
    // Arrow navigation for tasks
    if (selectedTaskId) {
      const taskIndex = tasks.findIndex(t => t.id === selectedTaskId);
      const selectedTask = tasks[taskIndex];
      
      if (e.key === 'ArrowUp' && taskIndex > 0) {
        e.preventDefault();
        const prevTask = tasks[taskIndex - 1];
        useGanttStore.getState().setSelectedTask(prevTask.id);
        return;
      }
      
      if (e.key === 'ArrowDown' && taskIndex < tasks.length - 1) {
        e.preventDefault();
        const nextTask = tasks[taskIndex + 1];
        useGanttStore.getState().setSelectedTask(nextTask.id);
        return;
      }
      
      // Arrow Left/Right: Adjust dates by 1 day
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const days = e.key === 'ArrowLeft' ? -1 : 1;
        const newStart = new Date(selectedTask.startDate);
        const newEnd = new Date(selectedTask.endDate);
        newStart.setDate(newStart.getDate() + days);
        newEnd.setDate(newEnd.getDate() + days);
        updateTask(selectedTaskId, {
          startDate: newStart,
          endDate: newEnd,
        });
        return;
      }
    }
  }, [
    canUndo,
    canRedo,
    undo,
    redo,
    deleteSelectedTasks,
    clearSelection,
    selectAllTasks,
    setZoomLevel,
    toggleCriticalPath,
    expandAllGroups,
    collapseAllGroups,
    updateTask,
    selectedTaskId,
    selectedTaskIds,
    tasks,
    searchInputRef,
    onAddTask,
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
  };
}

/**
 * Format shortcuts for display in help tooltip
 */
export const GANTT_SHORTCUTS = [
  { keys: ['Ctrl+Z'], description: 'Undo' },
  { keys: ['Ctrl+Shift+Z'], description: 'Redo' },
  { keys: ['Delete'], description: 'Delete selected' },
  { keys: ['Escape'], description: 'Clear selection' },
  { keys: ['Ctrl+A'], description: 'Select all' },
  { keys: ['Ctrl+F'], description: 'Focus search' },
  { keys: ['↑↓'], description: 'Navigate tasks' },
  { keys: ['←→'], description: 'Move task dates' },
  { keys: ['+/-'], description: 'Zoom in/out' },
  { keys: ['1/2/3'], description: 'Day/Week/Month view' },
  { keys: ['C'], description: 'Toggle critical path' },
  { keys: ['G'], description: 'Toggle groups' },
  { keys: ['N'], description: 'New task' },
];
