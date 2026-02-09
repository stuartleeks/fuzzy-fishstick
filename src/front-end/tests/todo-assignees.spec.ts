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
    
    // Edit to add another assignee
    const row = page.locator('tr', { has: page.locator('text="Team task"') });
    await row.locator('button[title="Edit"]').click();
    
    // Add another assignee
    await page.fill('input[placeholder="Add assignee (press Enter)"]', 'bob@example.com');
    await page.press('input[placeholder="Add assignee (press Enter)"]', 'Enter');
    
    // Update
    await page.click('button:has-text("Update")');
    await page.waitForTimeout(500);
    
    // Verify both assignees
    const assignees = await helpers.getAssignees('Team task');
    expect(assignees).toContain('alice@example.com');
    expect(assignees).toContain('bob@example.com');
  });

  test('should create a task without assignees', async ({ page }) => {
    await helpers.addQuickTodo('Unassigned task', 'No one assigned');
    
    // Verify the item exists
    await expect(page.locator('text=Unassigned task')).toBeVisible();
    
    // Verify no assignees
    const assignees = await helpers.getAssignees('Unassigned task');
    expect(assignees.length).toBe(0);
  });

  test('should add assignee to existing task', async ({ page }) => {
    // Create task without assignee
    await helpers.addQuickTodo('Task without assignee', 'Add assignee later');
    
    // Edit to add assignee
    const row = page.locator('tr', { has: page.locator('text="Task without assignee"') });
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
