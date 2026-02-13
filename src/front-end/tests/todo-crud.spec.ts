import { test, expect } from '@playwright/test';
import { TodoHelpers } from './helpers';

test.describe('To-Do CRUD Operations', () => {
  let helpers: TodoHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoHelpers(page);
    await helpers.navigateAndLogin('alice');
    await helpers.clearAllTodos();
  });

  test('should add a new to-do item using quick add', async ({ page }) => {
    await helpers.addQuickTodo('Buy groceries', 'Milk, bread, eggs');
    
    // Verify the item appears - use .first() to avoid strict mode
    await expect(page.locator('text=Buy groceries').first()).toBeVisible();
    await expect(page.locator('text=Milk, bread, eggs').first()).toBeVisible();
  });

  test('should add a new to-do item using the form', async ({ page }) => {
    await helpers.addTodoWithForm({
      title: 'Complete project',
      description: 'Finish the Playwright tests',
      assignee: 'alice@example.com'
    });
    
    // Verify the item appears with all details - use .first()
    await expect(page.locator('text=Complete project').first()).toBeVisible();
    await expect(page.locator('text=Finish the Playwright tests').first()).toBeVisible();
    
    // Check assignee
    const assignees = await helpers.getAssignees('Complete project');
    expect(assignees).toContain('alice@example.com');
  });

  test('should edit a to-do item using the form', async ({ page }) => {
    // Add an item first
    await helpers.addQuickTodo('Original title', 'Original description');
    
    // Edit the item
    await helpers.editTodo('Original title', {
      title: 'Updated title',
      description: 'Updated description'
    });
    
    // Verify the changes - use .first()
    await expect(page.locator('text=Updated title').first()).toBeVisible();
    await expect(page.locator('text=Updated description').first()).toBeVisible();
    await expect(page.locator('text=Original title')).not.toBeVisible();
  });

  test('should edit a to-do item inline', async ({ page }) => {
    // Add an item first
    await helpers.addQuickTodo('Test item', 'Test description');
    
    // Edit title inline
    await helpers.editTodoInline('Test item', 'title', 'Edited inline title');
    
    // Verify the change - use .first()
    await expect(page.locator('text=Edited inline title').first()).toBeVisible();
    await expect(page.locator('text=Test item')).not.toBeVisible();
  });

  test('should delete a to-do item', async ({ page }) => {
    // Add an item first
    await helpers.addQuickTodo('Item to delete', 'Will be deleted');
    
    // Verify it exists (use first() to avoid strict mode errors)
    await expect(page.locator('text=Item to delete').first()).toBeVisible();
    
    // Delete the item
    await helpers.deleteTodo('Item to delete');
    
    // Verify it's gone
    await expect(page.locator('text=Item to delete')).not.toBeVisible();
  });

  test('should add multiple to-do items', async ({ page }) => {
    await helpers.addQuickTodo('First item', 'Description 1');
    await helpers.addQuickTodo('Second item', 'Description 2');
    await helpers.addQuickTodo('Third item', 'Description 3');
    
    // Verify all items are present - use .first()
    await expect(page.locator('text=First item').first()).toBeVisible();
    await expect(page.locator('text=Second item').first()).toBeVisible();
    await expect(page.locator('text=Third item').first()).toBeVisible();
  });
});
