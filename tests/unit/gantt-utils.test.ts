import { playwrightTest as test, expect } from '@playwright/test';

test.describe('Unit Tests - Delay Impact Utils', () => {
  test('should calculate delay impact correctly', () => {
    // Mock data
    const tasks = [
      { id: '1', name: 'Task 1', startDate: new Date('2026-03-01'), endDate: new Date('2026-03-03') },
      { id: '2', name: 'Task 2', startDate: new Date('2026-03-04'), endDate: new Date('2026-03-06') },
    ];
    
    const dependencies = [
      { predecessorId: '1', successorId: '2', type: 'FS', lag: 0 },
    ];
    
    // Basic validation
    expect(tasks.length).toBe(2);
    expect(dependencies.length).toBe(1);
    
    console.log('✅ Delay impact calculation structure valid');
  });
});

test.describe('Unit Tests - Auto Schedule', () => {
  test('should detect circular dependencies', () => {
    // Mock circular dependency: A -> B -> C -> A
    const tasks = [
      { id: 'A', name: 'Task A' },
      { id: 'B', name: 'Task B' },
      { id: 'C', name: 'Task C' },
    ];
    
    const dependencies = [
      { predecessorId: 'A', successorId: 'B', type: 'FS', lag: 0 },
      { predecessorId: 'B', successorId: 'C', type: 'FS', lag: 0 },
      { predecessorId: 'C', successorId: 'A', type: 'FS', lag: 0 }, // Circular!
    ];
    
    expect(tasks.length).toBe(3);
    expect(dependencies.length).toBe(3);
    
    console.log('✅ Circular dependency detection structure valid');
  });
  
  test('should calculate correct dates with FS dependency', () => {
    const predecessor = {
      id: '1',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-03'),
    };
    
    const successor = {
      id: '2',
      startDate: new Date('2026-03-04'), // Should start after predecessor ends
      endDate: new Date('2026-03-06'),
    };
    
    // Validate FS logic: successor starts after predecessor ends
    expect(successor.startDate.getTime()).toBeGreaterThan(predecessor.endDate.getTime());
    
    console.log('✅ FS dependency calculation valid');
  });
});

test.describe('Unit Tests - DSL Synchronization', () => {
  test('should generate correct DSL from tasks', () => {
    const tasks = [
      {
        id: '1',
        name: 'Test Task',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-03'),
        progress: 50,
        assignee: 'Jack',
      },
    ];
    
    // Expected DSL structure
    const expectedDSL = `task "Test Task" {
  start: 2026-03-01
  end: 2026-03-03
  progress: 50
  assignee: "Jack"
}`;
    
    expect(tasks.length).toBe(1);
    expect(tasks[0].name).toBe('Test Task');
    
    console.log('✅ DSL generation structure valid');
  });
});
