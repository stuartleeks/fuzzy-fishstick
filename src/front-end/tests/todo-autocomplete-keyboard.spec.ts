import { test, expect } from '@playwright/test';
import { TodoHelpers } from './helpers';

test.describe('To-Do Assignee Autocomplete Keyboard Navigation', () => {
  let helpers: TodoHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoHelpers(page);
    await helpers.navigateAndLogin('alice');
    await helpers.clearAllTodos();
  });

  test.describe('Form Autocomplete', () => {
    test('should navigate autocomplete with arrow keys and select with Enter', async ({ page }) => {
      // Click "Add New Item" button
      await page.click('button:has-text("Add New Item")');
      
      // Fill in title
      await page.fill('input[placeholder="Title"]', 'Test task');
      
      // Focus on assignee input and type to trigger autocomplete
      const assigneeInput = page.locator('input[placeholder="Add assignee (press Enter)"]');
      await assigneeInput.fill('example');
      
      // Wait for autocomplete dropdown to appear
      await page.waitForSelector('.autocomplete-dropdown', { timeout: 3000 });
      
      // Verify autocomplete shows users (should be at least bob since alice is logged in)
      const items = page.locator('.autocomplete-item');
      const count = await items.count();
      expect(count).toBeGreaterThan(0);
      
      // Press ArrowDown to select first item
      await assigneeInput.press('ArrowDown');
      
      // Verify first item is selected (has .selected class)
      await expect(items.nth(0)).toHaveClass(/selected/);
      
      // Press ArrowDown to select second item
      await assigneeInput.press('ArrowDown');
      await expect(items.nth(1)).toHaveClass(/selected/);
      
      // Press ArrowUp to go back to first item
      await assigneeInput.press('ArrowUp');
      await expect(items.nth(0)).toHaveClass(/selected/);
      
      // Press Enter to select the first item (alice@example.com)
      await assigneeInput.press('Enter');
      
      // Verify the assignee was added (should show as tag)
      await page.waitForSelector('.assignee-tag:has-text("alice@example.com")', { timeout: 3000 });
      
      // Verify autocomplete is closed
      await expect(page.locator('.autocomplete-dropdown')).not.toBeVisible();
      
      // Verify input is cleared
      await expect(assigneeInput).toHaveValue('');
    });

    test('should select autocomplete item with Tab key', async ({ page }) => {
      // Click "Add New Item" button
      await page.click('button:has-text("Add New Item")');
      
      // Fill in title
      await page.fill('input[placeholder="Title"]', 'Test task');
      
      // Focus on assignee input and type to trigger autocomplete
      const assigneeInput = page.locator('input[placeholder="Add assignee (press Enter)"]');
      await assigneeInput.fill('bob');
      
      // Wait for autocomplete dropdown to appear
      await page.waitForSelector('.autocomplete-dropdown', { timeout: 3000 });
      
      // Press ArrowDown to select first item (should be bob@example.com)
      await assigneeInput.press('ArrowDown');
      
      // Press Tab to select
      await assigneeInput.press('Tab');
      
      // Verify the assignee was added
      await page.waitForSelector('.assignee-tag:has-text("bob@example.com")', { timeout: 3000 });
      
      // Verify autocomplete is closed
      await expect(page.locator('.autocomplete-dropdown')).not.toBeVisible();
    });

    test('should close autocomplete with Escape key', async ({ page }) => {
      // Click "Add New Item" button
      await page.click('button:has-text("Add New Item")');
      
      // Fill in title
      await page.fill('input[placeholder="Title"]', 'Test task');
      
      // Focus on assignee input and type to trigger autocomplete
      const assigneeInput = page.locator('input[placeholder="Add assignee (press Enter)"]');
      await assigneeInput.fill('example');
      
      // Wait for autocomplete dropdown to appear
      await page.waitForSelector('.autocomplete-dropdown', { timeout: 3000 });
      
      // Press Escape to close
      await assigneeInput.press('Escape');
      
      // Verify autocomplete is closed
      await expect(page.locator('.autocomplete-dropdown')).not.toBeVisible();
      
      // Verify input still has value
      await expect(assigneeInput).toHaveValue('example');
    });

    test('should wrap around when using arrow keys', async ({ page }) => {
      // Click "Add New Item" button
      await page.click('button:has-text("Add New Item")');
      
      // Fill in title
      await page.fill('input[placeholder="Title"]', 'Test task');
      
      // Focus on assignee input and type to trigger autocomplete
      const assigneeInput = page.locator('input[placeholder="Add assignee (press Enter)"]');
      await assigneeInput.fill('example');
      
      // Wait for autocomplete dropdown to appear
      await page.waitForSelector('.autocomplete-dropdown', { timeout: 3000 });
      
      const items = page.locator('.autocomplete-item');
      const count = await items.count();
      
      // Press ArrowUp (should select last item because we're at -1)
      await assigneeInput.press('ArrowUp');
      await expect(items.nth(count - 1)).toHaveClass(/selected/);
      
      // Press ArrowDown (should wrap to first item)
      await assigneeInput.press('ArrowDown');
      await expect(items.nth(0)).toHaveClass(/selected/);
    });

    test('should not submit form when pressing Enter to select autocomplete item', async ({ page }) => {
      // Click "Add New Item" button
      await page.click('button:has-text("Add New Item")');
      
      // Fill in title
      await page.fill('input[placeholder="Title"]', 'Test task');
      
      // Focus on assignee input and type to trigger autocomplete
      const assigneeInput = page.locator('input[placeholder="Add assignee (press Enter)"]');
      await assigneeInput.fill('alice');
      
      // Wait for autocomplete dropdown to appear
      await page.waitForSelector('.autocomplete-dropdown', { timeout: 3000 });
      
      // Press ArrowDown to select first item
      await assigneeInput.press('ArrowDown');
      
      // Press Enter to select the item (should NOT submit the form)
      await assigneeInput.press('Enter');
      
      // Verify the form is still visible (not submitted)
      await expect(page.locator('input[placeholder="Title"]')).toBeVisible();
      
      // Verify assignee was added
      await page.waitForSelector('.assignee-tag:has-text("alice@example.com")', { timeout: 3000 });
    });
  });

  test.describe('Inline Edit Autocomplete', () => {
    test('should navigate inline edit autocomplete with keyboard', async ({ page }) => {
      // Create a task first
      await helpers.addQuickTodo('Test task', 'Description');
      
      // Click on the assignee column to edit
      const row = page.locator('tr', { has: page.locator('text="Test task"') }).first();
      await row.locator('.col-assigned .editable').click();
      
      // Wait for inline edit input to appear
      const input = page.locator('.inline-edit-input[placeholder="Add assignee"]');
      await input.waitFor({ state: 'visible', timeout: 3000 });
      
      // Type to trigger autocomplete (use 'bob' since alice is logged in)
      await input.fill('bob');
      
      // Wait for autocomplete dropdown
      await page.waitForSelector('.autocomplete-dropdown', { timeout: 3000 });
      
      // Press ArrowDown to select first item
      await input.press('ArrowDown');
      
      // Verify first item is selected
      const items = page.locator('.autocomplete-item');
      await expect(items.nth(0)).toHaveClass(/selected/);
      
      // Press Enter to select
      await input.press('Enter');
      
      // Verify the assignee was added (should show as small badge)
      await page.waitForSelector('text=👤', { timeout: 3000 });
      
      // Click outside to save
      await page.click('h1');
      
      // Wait for save to complete
      await page.waitForTimeout(500);
      
      // Verify assignee is visible in the table
      const assignees = await helpers.getAssignees('Test task');
      expect(assignees).toContain('bob@example.com');
    });

    test('should close inline autocomplete with Escape without closing edit mode', async ({ page }) => {
      // Create a task first
      await helpers.addQuickTodo('Test task', 'Description');
      
      // Click on the assignee column to edit
      const row = page.locator('tr', { has: page.locator('text="Test task"') }).first();
      await row.locator('.col-assigned .editable').click();
      
      // Wait for inline edit input to appear
      const input = page.locator('.inline-edit-input[placeholder="Add assignee"]');
      await input.waitFor({ state: 'visible', timeout: 3000 });
      
      // Type to trigger autocomplete
      await input.fill('example');
      
      // Wait for autocomplete dropdown
      await page.waitForSelector('.autocomplete-dropdown', { timeout: 3000 });
      
      // Press Escape to close autocomplete
      await input.press('Escape');
      
      // Verify autocomplete is closed
      await expect(page.locator('.autocomplete-dropdown')).not.toBeVisible();
      
      // Verify input is still visible (edit mode not closed)
      await expect(input).toBeVisible();
      
      // Press Escape again to close edit mode
      await input.press('Escape');
      
      // Verify edit mode is closed
      await expect(input).not.toBeVisible();
    });
  });

  test.describe('Quick Add Row Autocomplete', () => {
    test('should navigate quick add autocomplete with keyboard', async ({ page }) => {
      // Focus on quick add assignee input
      const assigneeInput = page.locator('.quick-add-row input[placeholder="Assignees..."]');
      await assigneeInput.fill('bob');
      
      // Wait for autocomplete dropdown
      await page.waitForSelector('.autocomplete-dropdown', { timeout: 3000 });
      
      // Press ArrowDown to select first item
      await assigneeInput.press('ArrowDown');
      
      // Verify first item is selected
      const items = page.locator('.autocomplete-item');
      await expect(items.nth(0)).toHaveClass(/selected/);
      
      // Press Enter to select
      await assigneeInput.press('Enter');
      
      // Verify the assignee was added to the input (should have "bob@example.com, ")
      const value = await assigneeInput.inputValue();
      expect(value).toContain('bob@example.com');
      
      // Verify autocomplete is closed
      await expect(page.locator('.autocomplete-dropdown')).not.toBeVisible();
    });

    test('should support multiple assignees in quick add with keyboard navigation', async ({ page }) => {
      // Focus on quick add assignee input
      const assigneeInput = page.locator('.quick-add-row input[placeholder="Assignees..."]');
      await assigneeInput.fill('alice');
      
      // Wait for autocomplete dropdown
      await page.waitForSelector('.autocomplete-dropdown', { timeout: 3000 });
      
      // Press ArrowDown and Enter to select alice@example.com
      await assigneeInput.press('ArrowDown');
      await assigneeInput.press('Enter');
      
      // Wait for the selection to process before typing more
      await page.waitForTimeout(200);
      
      // Now add another assignee
      await assigneeInput.type('bob');
      
      // Wait for autocomplete dropdown
      await page.waitForSelector('.autocomplete-dropdown', { timeout: 3000 });
      
      // Press ArrowDown and Tab to select bob@example.com
      await assigneeInput.press('ArrowDown');
      await assigneeInput.press('Tab');
      
      // Verify the input has both assignees
      const value = await assigneeInput.inputValue();
      expect(value).toContain('alice@example.com');
      expect(value).toContain('bob@example.com');
    });

    test('should not submit quick add when selecting from autocomplete with Enter', async ({ page }) => {
      // Fill title first
      await page.fill('.quick-add-row input[placeholder="Type to add new item..."]', 'Quick task');
      
      // Focus on quick add assignee input
      const assigneeInput = page.locator('.quick-add-row input[placeholder="Assignees..."]');
      await assigneeInput.fill('bob');
      
      // Wait for autocomplete dropdown
      await page.waitForSelector('.autocomplete-dropdown', { timeout: 3000 });
      
      // Press ArrowDown and Enter to select
      await assigneeInput.press('ArrowDown');
      await assigneeInput.press('Enter');
      
      // Verify the task was NOT created yet (input should still have the title)
      await expect(page.locator('.quick-add-row input[placeholder="Type to add new item..."]')).toHaveValue('Quick task');
      
      // Verify assignee was added to input
      const value = await assigneeInput.inputValue();
      expect(value).toContain('bob@example.com');
    });
  });

  test.describe('Visual Feedback', () => {
    test('should highlight selected item with distinct styling', async ({ page }) => {
      // Click "Add New Item" button
      await page.click('button:has-text("Add New Item")');
      
      // Fill in title
      await page.fill('input[placeholder="Title"]', 'Test task');
      
      // Focus on assignee input and type to trigger autocomplete
      const assigneeInput = page.locator('input[placeholder="Add assignee (press Enter)"]');
      await assigneeInput.fill('example');
      
      // Wait for autocomplete dropdown
      await page.waitForSelector('.autocomplete-dropdown', { timeout: 3000 });
      
      // Press ArrowDown to select first item
      await assigneeInput.press('ArrowDown');
      
      // Check that the selected item has the 'selected' class
      const selectedItem = page.locator('.autocomplete-item.selected');
      await expect(selectedItem).toBeVisible();
      
      // Verify only one item is selected
      const selectedItems = page.locator('.autocomplete-item.selected');
      await expect(selectedItems).toHaveCount(1);
    });
  });
});
