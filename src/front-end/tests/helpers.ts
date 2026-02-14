import { Page, expect } from "@playwright/test";

/**
 * Helper class for common test actions
 */
export class TodoHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to the application and handle authentication
   */
  async navigateAndLogin(user: "alice" | "bob" | "charlie" = "alice") {
    await this.page.goto("/");

    // Wait for the login page to appear
    await this.page.waitForSelector('button:has-text("Sign In")', {
      timeout: 10000,
    });

    // Set up dialog handler for dev mode user selection
    const userMapping: Record<string, string> = {
      alice: "1",
      bob: "2",
      charlie: "3",
    };

    // Listen for the prompt dialog and respond with the user selection
    this.page.once("dialog", async (dialog) => {
      await dialog.accept(userMapping[user]);
    });

    // Click Sign In button
    await this.page.click('button:has-text("Sign In")');

    // Wait for the main app to load
    await this.page.waitForSelector(".todo-table", { timeout: 10000 });
  }

  /**
   * Add a new to-do item using the quick add row
   */
  async addQuickTodo(
    title: string,
    description: string = "",
    assignee: string = "",
  ) {
    // Use the quick add row at the bottom of the table
    await this.page.fill(
      '.quick-add-row input[placeholder="Type to add new item..."]',
      title,
    );

    if (description) {
      await this.page.fill(
        '.quick-add-row input[placeholder="Description..."]',
        description,
      );
      // Small wait to ensure React state updates
      await this.page.waitForTimeout(100);
    }
    if (assignee) {
      await this.page.fill(
        '.quick-add-row input[placeholder="Assignees..."]',
        assignee,
      );
      await this.page.waitForTimeout(100);
    }

    // Press Enter on the last filled field (or title if only title was filled)
    const lastField = assignee
      ? '.quick-add-row input[placeholder="Assignees..."]'
      : description
        ? '.quick-add-row input[placeholder="Description..."]'
        : '.quick-add-row input[placeholder="Type to add new item..."]';

    await this.page.press(lastField, "Enter");

    // Wait for the network request to complete
    await this.page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => {});

    // Additional wait for UI to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Add a new to-do item using the Add New Item button/form
   */
  async addTodoWithForm(data: {
    title: string;
    description?: string;
    assignee?: string;
    isRecurring?: boolean;
    frequency?: "daily" | "weekly" | "monthly";
    interval?: number;
    daysOfWeek?: string[];
    dueDate?: string;
  }) {
    // Click "Add New Item" button
    await this.page.click('button:has-text("Add New Item")');

    // Wait for form to appear
    await this.page.waitForSelector('input[placeholder="Title"]', {
      timeout: 5000,
    });

    // Fill in the form
    await this.page.fill('input[placeholder="Title"]', data.title);

    if (data.description) {
      await this.page.fill(
        'textarea[placeholder="Description"]',
        data.description,
      );
    }

    if (data.assignee) {
      await this.page.fill(
        'input[placeholder="Add assignee (press Enter)"]',
        data.assignee,
      );
      await this.page.press(
        'input[placeholder="Add assignee (press Enter)"]',
        "Enter",
      );
      // Wait for assignee tag to appear in the form
      await this.page.waitForSelector(".assignee-tag", { timeout: 3000 });
    }

    if (data.isRecurring) {
      // Check the recurring checkbox (find by label text nearby)
      await this.page.check(
        'label:has-text("Make this a recurring item") input[type="checkbox"]',
      );

      // Wait for recurring options to appear
      await this.page.waitForSelector("select", { timeout: 5000 });

      if (data.frequency) {
        await this.page.selectOption("select", data.frequency);
      }

      if (data.interval) {
        await this.page.fill(
          'input[type="number"][placeholder="Interval"]',
          data.interval.toString(),
        );
      }

      if (data.daysOfWeek && data.frequency === "weekly") {
        // Wait for days checkboxes to appear
        await this.page.waitForSelector(".day-checkboxes", { timeout: 3000 });
        for (const day of data.daysOfWeek) {
          await this.page.check(
            `input[type="checkbox"]:near(:text("${day.substring(0, 3)}"))`,
          );
        }
      }
    } else if (data.dueDate) {
      await this.page.fill('input[type="date"]', data.dueDate);
    }

    // Submit the form using the submit button (type="submit")
    await this.page.click('button[type="submit"]:has-text("Add")');

    // Wait for the form to close (it should disappear after successful submission)
    await this.page
      .waitForSelector('input[placeholder="Title"]', {
        state: "detached",
        timeout: 10000,
      })
      .catch(() => {});

    // Wait for the network request to complete and UI to update
    await this.page
      .waitForLoadState("networkidle", { timeout: 10000 })
      .catch(() => {});

    // Additional wait for the table to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Edit a to-do item
   */
  async editTodo(
    itemTitle: string,
    newData: {
      title?: string;
      description?: string;
    },
  ) {
    // Find the row with the item - use .first() to avoid strict mode
    const row = this.page
      .locator("tr", { has: this.page.locator(`text="${itemTitle}"`) })
      .first();

    // Click edit button
    await row.locator('button[title="Edit"]').click();

    // Update fields in the form
    if (newData.title) {
      await this.page.fill('input[placeholder="Title"]', newData.title);
    }

    if (newData.description) {
      await this.page.fill(
        'textarea[placeholder="Description"]',
        newData.description,
      );
    }

    // Submit using the submit button
    await this.page.click('button[type="submit"]:has-text("Update")');

    // Wait for update to complete with network idle
    await this.page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => {});
    await this.page.waitForTimeout(300);
  }

  /**
   * Edit a to-do item inline (by clicking on the field)
   */
  async editTodoInline(
    itemTitle: string,
    field: "title" | "description",
    newValue: string,
  ) {
    // Wait for the page to be stable
    await this.page.waitForLoadState("domcontentloaded");

    // Find the row with the item - use a more specific selector
    const row = this.page
      .locator("tr", {
        has: this.page.locator(`.editable:has-text("${itemTitle}")`),
      })
      .first();

    // Find the editable field in the correct column
    const columnClass = field === "title" ? ".col-title" : ".col-description";
    const editableField = row.locator(`${columnClass} .editable`);

    // Wait for element to be visible and ready
    await editableField.waitFor({ state: "visible", timeout: 5000 });

    // Click to edit
    await editableField.click();

    // Wait a moment for the field to become editable
    await this.page.waitForTimeout(200);

    // Clear and type new value
    await editableField.fill(newValue);

    // Press Enter to save
    await editableField.press("Enter");

    // Wait for save to complete
    await this.page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => {});
    await this.page.waitForTimeout(300);
  }

  /**
   * Delete a to-do item
   */
  async deleteTodo(itemTitle: string) {
    // Find the row with the item - use first() to handle duplicates
    const row = this.page
      .locator("tr", {
        has: this.page.locator(`.editable:has-text("${itemTitle}")`),
      })
      .first();

    // Handle the confirmation dialog
    this.page.once("dialog", async (dialog) => {
      await dialog.accept();
    });

    // Click delete button
    await row.locator('button[title="Delete"]').click();

    // Wait for the deletion to complete and element to be removed from DOM
    await this.page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => {});

    // Wait for the specific item to disappear
    await this.page
      .waitForSelector(`text=${itemTitle}`, {
        state: "detached",
        timeout: 5000,
      })
      .catch(() => {});
    await this.page.waitForTimeout(500);
  }

  /**
   * Toggle completion status of a to-do item
   */
  async toggleComplete(itemTitle: string) {
    // Find the row with the item - use .first() to avoid strict mode
    const row = this.page
      .locator("tr", { has: this.page.locator(`text="${itemTitle}"`) })
      .first();

    // Click the checkbox
    await row.locator('input[type="checkbox"]').first().click();

    // Wait for the update with network idle
    await this.page
      .waitForLoadState("networkidle", { timeout: 3000 })
      .catch(() => {});
    await this.page.waitForTimeout(300);
  }

  /**
   * Check if item is completed
   */
  async isCompleted(itemTitle: string): Promise<boolean> {
    const row = this.page
      .locator("tr", { has: this.page.locator(`text="${itemTitle}"`) })
      .first();
    const checkbox = row.locator('input[type="checkbox"]').first();
    return await checkbox.isChecked();
  }

  /**
   * Get all to-do item titles in order
   */
  async getTodoTitles(): Promise<string[]> {
    const titles = await this.page
      .locator(".todo-table tbody tr:not(.quick-add-row) .editable")
      .allTextContents();
    return titles.filter((title) => title.trim() !== "");
  }

  /**
   * Drag and drop to reorder items
   */
  async reorderTodo(fromTitle: string, toTitle: string) {
    const fromRow = this.page
      .locator("tr", { has: this.page.locator(`text="${fromTitle}"`) })
      .first();
    const toRow = this.page
      .locator("tr", { has: this.page.locator(`text="${toTitle}"`) })
      .first();

    await fromRow.hover();
    await this.page.mouse.down();

    const toBox = await toRow.boundingBox();
    if (toBox) {
      await this.page.mouse.move(
        toBox.x + toBox.width / 2,
        toBox.y + toBox.height / 2,
        { steps: 10 },
      );
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
    const row = this.page
      .locator("tr", { has: this.page.locator(`text="${itemTitle}"`) })
      .first();
    const assigneeTags = await row
      .locator(".assignee-tag, .assignee-badge-small")
      .allTextContents();
    // Strip emoji prefix (👤 ) and trim whitespace
    return assigneeTags
      .map((tag) => tag.replace(/^👤\s*/, "").trim())
      .filter((tag) => tag !== "");
  }

  /**
   * Check if item has recurring badge
   */
  async hasRecurringBadge(itemTitle: string): Promise<boolean> {
    const row = this.page
      .locator("tr", { has: this.page.locator(`text="${itemTitle}"`) })
      .first();
    const badge = row.locator("text=🔄");
    return (await badge.count()) > 0;
  }

  /**
   * Edit recurring definition
   */
  async editRecurringDefinition(itemTitle: string) {
    const row = this.page
      .locator("tr", { has: this.page.locator(`text="${itemTitle}"`) })
      .first();

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
    await this.page.waitForLoadState("domcontentloaded");

    // Keep deleting until no items remain, with better timing
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        // Wait for any pending network activity
        await this.page
          .waitForLoadState("networkidle", { timeout: 1000 })
          .catch(() => {});

        // Check how many delete buttons exist
        const deleteButtons = this.page.locator(
          '.todo-table tbody tr:not(.quick-add-row) button[title="Delete"]',
        );
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
        await this.page
          .waitForLoadState("networkidle", { timeout: 2000 })
          .catch(() => {});
        await this.page.waitForTimeout(400);
      } catch (error) {
        // If click failed, the element might be gone already
        await this.page.waitForTimeout(200);
      }
    }

    // Final wait to ensure everything is settled
    await this.page
      .waitForLoadState("networkidle", { timeout: 3000 })
      .catch(() => {});
    await this.page.waitForTimeout(500);
  }
}
