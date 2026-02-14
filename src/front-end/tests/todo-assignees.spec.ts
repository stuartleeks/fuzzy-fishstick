import { test, expect } from '@playwright/test';
import { TodoHelpers } from './helpers';

test.describe('To-Do Assignees', () => {
  let helpers: TodoHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoHelpers(page);
    await helpers.navigateAndLogin('alice');
    await helpers.clearAllTodos();
  });

  test('should assign a to-do item to a person', async ({ page }) => {
    await helpers.addTodoWithForm({
      title: 'Assigned task',
      description: 'This task is assigned',
      assignee: 'alice@example.com'
    });
    
    // Wait for the assignee badge to appear
    await page.waitForSelector('.assignee-badge-small:has-text("alice@example.com")', { timeout: 5000 });
    
    // Verify the assignee appears
    const assignees = await helpers.getAssignees('Assigned task');
    expect(assignees).toContain('alice@example.com');
  });

  test('should assign a to-do item to multiple people', async ({ page }) => {
    // Add an item with one assignee
    await helpers.addTodoWithForm({
      title: 'Team task',
      description: 'Multiple assignees',
      assignee: 'alice@example.com'
    });
    
    // Wait for item with assignee to appear
    await page.waitForSelector('.assignee-badge-small:has-text("alice@example.com")', { timeout: 5000 });
    
    // Edit to add another assignee - use .first() to avoid strict mode
    const row = page.locator('tr', { has: page.locator('text="Team task"') }).first();
    await row.locator('button[title="Edit"]').click();
    
    // Add another assignee
    await page.fill('input[placeholder="Add assignee (press Enter)"]', 'bob@example.com');
    await page.press('input[placeholder="Add assignee (press Enter)"]', 'Enter');
    
    // Update
    await page.click('button:has-text("Update")');
    
    // Wait for update to complete
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    
    // Verify both assignees
    const assignees = await helpers.getAssignees('Team task');
    expect(assignees).toContain('alice@example.com');
    expect(assignees).toContain('bob@example.com');
  });

  test('should create a task without assignees', async ({ page }) => {
    await helpers.addQuickTodo('Unassigned task', 'No one assigned');
    
    // Verify the item exists - use .first() to avoid strict mode
    await expect(page.locator('text=Unassigned task').first()).toBeVisible();
    
    // Verify no assignees
    const assignees = await helpers.getAssignees('Unassigned task');
    expect(assignees.length).toBe(0);
  });

  test('should add assignee to existing task', async ({ page }) => {
    // Create task without assignee
    await helpers.addQuickTodo('Task without assignee', 'Add assignee later');
    
    // Edit to add assignee - use .first() to avoid strict mode
    const row = page.locator('tr', { has: page.locator('text="Task without assignee"') }).first();
    await row.locator('button[title="Edit"]').click();
    
    await page.fill('input[placeholder="Add assignee (press Enter)"]', 'charlie@example.com');
    await page.press('input[placeholder="Add assignee (press Enter)"]', 'Enter');
    
    await page.click('button:has-text("Update")');
    await page.waitForTimeout(500);
    
    // Verify assignee was added
    const assignees = await helpers.getAssignees('Task without assignee');
    expect(assignees).toContain('charlie@example.com');
  });
});
