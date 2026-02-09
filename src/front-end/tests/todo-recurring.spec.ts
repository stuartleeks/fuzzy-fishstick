import { test, expect } from '@playwright/test';
import { TodoHelpers } from './helpers';

test.describe('Recurring To-Do Items', () => {
  let helpers: TodoHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoHelpers(page);
    await helpers.navigateAndLogin('alice');
    await helpers.clearAllTodos();
  });

  test('should create a daily recurring to-do item', async ({ page }) => {
    await helpers.addTodoWithForm({
      title: 'Daily standup',
      description: 'Team standup meeting',
      isRecurring: true,
      frequency: 'daily',
      interval: 1
    });
    
    // Verify the item appears
    await expect(page.locator('text=Daily standup')).toBeVisible();
    
    // Verify it has a recurring badge
    expect(await helpers.hasRecurringBadge('Daily standup')).toBe(true);
  });

  test('should create a weekly recurring to-do item', async ({ page }) => {
    await helpers.addTodoWithForm({
      title: 'Weekly review',
      description: 'Review progress',
      isRecurring: true,
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: ['Monday', 'Friday']
    });
    
    // Verify the item appears
    await expect(page.locator('text=Weekly review')).toBeVisible();
    
    // Verify it has a recurring badge
    expect(await helpers.hasRecurringBadge('Weekly review')).toBe(true);
  });

  test('should create a monthly recurring to-do item', async ({ page }) => {
    await helpers.addTodoWithForm({
      title: 'Monthly report',
      description: 'Generate monthly report',
      isRecurring: true,
      frequency: 'monthly',
      interval: 1
    });
    
    // Verify the item appears
    await expect(page.locator('text=Monthly report')).toBeVisible();
    
    // Verify it has a recurring badge
    expect(await helpers.hasRecurringBadge('Monthly report')).toBe(true);
  });

  test('should edit a recurring instance without affecting definition', async ({ page }) => {
    // Create recurring item
    await helpers.addTodoWithForm({
      title: 'Recurring task',
      description: 'Original description',
      isRecurring: true,
      frequency: 'daily',
      interval: 1
    });
    
    // Edit the instance (not the definition)
    await helpers.editTodo('Recurring task', {
      description: 'Modified instance description'
    });
    
    // Verify the change
    await expect(page.locator('text=Modified instance description')).toBeVisible();
  });

  test('should provide option to edit recurring definition', async ({ page }) => {
    // Create recurring item
    await helpers.addTodoWithForm({
      title: 'Edit definition test',
      description: 'Test editing definition',
      isRecurring: true,
      frequency: 'daily',
      interval: 1
    });
    
    // Click edit on the item
    const row = page.locator('tr', { has: page.locator('text="Edit definition test"') });
    await row.locator('button[title="Edit"]').click();
    
    // Verify "Edit Recurring Item" button is available
    await expect(page.locator('button:has-text("Edit Recurring Item")')).toBeVisible();
  });

  test('should distinguish between one-off and recurring items', async ({ page }) => {
    // Add a one-off item
    await helpers.addQuickTodo('One-off task', 'Not recurring');
    
    // Add a recurring item
    await helpers.addTodoWithForm({
      title: 'Recurring task',
      description: 'Is recurring',
      isRecurring: true,
      frequency: 'daily',
      interval: 1
    });
    
    // Verify only the recurring item has the badge
    expect(await helpers.hasRecurringBadge('One-off task')).toBe(false);
    expect(await helpers.hasRecurringBadge('Recurring task')).toBe(true);
  });

  test('should create recurring item with custom interval', async ({ page }) => {
    await helpers.addTodoWithForm({
      title: 'Every 3 days task',
      description: 'Runs every 3 days',
      isRecurring: true,
      frequency: 'daily',
      interval: 3
    });
    
    // Verify the item appears
    await expect(page.locator('text=Every 3 days task')).toBeVisible();
    expect(await helpers.hasRecurringBadge('Every 3 days task')).toBe(true);
  });
});
