import { useState, useEffect } from 'react'
import type { FormData, TodoItem, RecurringItemDefinition } from './types'
import { AssigneeInput } from './AssigneeInput'

// Day name to weekday number mapping for recurring patterns
const DAY_MAP: { [key: string]: number } = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6
}

// Maximum days to search ahead when finding next weekly occurrence
const MAX_DAYS_TO_SEARCH = 14

// Calculate next occurrence date for a recurring item
const calculateNextInstanceDate = (
  currentDueDate: string,
  pattern: { frequency: string; interval: number; daysOfWeek?: string[] }
): Date | null => {
  if (!currentDueDate) return null

  const current = new Date(currentDueDate)
  let nextDate = new Date(current)

  switch (pattern.frequency) {
    case 'daily':
      nextDate.setDate(current.getDate() + pattern.interval)
      break
    case 'weekly':
      if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
        const targetDays = pattern.daysOfWeek.map(d => DAY_MAP[d]).filter(d => d !== undefined)
        for (let i = 1; i <= MAX_DAYS_TO_SEARCH; i++) {
          const testDate = new Date(current)
          testDate.setDate(current.getDate() + i)
          if (targetDays.includes(testDate.getDay())) {
            nextDate = testDate
            break
          }
        }
      } else {
        nextDate.setDate(current.getDate() + (7 * pattern.interval))
      }
      break
    case 'monthly':
      nextDate.setMonth(current.getMonth() + pattern.interval)
      break
  }

  return nextDate
}

export interface TodoItemFormProps {
  formData: FormData
  onFormDataChange: (data: FormData) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  editingId: number | null
  editingRecurringDefId: number | null
  originallyRecurring: boolean
  todos: TodoItem[]
  recurringDefs: RecurringItemDefinition[]
  onEditRecurringDefinition: (todo: TodoItem) => void
  currentUser?: string
  allowedUsers: string[]
}

export function TodoItemForm({
  formData,
  onFormDataChange,
  onSubmit,
  onCancel,
  editingId,
  editingRecurringDefId,
  originallyRecurring,
  todos,
  recurringDefs,
  onEditRecurringDefinition,
  currentUser,
  allowedUsers,
}: TodoItemFormProps) {
  const [maxDate, setMaxDate] = useState<string | undefined>(undefined)

  // Calculate max date for recurring instances
  useEffect(() => {
    if (formData.isRecurring && editingId) {
      const todo = todos.find(t => t.id === editingId)
      if (todo?.recurrenceId) {
        const recDef = recurringDefs.find(d => d.id === todo.recurrenceId)
        if (recDef?.pattern && todo.dueDate) {
          const nextInstance = calculateNextInstanceDate(
            todo.dueDate,
            {
              frequency: recDef.pattern.frequency,
              interval: recDef.pattern.interval,
              daysOfWeek: recDef.pattern.daysOfWeek
            }
          )
          if (nextInstance) {
            const maxDate = new Date(nextInstance)
            maxDate.setDate(maxDate.getDate() - 1)
            setMaxDate(maxDate.toISOString().split('T')[0])
            return
          }
        }
      }
    }
    setMaxDate(undefined)
  }, [formData.isRecurring, editingId, todos, recurringDefs])

  const handleAssigneeChange = (assignees: string[]): void => {
    onFormDataChange({ ...formData, assignedTo: assignees })
  }

  const showRecurringOptions = formData.isRecurring && (editingRecurringDefId || !editingId || !originallyRecurring)
  const showDueDateField = !formData.isRecurring || (editingId !== null && formData.isRecurring && !editingRecurringDefId)

  return (
    <form onSubmit={onSubmit} className="todo-form">
      <input
        type="text"
        placeholder="Title"
        value={formData.title}
        onChange={(e) => onFormDataChange({ ...formData, title: e.target.value })}
        required
        className="input"
      />
      <textarea
        placeholder="Description"
        value={formData.description}
        onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
        className="input textarea"
      />

      <AssigneeInput
        assignedTo={formData.assignedTo}
        currentUser={currentUser}
        allowedUsers={allowedUsers}
        onChange={handleAssigneeChange}
        inputPlaceholder="Add assignee (press Enter)"
        showAddButton={true}
      />

      {/* Recurring checkbox - disabled when editing a recurring instance */}
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={formData.isRecurring}
          onChange={(e) => onFormDataChange({ ...formData, isRecurring: e.target.checked })}
          disabled={editingId !== null && originallyRecurring && !editingRecurringDefId}
        />
        Make this a recurring item
        {editingId !== null && originallyRecurring && !editingRecurringDefId && (
          <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
            (editing instance)
          </span>
        )}
      </label>

      {/* Show recurrence pattern when creating new recurring item, editing recurring definition, or converting non-recurring to recurring */}
      {showRecurringOptions && (
        <div className="recurring-options">
          <select
            value={formData.frequency}
            onChange={(e) => onFormDataChange({ ...formData, frequency: e.target.value as 'daily' | 'weekly' | 'monthly' })}
            className="input"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <input
            type="number"
            min="1"
            placeholder="Interval"
            value={formData.interval}
            onChange={(e) => onFormDataChange({ ...formData, interval: e.target.value })}
            className="input"
          />
        </div>
      )}

      {showRecurringOptions && formData.frequency === 'weekly' && (
        <div className="days-of-week">
          <p className="days-label">Select days:</p>
          <div className="day-checkboxes">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
              <label key={day} className="day-checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.daysOfWeek.includes(day)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onFormDataChange({ ...formData, daysOfWeek: [...formData.daysOfWeek, day] })
                    } else {
                      onFormDataChange({ ...formData, daysOfWeek: formData.daysOfWeek.filter(d => d !== day) })
                    }
                  }}
                />
                {day.substring(0, 3)}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Show due date field for non-recurring items OR when editing a recurring instance */}
      {showDueDateField && (
        <div className="due-date-section">
          <label htmlFor="dueDate" className="input-label">
            {formData.isRecurring ? 'Instance Due Date:' : 'Due Date (optional):'}
          </label>
          <input
            id="dueDate"
            type="date"
            value={formData.dueDate}
            onChange={(e) => onFormDataChange({ ...formData, dueDate: e.target.value })}
            max={maxDate}
            className="input"
          />
          {formData.isRecurring && editingId && (
            <small style={{ display: 'block', marginTop: '0.25rem', color: '#666' }}>
              Must be before the next instance of this recurring item
            </small>
          )}
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {editingId ? 'Update' : 'Add'}
        </button>
        {editingId && (() => {
          const todo = todos.find(t => t.id === editingId)
          return todo?.isRecurring && (
            <button
              type="button"
              onClick={() => onEditRecurringDefinition(todo)}
              className="btn btn-secondary"
            >
              Edit Recurring Item
            </button>
          )
        })()}
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  )
}
