import { test, expect } from "@playwright/test";
import { TodoHelpers } from "./helpers";

test.describe("To-Do Item Filtering", () => {
  let helpers: TodoHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoHelpers(page);
    await helpers.navigateAndLogin("alice");
    await helpers.clearAllTodos();
  });

  test("should show filter controls", async ({ page }) => {
    // Check that filter section is visible
    await expect(page.locator(".filter-section")).toBeVisible();
    await expect(page.locator('h3:has-text("Filter Items")')).toBeVisible();

    // Toggle the filter section to ensure controls are visible
    await page.click(".btn-collapse");
    await expect(page.locator(".filter-controls")).toBeVisible();

    // Check assignee filter controls
    await expect(
      page.locator('button:has-text("Assigned to me")'),
    ).toBeVisible();
    await expect(page.locator(".filter-select")).toBeVisible();
    await expect(page.locator('text="Include unassigned"')).toBeVisible();

    // Check due date filter controls
    await expect(page.locator('text="🔴 Overdue"')).toBeVisible();
    await expect(page.locator('text="📅 Today"')).toBeVisible();
    await expect(page.locator('text="⏭️ Tomorrow"')).toBeVisible();
    await expect(page.locator('text="⏩ Future"')).toBeVisible();

    // Check clear filters button
    await expect(
      page.locator('button:has-text("Clear All Filters")'),
    ).toBeVisible();
  });

  test("should filter by 'Assigned to me'", async ({ page }) => {
    // Add tasks for different users
    await helpers.addTodoWithForm({
      title: "Task for Alice",
      assignedTo: ["alice@example.com"],
    });
    await helpers.addTodoWithForm({
      title: "Task for Bob",
      assignedTo: ["bob@example.com"],
    });

    // Initially, both tasks should be visible
    await expect(page.locator("text=Task for Alice")).toBeVisible();
    await expect(page.locator("text=Task for Bob")).toBeVisible();

    // Click "Assigned to me" button
    await page.click('button:has-text("Assigned to me")');

    // Wait for filtering to apply
    await page.waitForLoadState("networkidle");

    // Only Alice's task should be visible
    await expect(page.locator("text=Task for Alice")).toBeVisible();
    await expect(page.locator("text=Task for Bob")).not.toBeVisible();

    // Button should be active
    await expect(page.locator('button:has-text("Assigned to me")')).toHaveClass(
      /active/,
    );

    // Dropdown should show alice@example.com selected
    const select = page.locator(".filter-select");
    await expect(select).toHaveValue("alice@example.com");
  });

  test("should filter by specific user from dropdown", async ({ page }) => {
    // Add tasks for different users
    await helpers.addTodoWithForm({
      title: "Task for Alice",
      assignedTo: ["alice@example.com"],
    });
    await helpers.addTodoWithForm({
      title: "Task for Bob",
      assignedTo: ["bob@example.com"],
    });

    // Select Bob from dropdown
    await page.selectOption(".filter-select", "bob@example.com");
    await page.waitForLoadState("networkidle");

    // Only Bob's task should be visible
    await expect(page.locator("text=Task for Alice")).not.toBeVisible();
    await expect(page.locator("text=Task for Bob")).toBeVisible();
  });

  test("should filter by 'Include unassigned' checkbox", async ({ page }) => {
    // Add tasks with and without assignees
    await helpers.addTodoWithForm({
      title: "Assigned Task",
      assignedTo: ["alice@example.com"],
    });
    await helpers.addTodoWithForm({
      title: "Unassigned Task",
      assignedTo: [],
    });

    // Initially, both tasks should be visible
    await expect(page.locator("text=Assigned Task")).toBeVisible();
    await expect(page.locator("text=Unassigned Task")).toBeVisible();

    // Uncheck "Include unassigned"
    await page.uncheck(
      'input[type="checkbox"]:near(:text("Include unassigned"))',
    );
    await page.waitForLoadState("networkidle");

    // Only assigned task should be visible
    await expect(page.locator("text=Assigned Task")).toBeVisible();
    await expect(page.locator("text=Unassigned Task")).not.toBeVisible();
  });

  test("should filter by 'Today' due date", async ({ page }) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Add tasks with different due dates
    await helpers.addTodoWithForm({
      title: "Task Due Today",
      dueDate: today.toISOString().split("T")[0],
    });
    await helpers.addTodoWithForm({
      title: "Task Due Tomorrow",
      dueDate: tomorrow.toISOString().split("T")[0],
    });

    // Check "Today" filter
    await page.check('input[type="checkbox"]:near(:text("📅 Today"))');
    await page.waitForLoadState("networkidle");

    // Only today's task should be visible
    await expect(page.locator("text=Task Due Today")).toBeVisible();
    await expect(page.locator("text=Task Due Tomorrow")).not.toBeVisible();
  });

  test("should filter by 'Tomorrow' due date", async ({ page }) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Add tasks with different due dates
    await helpers.addTodoWithForm({
      title: "Task Due Today",
      dueDate: today.toISOString().split("T")[0],
    });
    await helpers.addTodoWithForm({
      title: "Task Due Tomorrow",
      dueDate: tomorrow.toISOString().split("T")[0],
    });

    // Check "Tomorrow" filter
    await page.check('input[type="checkbox"]:near(:text("⏭️ Tomorrow"))');
    await page.waitForLoadState("networkidle");

    // Only tomorrow's task should be visible
    await expect(page.locator("text=Task Due Today")).not.toBeVisible();
    await expect(page.locator("text=Task Due Tomorrow")).toBeVisible();
  });

  test("should filter by multiple due date categories", async ({ page }) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const future = new Date(today);
    future.setDate(future.getDate() + 5);

    // Add tasks with different due dates
    await helpers.addTodoWithForm({
      title: "Task Due Today",
      dueDate: today.toISOString().split("T")[0],
    });
    await helpers.addTodoWithForm({
      title: "Task Due Tomorrow",
      dueDate: tomorrow.toISOString().split("T")[0],
    });
    await helpers.addTodoWithForm({
      title: "Task Due in Future",
      dueDate: future.toISOString().split("T")[0],
    });

    // Check both "Today" and "Tomorrow" filters
    await page.check('input[type="checkbox"]:near(:text("📅 Today"))');
    await page.check('input[type="checkbox"]:near(:text("⏭️ Tomorrow"))');
    await page.waitForLoadState("networkidle");

    // Today's and tomorrow's tasks should be visible, but not future
    await expect(page.locator("text=Task Due Today")).toBeVisible();
    await expect(page.locator("text=Task Due Tomorrow")).toBeVisible();
    await expect(page.locator("text=Task Due in Future")).not.toBeVisible();
  });

  test("should filter by 'Overdue' due date", async ({ page }) => {
    const today = new Date();
    const overdue = new Date(today);
    overdue.setDate(overdue.getDate() - 2);

    // Add tasks with different due dates
    await helpers.addTodoWithForm({
      title: "Overdue Task",
      dueDate: overdue.toISOString().split("T")[0],
    });
    await helpers.addTodoWithForm({
      title: "Task Due Today",
      dueDate: today.toISOString().split("T")[0],
    });

    // Check "Overdue" filter
    await page.check('input[type="checkbox"]:near(:text("🔴 Overdue"))');
    await page.waitForLoadState("networkidle");

    // Only overdue task should be visible
    await expect(page.locator("text=Overdue Task")).toBeVisible();
    await expect(page.locator("text=Task Due Today")).not.toBeVisible();
  });

  test("should filter by 'Future' due date", async ({ page }) => {
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + 5);

    // Add tasks with different due dates
    await helpers.addTodoWithForm({
      title: "Task Due Today",
      dueDate: today.toISOString().split("T")[0],
    });
    await helpers.addTodoWithForm({
      title: "Task Due in Future",
      dueDate: future.toISOString().split("T")[0],
    });

    // Check "Future" filter
    await page.check('input[type="checkbox"]:near(:text("⏩ Future"))');
    await page.waitForLoadState("networkidle");

    // Only future task should be visible
    await expect(page.locator("text=Task Due Today")).not.toBeVisible();
    await expect(page.locator("text=Task Due in Future")).toBeVisible();
  });

  test("should combine assignee and due date filters", async ({ page }) => {
    const today = new Date();

    // Add tasks with different assignees and due dates
    await helpers.addTodoWithForm({
      title: "Alice Task Today",
      assignedTo: ["alice@example.com"],
      dueDate: today.toISOString().split("T")[0],
    });
    await helpers.addTodoWithForm({
      title: "Bob Task Today",
      assignedTo: ["bob@example.com"],
      dueDate: today.toISOString().split("T")[0],
    });
    await helpers.addTodoWithForm({
      title: "Alice Task No Date",
      assignedTo: ["alice@example.com"],
    });

    // Filter by "Assigned to me" and "Today"
    await page.click('button:has-text("Assigned to me")');
    await page.check('input[type="checkbox"]:near(:text("📅 Today"))');
    await page.waitForLoadState("networkidle");

    // Only Alice's task due today should be visible
    await expect(page.locator("text=Alice Task Today")).toBeVisible();
    await expect(page.locator("text=Bob Task Today")).not.toBeVisible();
    await expect(page.locator("text=Alice Task No Date")).not.toBeVisible();
  });

  test("should clear all filters", async ({ page }) => {
    const today = new Date();

    // Add tasks
    await helpers.addTodoWithForm({
      title: "Task for Alice",
      assignedTo: ["alice@example.com"],
      dueDate: today.toISOString().split("T")[0],
    });
    await helpers.addTodoWithForm({
      title: "Task for Bob",
      assignedTo: ["bob@example.com"],
    });

    // Apply filters
    await page.click('button:has-text("Assigned to me")');
    await page.check('input[type="checkbox"]:near(:text("📅 Today"))');
    await page.waitForLoadState("networkidle");

    // Only Alice's task should be visible
    await expect(page.locator("text=Task for Alice")).toBeVisible();
    await expect(page.locator("text=Task for Bob")).not.toBeVisible();

    // Clear filters
    await page.click('button:has-text("Clear All Filters")');
    await page.waitForLoadState("networkidle");

    // Both tasks should be visible again
    await expect(page.locator("text=Task for Alice")).toBeVisible();
    await expect(page.locator("text=Task for Bob")).toBeVisible();

    // Filters should be reset
    const select = page.locator(".filter-select");
    await expect(select).toHaveValue("");
    await expect(
      page.locator('input[type="checkbox"]:near(:text("Include unassigned"))'),
    ).toBeChecked();
    await expect(
      page.locator('input[type="checkbox"]:near(:text("📅 Today"))'),
    ).not.toBeChecked();
  });

  test("should hide items without due dates when date filter is active", async ({
    page,
  }) => {
    const today = new Date();

    // Add tasks with and without due dates
    await helpers.addTodoWithForm({
      title: "Task with Date",
      dueDate: today.toISOString().split("T")[0],
    });
    await helpers.addTodoWithForm({
      title: "Task without Date",
    });

    // Initially both should be visible
    await expect(page.locator("text=Task with Date")).toBeVisible();
    await expect(page.locator("text=Task without Date")).toBeVisible();

    // Check "Today" filter
    await page.check('input[type="checkbox"]:near(:text("📅 Today"))');
    await page.waitForLoadState("networkidle");

    // Only task with date should be visible
    await expect(page.locator("text=Task with Date")).toBeVisible();
    await expect(page.locator("text=Task without Date")).not.toBeVisible();
  });

  test("should collapse and expand filter section", async ({ page }) => {
    // Filter controls should be visible initially
    await expect(page.locator(".filter-controls")).toBeVisible();

    // Find and click the collapse button
    const collapseBtn = page.locator(".btn-collapse");
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click();

    // Filter controls should be hidden
    await expect(page.locator(".filter-controls")).not.toBeVisible();

    // Button should show down arrow
    await expect(collapseBtn).toHaveText("▼");

    // Click again to expand
    await collapseBtn.click();

    // Filter controls should be visible again
    await expect(page.locator(".filter-controls")).toBeVisible();

    // Button should show up arrow
    await expect(collapseBtn).toHaveText("▲");
  });

  test("should persist filter state across page reloads", async ({ page }) => {
    const today = new Date();

    // Add a test task
    await helpers.addTodoWithForm({
      title: "Task for Alice",
      assignedTo: ["alice@example.com"],
      dueDate: today.toISOString().split("T")[0],
    });

    // Apply filters
    await page.click('button:has-text("Assigned to me")');
    await page.check('input[type="checkbox"]:near(:text("📅 Today"))');
    await page.waitForLoadState("networkidle");

    // Collapse the filter section
    await page.click(".btn-collapse");
    await expect(page.locator(".filter-controls")).not.toBeVisible();

    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Filters should still be applied
    const select = page.locator(".filter-select");
    await expect(select).toHaveValue("alice@example.com");
    await expect(
      page.locator('input[type="checkbox"]:near(:text("📅 Today"))'),
    ).toBeChecked();

    // Filter section should still be collapsed
    await expect(page.locator(".filter-controls")).not.toBeVisible();
    await expect(page.locator(".btn-collapse")).toHaveText("▼");

    // Task should still be visible (filters are applied)
    await expect(page.locator("text=Task for Alice")).toBeVisible();
  });
});
