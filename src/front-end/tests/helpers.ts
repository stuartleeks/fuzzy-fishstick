import { Page, expect } from '@playwright/test';

/**
 * Helper class for common test actions
 */
export class TodoHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to the application and handle authentication
   */
  async navigateAndLogin(user: 'alice' | 'bob' | 'charlie' = 'alice') {
    await this.page.goto('/');
    
    // Wait for the login page to appear
    await this.page.waitForSelector('button:has-text("Sign In")', { timeout: 10000 });
    
    // Set up dialog handler for dev mode user selection
    const userMapping: Record<string, string> = {
      alice: '1',
      bob: '2',
      charlie: '3'
    };
    
    // Listen for the prompt dialog and respond with the user selection
    this.page.once('dialog', async dialog => {
      await dialog.accept(userMapping[user]);
    });
    
    // Click Sign In button
    await this.page.click('button:has-text("Sign In")');
    
    // Wait for the main app to load
    await this.page.waitForSelector('.todo-table', { timeout: 10000 });
  }

  /**
   * Add a new to-do item using the quick add row
   */
  async addQuickTodo(title: string, description: string = '', assignee: string = '') {
    // Use the quick add row at the bottom of the table
    const titleInput = this.page.locator('.quick-add-row input[placeholder="Type to add new item..."]');
    await titleInput.fill(title);
    
    if (description) {
      await this.page.fill('.quick-add-row input[placeholder="Description..."]', description);
    }
    if (assignee) {
      await this.page.fill('.quick-add-row input[placeholder="Assignees..."]', assignee);
    }
    
    // Press Enter to submit
    await titleInput.press('Enter');
    
    // Wait for the network request to complete
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    
    // Additional wait for UI to update
    await this.page.waitForTimeout(300);
  }

  /**
   * Add a new to-do item using the Add New Item button/form
   */
  async addTodoWithForm(data: {
    title: string;
    description?: string;
    assignee?: string;
    isRecurring?: boolean;
    frequency?: 'daily' | 'weekly' | 'monthly';
    interval?: number;
    daysOfWeek?: string[];
    dueDate?: string;
  }) {
    // Click "Add New Item" button
    await this.page.click('button:has-text("Add New Item")');
    
    // Fill in the form
    await this.page.fill('input[placeholder="Title"]', data.title);
    
    if (data.description) {
      await this.page.fill('textarea[placeholder="Description"]', data.description);
    }
    
    if (data.assignee) {
      await this.page.fill('input[placeholder="Add assignee (press Enter)"]', data.assignee);
      await this.page.press('input[placeholder="Add assignee (press Enter)"]', 'Enter');
    }
    
    if (data.isRecurring) {
      await this.page.check('input[type="checkbox"]:near(:text("Make this a recurring item"))');
      
      if (data.frequency) {
        await this.page.selectOption('select:near(:text("Frequency"))', data.frequency);
      }
      
      if (data.interval) {
        await this.page.fill('input[placeholder="Interval"]', data.interval.toString());
      }
      
      if (data.daysOfWeek && data.frequency === 'weekly') {
        for (const day of data.daysOfWeek) {
          await this.page.check(`input[type="checkbox"][value="${day}"]`);
        }
      }
    } else if (data.dueDate) {
      await this.page.fill('input[type="date"]', data.dueDate);
    }
    
    // Submit the form
    await this.page.click('button:has-text("Add")');
    
    // Wait for the item to appear
    await this.page.waitForSelector(`text=${data.title}`, { timeout: 5000 });
  }

  /**
   * Edit a to-do item
   */
  async editTodo(itemTitle: string, newData: {
    title?: string;
    description?: string;
  }) {
    // Find the row with the item
    const row = this.page.locator('tr', { has: this.page.locator(`text="${itemTitle}"`) });
    
    // Click edit button
    await row.locator('button[title="Edit"]').click();
    
    // Update fields in the form
    if (newData.title) {
      await this.page.fill('input[placeholder="Title"]', newData.title);
    }
    
    if (newData.description) {
      await this.page.fill('textarea[placeholder="Description"]', newData.description);
    }
    
    // Submit
    await this.page.click('button:has-text("Update")');
    
    // Wait for update to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Edit a to-do item inline (by clicking on the field)
   */
  async editTodoInline(itemTitle: string, field: 'title' | 'description', newValue: string) {
    // Find the row with the item - use a more specific selector
    const row = this.page.locator('tr', { has: this.page.locator(`.editable:has-text("${itemTitle}")`) }).first();
    
    // Find the editable field in the correct column
    const columnClass = field === 'title' ? '.col-title' : '.col-description';
    const editableField = row.locator(`${columnClass} .editable`);
    
    // Click to edit
    await editableField.click();
    
    // Clear and type new value
    await editableField.fill(newValue);
    
    // Press Enter to save
    await editableField.press('Enter');
    
    // Wait for save to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Delete a to-do item
   */
  async deleteTodo(itemTitle: string) {
    // Find the row with the item - use first() to handle duplicates
    const row = this.page.locator('tr', { has: this.page.locator(`.editable:has-text("${itemTitle}")`) }).first();
    
    // Click delete button
    await row.locator('button[title="Delete"]').click();
    
    // Wait for the item to disappear
    await this.page.waitForTimeout(500);
  }

  /**
   * Toggle completion status of a to-do item
   */
  async toggleComplete(itemTitle: string) {
    // Find the row with the item
    const row = this.page.locator('tr', { has: this.page.locator(`text="${itemTitle}"`) });
    
    // Click the checkbox
    await row.locator('input[type="checkbox"]').first().click();
    
    // Wait for the update
    await this.page.waitForTimeout(500);
  }

  /**
   * Check if item is completed
   */
  async isCompleted(itemTitle: string): Promise<boolean> {
    const row = this.page.locator('tr', { has: this.page.locator(`text="${itemTitle}"`) });
    const checkbox = row.locator('input[type="checkbox"]').first();
    return await checkbox.isChecked();
  }

  /**
   * Get all to-do item titles in order
   */
  async getTodoTitles(): Promise<string[]> {
    const titles = await this.page.locator('.todo-table tbody tr:not(.quick-add-row) .editable').allTextContents();
    return titles.filter(title => title.trim() !== '');
  }

  /**
   * Drag and drop to reorder items
   */
  async reorderTodo(fromTitle: string, toTitle: string) {
    const fromRow = this.page.locator('tr', { has: this.page.locator(`text="${fromTitle}"`) });
    const toRow = this.page.locator('tr', { has: this.page.locator(`text="${toTitle}"`) });
    
    await fromRow.hover();
    await this.page.mouse.down();
    
    const toBox = await toRow.boundingBox();
    if (toBox) {
      await this.page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 10 });
      await this.page.waitForTimeout(500);
      await this.page.mouse.up();
    }
    
    // Wait for reorder to complete
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get assignees for a to-do item
   */
  async getAssignees(itemTitle: string): Promise<string[]> {
    const row = this.page.locator('tr', { has: this.page.locator(`text="${itemTitle}"`) });
    const assigneeTags = await row.locator('.assignee-tag, .assignee-badge-small').allTextContents();
    return assigneeTags.map(tag => tag.trim()).filter(tag => tag !== '');
  }

  /**
   * Check if item has recurring badge
   */
  async hasRecurringBadge(itemTitle: string): Promise<boolean> {
    const row = this.page.locator('tr', { has: this.page.locator(`text="${itemTitle}"`) });
    const badge = row.locator('text=🔄');
    return await badge.count() > 0;
  }

  /**
   * Edit recurring definition
   */
  async editRecurringDefinition(itemTitle: string) {
    const row = this.page.locator('tr', { has: this.page.locator(`text="${itemTitle}"`) });
    
    // Click edit button first
    await row.locator('button[title="Edit"]').click();
    
    // Click "Edit Recurring Item" button
    await this.page.click('button:has-text("Edit Recurring Item")');
    
    // Wait for the form to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Clear all to-do items (for cleanup)
   */
  async clearAllTodos() {
    // Wait for page to be ready
    await this.page.waitForLoadState('domcontentloaded');
    
    // Keep deleting until no items remain, with better timing
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        // Wait for any pending network activity
        await this.page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => {});
        
        // Check how many delete buttons exist
        const deleteButtons = this.page.locator('.todo-table tbody tr:not(.quick-add-row) button[title="Delete"]');
        const count = await deleteButtons.count();
        
        if (count === 0) {
          // Double-check after a brief wait
          await this.page.waitForTimeout(300);
          const finalCount = await deleteButtons.count();
          if (finalCount === 0) {
            break; // Really done
          }
        }
        
        // Click the first delete button
        await deleteButtons.first().click({ timeout: 3000 });
        
        // Wait for the deletion to process
        await this.page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
        await this.page.waitForTimeout(400);
      } catch (error) {
        // If click failed, the element might be gone already
        await this.page.waitForTimeout(200);
      }
    }
    
    // Final wait to ensure everything is settled
    await this.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }
}
