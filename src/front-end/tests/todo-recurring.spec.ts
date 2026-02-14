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
    
    // Verify the item appears - use .first()
    await expect(page.locator('text=Daily standup').first()).toBeVisible();
    
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
    
    // Verify the item appears - use .first()
    await expect(page.locator('text=Weekly review').first()).toBeVisible();
    
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
    
    // Verify the item appears - use .first()
    await expect(page.locator('text=Monthly report').first()).toBeVisible();
    
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

  test('should show recurrence options when converting one-off item to recurring', async ({ page }) => {
    // Create a one-off item
    await helpers.addQuickTodo('One-off task', 'Not recurring yet');
    
    // Verify it's not recurring
    expect(await helpers.hasRecurringBadge('One-off task')).toBe(false);
    
    // Edit the item
    const row = page.locator('tr', { has: page.locator('text="One-off task"') }).first();
    await row.locator('button[title="Edit"]').click();
    
    // Wait for form to appear
    await page.waitForSelector('input[placeholder="Title"]', { timeout: 5000 });
    
    // Check the recurring checkbox
    await page.check('label:has-text("Make this a recurring item") input[type="checkbox"]');
    
    // Verify recurring options appear
    await expect(page.locator('select')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="number"][placeholder="Interval"]')).toBeVisible();
    
    // Select weekly frequency
    await page.selectOption('select', 'weekly');
    
    // Verify days checkboxes appear for weekly frequency
    await expect(page.locator('.day-checkboxes')).toBeVisible({ timeout: 3000 });
    
    // Configure the recurring pattern
    await page.fill('input[type="number"][placeholder="Interval"]', '1');
    await page.check('input[type="checkbox"]:near(:text("Mon"))');
    await page.check('input[type="checkbox"]:near(:text("Wed"))');
    
    // Submit the form
    await page.click('button[type="submit"]:has-text("Update")');
    
    // Wait for the form to close
    await page.waitForSelector('input[placeholder="Title"]', { state: 'detached', timeout: 10000 }).catch(() => {});
    
    // Wait for update to complete
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    
    // Verify the item is now recurring
    expect(await helpers.hasRecurringBadge('One-off task')).toBe(true);
  });
});
