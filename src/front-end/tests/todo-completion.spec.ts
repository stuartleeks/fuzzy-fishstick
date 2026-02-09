import { test, expect } from '@playwright/test';
import { TodoHelpers } from './helpers';

test.describe('To-Do Completion', () => {
  let helpers: TodoHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoHelpers(page);
    await helpers.navigateAndLogin('alice');
    await helpers.clearAllTodos();
  });

  test('should mark a to-do item as completed', async ({ page }) => {
    // Add an item
    await helpers.addQuickTodo('Task to complete', 'Complete this task');
    
    // Verify it's not completed initially
    expect(await helpers.isCompleted('Task to complete')).toBe(false);
    
    // Mark as completed
    await helpers.toggleComplete('Task to complete');
    
    // Verify it's now completed
    expect(await helpers.isCompleted('Task to complete')).toBe(true);
  });

  test('should unmark a completed to-do item', async ({ page }) => {
    // Add an item
    await helpers.addQuickTodo('Task to toggle', 'Toggle this task');
    
    // Mark as completed
    await helpers.toggleComplete('Task to toggle');
    expect(await helpers.isCompleted('Task to toggle')).toBe(true);
    
    // Unmark
    await helpers.toggleComplete('Task to toggle');
    
    // Verify it's not completed
    expect(await helpers.isCompleted('Task to toggle')).toBe(false);
  });

  test('should mark multiple items as completed', async ({ page }) => {
    // Add multiple items
    await helpers.addQuickTodo('First task', 'Task 1');
    await helpers.addQuickTodo('Second task', 'Task 2');
    await helpers.addQuickTodo('Third task', 'Task 3');
    
    // Mark all as completed
    await helpers.toggleComplete('First task');
    await helpers.toggleComplete('Second task');
    await helpers.toggleComplete('Third task');
    
    // Verify all are completed
    expect(await helpers.isCompleted('First task')).toBe(true);
    expect(await helpers.isCompleted('Second task')).toBe(true);
    expect(await helpers.isCompleted('Third task')).toBe(true);
  });
});
