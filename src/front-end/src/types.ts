// Type definitions for the To-Do List application

export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly'
  interval: number
  daysOfWeek?: string[]
}

export interface TodoItem {
  id: number
  title: string
  description: string
  assignedTo: string[]
  completed: boolean
  position: number
  isRecurring: boolean
  recurrenceId?: number
  dueDate?: string
  completedAt?: string
  createdAt: string
}

export interface RecurringItemDefinition {
  id: number
  title: string
  description: string
  assignedTo: string[]
  pattern: RecurrencePattern
  startDate: string
  createdAt: string
}

export interface FormData {
  title: string
  description: string
  assignedTo: string[]
  currentAssignee: string
  isRecurring: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  interval: string
  daysOfWeek: string[]
  dueDate: string // Format: YYYY-MM-DD for date input, converted to ISO 8601 for API
}

export interface NewRowData {
  title: string
  description: string
  assignedTo: string
}

export interface ReorderItem {
  id: number
  position: number
}
