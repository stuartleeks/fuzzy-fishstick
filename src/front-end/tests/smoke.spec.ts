import { test, expect } from '@playwright/test';
import { TodoHelpers } from './helpers';

test.describe('Smoke Tests', () => {
  test('should load the application and login', async ({ page }) => {
    const helpers = new TodoHelpers(page);
    
    // Navigate and login
    await helpers.navigateAndLogin('alice');
    
    // Verify we're on the main page
    await expect(page.locator('h1')).toContainText('To-Do List');
    
    // Verify the todo table is visible
    await expect(page.locator('.todo-table')).toBeVisible();
  });

  test('should show quick add row', async ({ page }) => {
    const helpers = new TodoHelpers(page);
    await helpers.navigateAndLogin('alice');
    
    // Verify quick add row exists
    await expect(page.locator('.quick-add-row')).toBeVisible();
    await expect(page.locator('input[placeholder="Type to add new item..."]')).toBeVisible();
  });
});
