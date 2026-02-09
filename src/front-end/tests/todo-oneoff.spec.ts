import { test, expect } from '@playwright/test';
import { TodoHelpers } from './helpers';

test.describe('One-off To-Do Items', () => {
  let helpers: TodoHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoHelpers(page);
    await helpers.navigateAndLogin('alice');
    await helpers.clearAllTodos();
  });

  test('should create a one-off item without due date', async ({ page }) => {
    await helpers.addQuickTodo('Simple task', 'No due date');
    
    // Verify the item appears
    await expect(page.locator('text=Simple task')).toBeVisible();
    
    // Verify it's not marked as recurring
    expect(await helpers.hasRecurringBadge('Simple task')).toBe(false);
  });

  test('should create a one-off item with due date', async ({ page }) => {
    // Calculate tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDateStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    await helpers.addTodoWithForm({
      title: 'Task with due date',
      description: 'Has a deadline',
      dueDate: dueDateStr
    });
    
    // Verify the item appears
    await expect(page.locator('text=Task with due date')).toBeVisible();
    
    // Verify it's not marked as recurring
    expect(await helpers.hasRecurringBadge('Task with due date')).toBe(false);
  });

  test('should edit one-off item to add due date', async ({ page }) => {
    // Create item without due date
    await helpers.addQuickTodo('Add due date later', 'Will add date');
    
    // Calculate tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDateStr = tomorrow.toISOString().split('T')[0];
    
    // Edit to add due date
    const row = page.locator('tr', { has: page.locator('text="Add due date later"') });
    await row.locator('button[title="Edit"]').click();
    
    // Add due date
    await page.fill('input[type="date"]', dueDateStr);
    
    // Update
    await page.click('button:has-text("Update")');
    await page.waitForTimeout(500);
    
    // Verify update was successful
    await expect(page.locator('text=Add due date later')).toBeVisible();
  });

  test('should complete one-off items', async ({ page }) => {
    await helpers.addQuickTodo('Complete me', 'One-off completion');
    
    // Mark as complete
    await helpers.toggleComplete('Complete me');
    
    // Verify completion
    expect(await helpers.isCompleted('Complete me')).toBe(true);
  });

  test('should delete one-off items', async ({ page }) => {
    await helpers.addQuickTodo('Delete me', 'Will be deleted');
    
    // Verify exists
    await expect(page.locator('text=Delete me')).toBeVisible();
    
    // Delete
    await helpers.deleteTodo('Delete me');
    
    // Verify deleted
    await expect(page.locator('text=Delete me')).not.toBeVisible();
  });
});
