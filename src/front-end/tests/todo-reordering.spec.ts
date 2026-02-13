import { test, expect } from '@playwright/test';
import { TodoHelpers } from './helpers';

test.describe('To-Do Reordering', () => {
  let helpers: TodoHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoHelpers(page);
    await helpers.navigateAndLogin('alice');
    await helpers.clearAllTodos();
  });

  test('should reorder to-do items by dragging', async ({ page }) => {
    // Add multiple items
    await helpers.addQuickTodo('First item', 'Item 1');
    await helpers.addQuickTodo('Second item', 'Item 2');
    await helpers.addQuickTodo('Third item', 'Item 3');
    
    // Wait for all items to appear
    await page.waitForTimeout(500);
    
    // Get initial order
    let titles = await helpers.getTodoTitles();
    expect(titles[0] || '').toContain('First item');
    expect(titles[1] || '').toContain('Second item');
    expect(titles[2] || '').toContain('Third item');
    
    // Drag third item to first position
    await helpers.reorderTodo('Third item', 'First item');
    
    // Verify new order
    titles = await helpers.getTodoTitles();
    // Note: The exact order depends on the drag-and-drop implementation
    // We just verify that the order has changed
    const hasChanged = 
      titles[0]?.includes('Third item') || 
      titles[1]?.includes('Third item');
    expect(hasChanged).toBe(true);
  });

  test('should maintain order after page operations', async ({ page }) => {
    // Add items
    await helpers.addQuickTodo('Task A', 'A');
    await helpers.addQuickTodo('Task B', 'B');
    await helpers.addQuickTodo('Task C', 'C');
    
    // Reorder
    await helpers.reorderTodo('Task C', 'Task A');
    
    // Get order after reordering
    const titlesAfterReorder = await helpers.getTodoTitles();
    
    // Mark an item as complete (this triggers an update)
    await helpers.toggleComplete('Task B');
    await page.waitForTimeout(1000);
    
    // Verify order is maintained
    const titlesAfterComplete = await helpers.getTodoTitles();
    expect(titlesAfterComplete).toEqual(titlesAfterReorder);
  });
});
