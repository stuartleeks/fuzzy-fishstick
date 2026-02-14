import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import axios from 'axios'
import './App.css'
import type { TodoItem, RecurringItemDefinition, FormData, NewRowData, ReorderItem, FilterState } from './types'
import { useAuth } from './AuthProvider'
import LoginPage from './LoginPage'

const API_BASE = '/api'
const FILTER_STORAGE_KEY = 'todoapp-filter-state'

// Helper functions for localStorage
const saveFiltersToStorage = (filters: FilterState): void => {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
  } catch (error) {
    console.error('Failed to save filters to localStorage:', error)
  }
}

const loadFiltersFromStorage = (): FilterState | null => {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as FilterState
    }
  } catch (error) {
    console.error('Failed to load filters from localStorage:', error)
  }
  return null
}

function App() {
  const { isAuthenticated, user, logout, getAccessToken } = useAuth()
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [recurringDefs, setRecurringDefs] = useState<RecurringItemDefinition[]>([])
  const [isAdding, setIsAdding] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingRecurringDefId, setEditingRecurringDefId] = useState<number | null>(null)
  const [originallyRecurring, setOriginallyRecurring] = useState<boolean>(false) // Track if item was originally recurring
  const [inlineEditingId, setInlineEditingId] = useState<number | null>(null)
  const [inlineEditField, setInlineEditField] = useState<'title' | 'description' | 'assignedTo' | 'dueDate' | null>(null)
  const [inlineAssignees, setInlineAssignees] = useState<string[]>([]) // Track assignees during inline editing
  const [inlineAssigneeInput, setInlineAssigneeInput] = useState<string>('') // Input for new assignee
  const [allowedUsers, setAllowedUsers] = useState<string[]>([]) // List of allowed users for autocompletion
  const [showFormAutocomplete, setShowFormAutocomplete] = useState<boolean>(false)
  const [showInlineAutocomplete, setShowInlineAutocomplete] = useState<boolean>(false)
  const [showQuickAddAutocomplete, setShowQuickAddAutocomplete] = useState<boolean>(false)
  const [newRowData, setNewRowData] = useState<NewRowData>({
    title: '',
    description: '',
    assignedTo: '',
  })
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    assignedTo: [],
    currentAssignee: '',
    isRecurring: false,
    frequency: 'daily',
    interval: '1',
    daysOfWeek: [],
    dueDate: '',
  })
  const [filterState, setFilterState] = useState<FilterState>(() => {
    // Try to load saved filters from localStorage
    const savedFilters = loadFiltersFromStorage()
    if (savedFilters) {
      return savedFilters
    }
    // Default filter state
    return {
      assignedToUser: '',
      showUnassigned: true,
      dueDateFilters: {
        overdue: false,
        today: false,
        tomorrow: false,
        future: false,
      },
      isCollapsed: false,
    }
  })

  // Save filters to localStorage whenever they change
  useEffect(() => {
    saveFiltersToStorage(filterState)
  }, [filterState])

  // Setup axios interceptor to add auth token
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      async (config) => {
        const token = await getAccessToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    return () => {
      axios.interceptors.request.eject(interceptor)
    }
  }, [getAccessToken])

  // Load todos and recurring definitions when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadTodos()
      loadRecurringDefs()
      loadAllowedUsers()
    }
  }, [isAuthenticated])

  const loadTodos = async (): Promise<void> => {
    try {
      const response = await axios.get<TodoItem[]>(`${API_BASE}/todos`)
      setTodos(response.data || [])
    } catch (error) {
      console.error('Error loading todos:', error)
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Token expired or invalid - logout
        logout()
      }
    }
  }

  const loadRecurringDefs = async (): Promise<void> => {
    try {
      const response = await axios.get<RecurringItemDefinition[]>(`${API_BASE}/recurring`)
      setRecurringDefs(response.data || [])
    } catch (error) {
      console.error('Error loading recurring definitions:', error)
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Token expired or invalid - logout
        logout()
      }
    }
  }

  const loadAllowedUsers = async (): Promise<void> => {
    try {
      const response = await axios.get(`${API_BASE}/auth/config`)
      if (response.data.allowedUsers) {
        setAllowedUsers(response.data.allowedUsers)
      }
    } catch (error) {
      console.error('Error loading allowed users:', error)
    }
  }

  // Helper function to get filtered autocomplete suggestions
  const getAutocompleteSuggestions = (input: string, existingAssignees: string[] = []): string[] => {
    if (!input.trim()) return []
    const lowerInput = input.toLowerCase()
    return allowedUsers.filter(
      user => user.toLowerCase().includes(lowerInput) && !existingAssignees.includes(user)
    )
  }

  // Helper function to determine if a date is overdue, today, tomorrow, or future
  const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24
  
  const getDateCategory = (dateStr?: string): 'overdue' | 'today' | 'tomorrow' | 'future' | 'none' => {
    if (!dateStr) return 'none'
    
    // Use date-only comparison to avoid timezone issues
    // Extract date parts from the ISO date string (YYYY-MM-DD)
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
    const itemDate = new Date(year, month - 1, day) // month is 0-indexed
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    const diffMs = itemDate.getTime() - today.getTime()
    const diffDays = Math.floor(diffMs / MILLISECONDS_PER_DAY)
    
    if (diffDays < 0) return 'overdue'
    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'tomorrow'
    return 'future'
  }

  // Filter todos based on current filter state
  const getFilteredTodos = (): TodoItem[] => {
    return todos.filter(todo => {
      // Filter by assignee
      if (filterState.assignedToUser) {
        const hasAssignee = todo.assignedTo.includes(filterState.assignedToUser)
        if (!hasAssignee) return false
      }

      // Filter by unassigned
      if (!filterState.showUnassigned && todo.assignedTo.length === 0) {
        return false
      }

      // Filter by due date categories
      const { overdue, today, tomorrow, future } = filterState.dueDateFilters
      const anyDateFilterActive = overdue || today || tomorrow || future
      
      if (anyDateFilterActive) {
        const category = getDateCategory(todo.dueDate)
        
        // If no due date and any date filter is active, exclude the item
        if (category === 'none') return false
        
        // Check if the item's category matches any active filter
        const matchesFilter = 
          (overdue && category === 'overdue') ||
          (today && category === 'today') ||
          (tomorrow && category === 'tomorrow') ||
          (future && category === 'future')
        
        if (!matchesFilter) return false
      }

      return true
    })
  }

  // Quick filter for "Assigned to me"
  const handleAssignedToMe = () => {
    if (user?.email) {
      setFilterState({
        ...filterState,
        assignedToUser: user.email,
      })
    }
  }

  // Clear all filters
  const handleClearFilters = () => {
    setFilterState({
      assignedToUser: '',
      showUnassigned: true,
      dueDateFilters: {
        overdue: false,
        today: false,
        tomorrow: false,
        future: false,
      },
      isCollapsed: filterState.isCollapsed, // Keep the collapsed state
    })
  }

  // Toggle filter section collapsed state
  const toggleFilterCollapsed = () => {
    setFilterState({
      ...filterState,
      isCollapsed: !filterState.isCollapsed,
    })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()

    try {
      if (editingRecurringDefId) {
        // Update recurring definition
        await axios.put(`${API_BASE}/recurring/${editingRecurringDefId}`, {
          title: formData.title,
          description: formData.description,
          assignedTo: formData.assignedTo,
          pattern: {
            frequency: formData.frequency,
            interval: parseInt(formData.interval) || 1,
            daysOfWeek: formData.daysOfWeek,
          },
        })
        await loadRecurringDefs()
        await loadTodos() // Reload todos as they may be affected
      } else if (editingId) {
        // Check if we need to convert to/from recurring
        const currentTodo = todos.find(t => t.id === editingId)

        if (formData.isRecurring && !currentTodo?.isRecurring) {
          // Convert to recurring
          await axios.post(`${API_BASE}/todos/${editingId}/convert-recurring`, {
            toRecurring: true,
            pattern: {
              frequency: formData.frequency,
              interval: parseInt(formData.interval) || 1,
              daysOfWeek: formData.daysOfWeek,
            },
          })
        } else if (!formData.isRecurring && currentTodo?.isRecurring) {
          // Convert from recurring to one-off
          await axios.post(`${API_BASE}/todos/${editingId}/convert-recurring`, {
            toRecurring: false,
          })
          // Update with due date if provided
          if (formData.dueDate) {
            await axios.put(`${API_BASE}/todos/${editingId}`, {
              title: formData.title,
              description: formData.description,
              assignedTo: formData.assignedTo,
              completed: false,
              dueDate: new Date(formData.dueDate).toISOString(),
            })
          }
        } else {
          // Regular update (includes recurring instance due date edits)
          await axios.put(`${API_BASE}/todos/${editingId}`, {
            title: formData.title,
            description: formData.description,
            assignedTo: formData.assignedTo,
            completed: false,
            dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
          })
        }
      } else if (formData.isRecurring) {
        // Create new recurring item
        await axios.post(`${API_BASE}/recurring`, {
          title: formData.title,
          description: formData.description,
          assignedTo: formData.assignedTo,
          pattern: {
            frequency: formData.frequency,
            interval: parseInt(formData.interval) || 1,
            daysOfWeek: formData.daysOfWeek,
          },
          startDate: new Date().toISOString(),
        })
        await loadRecurringDefs()
      } else {
        // Create new one-off todo
        await axios.post(`${API_BASE}/todos`, {
          title: formData.title,
          description: formData.description,
          assignedTo: formData.assignedTo,
          completed: false,
          dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        })
      }

      await loadTodos()
      resetForm()
    } catch (error) {
      console.error('Error saving todo:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      assignedTo: [],
      currentAssignee: '',
      isRecurring: false,
      frequency: 'daily',
      interval: '1',
      daysOfWeek: [],
      dueDate: '',
    })
    setIsAdding(false)
    setEditingId(null)
    setEditingRecurringDefId(null)
    setOriginallyRecurring(false)
  }

  // Day name to weekday number mapping for recurring patterns
  const DAY_MAP: { [key: string]: number } = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6
  }

  // Maximum days to search ahead when finding next weekly occurrence
  const MAX_DAYS_TO_SEARCH = 14 // 2 weeks to handle all weekly patterns

  // Delay before saving inline edits on blur (allows remove button clicks to process first)
  const INLINE_EDIT_BLUR_DELAY = 200 // milliseconds

  // Calculate next occurrence date for a recurring item (used for validation)
  const calculateNextInstanceDate = (currentDueDate: string, pattern: { frequency: string; interval: number; daysOfWeek?: string[] }): Date | null => {
    if (!currentDueDate) return null

    const current = new Date(currentDueDate)
    let nextDate = new Date(current)

    switch (pattern.frequency) {
      case 'daily':
        nextDate.setDate(current.getDate() + pattern.interval)
        break
      case 'weekly':
        if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
          // For weekly with specific days, find the next matching day
          const targetDays = pattern.daysOfWeek.map(d => DAY_MAP[d]).filter(d => d !== undefined)

          // Find next occurrence
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

  const handleEdit = async (todo: TodoItem): Promise<void> => {
    // Track if the item was originally recurring
    setOriginallyRecurring(todo.isRecurring || false)

    // If editing a recurring item, fetch its definition to get pattern details
    let frequency: 'daily' | 'weekly' | 'monthly' = 'daily'
    let interval: string = '1'
    let daysOfWeek: string[] = []

    if (todo.isRecurring && todo.recurrenceId) {
      try {
        const recDef = recurringDefs.find(def => def.id === todo.recurrenceId)
        if (recDef?.pattern) {
          frequency = recDef.pattern.frequency || 'daily'
          interval = String(recDef.pattern.interval || 1)
          daysOfWeek = recDef.pattern.daysOfWeek || []
        }
      } catch (error) {
        console.error('Error loading recurrence pattern:', error)
      }
    }

    // Format due date for input field (YYYY-MM-DD)
    function formatDueDateForInput(dueDate?: string): string {
      if (!dueDate) return ''
      const date = new Date(dueDate)
      if (isNaN(date.getTime())) {
        console.error('Invalid due date:', dueDate)
        return ''
      }
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }
    const dueDate: string = formatDueDateForInput(todo.dueDate)

    setFormData({
      title: todo.title,
      description: todo.description,
      assignedTo: Array.isArray(todo.assignedTo) ? [...todo.assignedTo] : [],
      currentAssignee: '',
      isRecurring: todo.isRecurring || false,
      frequency: frequency,
      interval: interval,
      daysOfWeek: daysOfWeek,
      dueDate: dueDate,
    })
    setEditingId(todo.id)
    setIsAdding(true)
  }

  const handleEditRecurringDefinition = async (todo: TodoItem): Promise<void> => {
    if (!todo.recurrenceId) return

    try {
      const recDef = recurringDefs.find(def => def.id === todo.recurrenceId)
      if (!recDef) return

      // Load the recurring definition for editing
      setFormData({
        title: recDef.title,
        description: recDef.description,
        assignedTo: Array.isArray(recDef.assignedTo) ? [...recDef.assignedTo] : [],
        currentAssignee: '',
        isRecurring: true,
        frequency: recDef.pattern.frequency || 'daily',
        interval: String(recDef.pattern.interval || 1),
        daysOfWeek: recDef.pattern.daysOfWeek || [],
        dueDate: '',
      })
      setEditingRecurringDefId(todo.recurrenceId) // Store the recurring def ID
      setEditingId(null) // Clear todo editing ID
      setIsAdding(true)
    } catch (error) {
      console.error('Error loading recurring definition:', error)
    }
  }

  const handleAddAssignee = (): void => {
    if (formData.currentAssignee.trim()) {
      setFormData({
        ...formData,
        assignedTo: [...formData.assignedTo, formData.currentAssignee.trim()],
        currentAssignee: '',
      })
    }
  }

  const handleRemoveAssignee = (index: number): void => {
    setFormData({
      ...formData,
      assignedTo: formData.assignedTo.filter((_, i) => i !== index),
    })
  }

  const handleAssigneeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddAssignee()
    }
  }

  const handleDoubleClick = (todo: TodoItem): void => {
    if (!todo.completed) {
      handleEdit(todo)
    }
  }

  const handleInlineEdit = (todo: TodoItem, field: 'title' | 'description' | 'assignedTo' | 'dueDate'): void => {
    setInlineEditingId(todo.id)
    setInlineEditField(field)
    // Initialize assignees for inline editing
    if (field === 'assignedTo') {
      setInlineAssignees(todo.assignedTo || [])
      setInlineAssigneeInput('')
    }
  }

  const handleInlineEditSave = async (todo: TodoItem, field: 'title' | 'description' | 'assignedTo' | 'dueDate', newValue: string | string[]): Promise<void> => {
    try {
      const updatedTodo = {
        ...todo,
        [field]: newValue,
      }
      // Convert and validate date string to ISO format if it's a due date
      if (field === 'dueDate' && typeof newValue === 'string') {
        if (newValue) {
          const date = new Date(newValue)
          if (isNaN(date.getTime())) {
            console.error('Invalid date:', newValue)
            return // Don't save invalid dates
          }
          updatedTodo.dueDate = date.toISOString()
        } else {
          updatedTodo.dueDate = undefined // Clear the due date if empty
        }
      }
      await axios.put(`${API_BASE}/todos/${todo.id}`, updatedTodo)
      await loadTodos()
      setInlineEditingId(null)
      setInlineEditField(null)
    } catch (error) {
      console.error('Error updating todo:', error)
    }
  }

  const handleInlineEditCancel = (): void => {
    setInlineEditingId(null)
    setInlineEditField(null)
    setInlineAssignees([])
    setInlineAssigneeInput('')
  }

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('Are you sure you want to delete this item?')) return

    try {
      await axios.delete(`${API_BASE}/todos/${id}`)
      await loadTodos()
    } catch (error) {
      console.error('Error deleting todo:', error)
    }
  }

  const handleToggleComplete = async (todo: TodoItem): Promise<void> => {
    try {
      await axios.put(`${API_BASE}/todos/${todo.id}`, {
        ...todo,
        completed: !todo.completed,
      })
      await loadTodos()
    } catch (error) {
      console.error('Error toggling completion:', error)
    }
  }

  const handleDragEnd = async (result: DropResult): Promise<void> => {
    if (!result.destination) return

    const items = Array.from(todos)
    const [reorderedItem] = items.splice(result.source.index, 1)
    if (!reorderedItem)
      return
    items.splice(result.destination.index, 0, reorderedItem)

    // Update local state optimistically
    setTodos(items)

    // Send reorder request to backend
    const reorderData: ReorderItem[] = items.map((item, index) => ({
      id: item.id,
      position: index,
    }))

    try {
      await axios.post(`${API_BASE}/todos/reorder`, reorderData)
    } catch (error) {
      console.error('Error reordering todos:', error)
      // Reload on error
      loadTodos()
    }
  }

  const handleQuickAdd = async (): Promise<void> => {
    if (!newRowData.title.trim()) return

    try {
      await axios.post(`${API_BASE}/todos`, {
        title: newRowData.title,
        description: newRowData.description,
        assignedTo: newRowData.assignedTo ? newRowData.assignedTo.split(',').map(a => a.trim()).filter(a => a) : [],
        completed: false,
      })
      setNewRowData({ title: '', description: '', assignedTo: '' })
      await loadTodos()
    } catch (error) {
      console.error('Error creating todo:', error)
    }
  }

  const handleNewRowKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: string): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Check if title has content before submitting
      const titleValue = field === 'title' ? e.currentTarget.value : newRowData.title
      if (titleValue.trim()) {
        handleQuickAdd()
      }
    }
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>📝 To-Do List</h1>
        <div className="user-info">
          <span className="user-email">{user?.email}</span>
          <button onClick={logout} className="btn-logout">
            Logout
          </button>
        </div>
      </header>

      <div className="container">
        <div className="add-section">
          {!isAdding ? (
            <button onClick={() => setIsAdding(true)} className="btn btn-primary">
              + Add New Item
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="todo-form">
              <input
                type="text"
                placeholder="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="input"
              />
              <textarea
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input textarea"
              />

              <div className="assignee-section">
                <div className="assignee-input-group">
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="text"
                      placeholder="Add assignee (press Enter)"
                      value={formData.currentAssignee}
                      onChange={(e) => {
                        setFormData({ ...formData, currentAssignee: e.target.value })
                        setShowFormAutocomplete(e.target.value.length > 0)
                      }}
                      onKeyDown={handleAssigneeKeyDown}
                      onFocus={() => setShowFormAutocomplete(formData.currentAssignee.length > 0)}
                      onBlur={() => setTimeout(() => setShowFormAutocomplete(false), 200)}
                      className="input"
                    />
                    {showFormAutocomplete && getAutocompleteSuggestions(formData.currentAssignee, formData.assignedTo).length > 0 && (
                      <div className="autocomplete-dropdown">
                        {getAutocompleteSuggestions(formData.currentAssignee, formData.assignedTo).map((suggestion, idx) => (
                          <div
                            key={idx}
                            className="autocomplete-item"
                            onClick={() => {
                              setFormData({ ...formData, assignedTo: [...formData.assignedTo, suggestion], currentAssignee: '' })
                              setShowFormAutocomplete(false)
                            }}
                          >
                            👤 {suggestion}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAssignee}
                    className="btn btn-secondary btn-small"
                  >
                    + Add
                  </button>
                </div>
                {formData.assignedTo.length > 0 && (
                  <div className="assignee-tags">
                    {formData.assignedTo.map((person, index) => (
                      <span
                        key={index}
                        className={`assignee-tag ${person === user?.email ? 'current-user' : ''}`}
                      >
                        👤 {person}
                        <button
                          type="button"
                          onClick={() => handleRemoveAssignee(index)}
                          className="remove-tag"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Recurring checkbox - disabled when editing a recurring instance */}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
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
              {formData.isRecurring && (editingRecurringDefId || !editingId || !originallyRecurring) && (
                <div className="recurring-options">
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value as 'daily' | 'weekly' | 'monthly' })}
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
                    onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                    className="input"
                  />
                </div>
              )}

              {formData.isRecurring && (editingRecurringDefId || !editingId || !originallyRecurring) && formData.frequency === 'weekly' && (
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
                              setFormData({ ...formData, daysOfWeek: [...formData.daysOfWeek, day] })
                            } else {
                              setFormData({ ...formData, daysOfWeek: formData.daysOfWeek.filter(d => d !== day) })
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
              {(!formData.isRecurring || (editingId !== null && formData.isRecurring && !editingRecurringDefId)) && (
                <div className="due-date-section">
                  <label htmlFor="dueDate" className="input-label">
                    {formData.isRecurring ? 'Instance Due Date:' : 'Due Date (optional):'}
                  </label>
                  <input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    max={(() => {
                      // Calculate max date for recurring instances
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
                              // Set max to one day before next instance
                              const maxDate = new Date(nextInstance)
                              maxDate.setDate(maxDate.getDate() - 1)
                              return maxDate.toISOString().split('T')[0]
                            }
                          }
                        }
                      }
                      return undefined
                    })()}
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
                      onClick={() => handleEditRecurringDefinition(todo)}
                      className="btn btn-secondary"
                    >
                      Edit Recurring Item
                    </button>
                  )
                })()}
                <button type="button" onClick={resetForm} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Filter Controls */}
        <div className="filter-section">
          <div className="filter-heading-container">
            <h3 className="filter-heading">Filter Items</h3>
            <button
              onClick={toggleFilterCollapsed}
              className="btn-collapse"
              aria-label={filterState.isCollapsed ? "Expand filters" : "Collapse filters"}
            >
              {filterState.isCollapsed ? '▼' : '▲'}
            </button>
          </div>
          
          {!filterState.isCollapsed && (
            <div className="filter-controls">
              {/* Assignee Filter */}
              <div className="filter-group">
                <label className="filter-label">Assigned To:</label>
                <div className="filter-assignee-controls">
                  <button
                    onClick={handleAssignedToMe}
                    className={`btn btn-filter ${filterState.assignedToUser === user?.email ? 'active' : ''}`}
                    title="Show items assigned to me"
                  >
                    👤 Assigned to me
                  </button>
                  <select
                    value={filterState.assignedToUser}
                    onChange={(e) => setFilterState({ ...filterState, assignedToUser: e.target.value })}
                    className="filter-select"
                  >
                    <option value="">All users</option>
                    {allowedUsers.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <label className="filter-checkbox-label">
                    <input
                      type="checkbox"
                      checked={filterState.showUnassigned}
                      onChange={(e) => setFilterState({ ...filterState, showUnassigned: e.target.checked })}
                    />
                    Include unassigned
                  </label>
                </div>
              </div>

              {/* Due Date Filter */}
              <div className="filter-group">
                <label className="filter-label">Due Date:</label>
                <div className="filter-date-controls">
                  <label className="filter-checkbox-label">
                    <input
                      type="checkbox"
                      checked={filterState.dueDateFilters.overdue}
                      onChange={(e) => setFilterState({
                        ...filterState,
                        dueDateFilters: { ...filterState.dueDateFilters, overdue: e.target.checked }
                      })}
                    />
                    🔴 Overdue
                  </label>
                  <label className="filter-checkbox-label">
                    <input
                      type="checkbox"
                      checked={filterState.dueDateFilters.today}
                      onChange={(e) => setFilterState({
                        ...filterState,
                        dueDateFilters: { ...filterState.dueDateFilters, today: e.target.checked }
                      })}
                    />
                    📅 Today
                  </label>
                  <label className="filter-checkbox-label">
                    <input
                      type="checkbox"
                      checked={filterState.dueDateFilters.tomorrow}
                      onChange={(e) => setFilterState({
                        ...filterState,
                        dueDateFilters: { ...filterState.dueDateFilters, tomorrow: e.target.checked }
                      })}
                    />
                    ⏭️ Tomorrow
                  </label>
                  <label className="filter-checkbox-label">
                    <input
                      type="checkbox"
                      checked={filterState.dueDateFilters.future}
                      onChange={(e) => setFilterState({
                        ...filterState,
                        dueDateFilters: { ...filterState.dueDateFilters, future: e.target.checked }
                      })}
                    />
                    ⏩ Future
                  </label>
                </div>
              </div>

              {/* Clear Filters Button */}
              <div className="filter-actions">
                <button onClick={handleClearFilters} className="btn btn-secondary btn-clear-filters">
                  Clear All Filters
                </button>
              </div>
            </div>
          )}
        </div>

        <table className="todo-table">
          <thead>
            <tr>
              <th className="col-checkbox"></th>
              <th className="col-title">Title</th>
              <th className="col-description">Description</th>
              <th className="col-assigned">Assigned To</th>
              <th className="col-due">Due Date</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="todos">
              {(provided) => (
                <tbody
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {getFilteredTodos().map((todo, index) => (
                    <Draggable key={todo.id} draggableId={String(todo.id)} index={index}>
                      {(provided, snapshot) => (
                        <tr
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          onDoubleClick={() => handleDoubleClick(todo)}
                          className={`todo-row ${todo.completed ? 'completed' : ''} ${snapshot.isDragging ? 'dragging' : ''
                            }`}
                        >
                          <td className="col-checkbox">
                            <input
                              type="checkbox"
                              checked={todo.completed}
                              onChange={() => handleToggleComplete(todo)}
                              className="checkbox"
                            />
                          </td>
                          <td className="col-title">
                            {inlineEditingId === todo.id && inlineEditField === 'title' ? (
                              <input
                                type="text"
                                defaultValue={todo.title}
                                autoFocus
                                className="inline-edit-input"
                                onBlur={(e) => {
                                  if (e.target.value !== todo.title) {
                                    handleInlineEditSave(todo, 'title', e.target.value)
                                  } else {
                                    handleInlineEditCancel()
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    if (e.currentTarget.value !== todo.title) {
                                      handleInlineEditSave(todo, 'title', e.currentTarget.value)
                                    } else {
                                      handleInlineEditCancel()
                                    }
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault()
                                    handleInlineEditCancel()
                                  }
                                }}
                              />
                            ) : (
                              <span
                                className="editable"
                                onClick={() => !todo.completed && handleInlineEdit(todo, 'title')}
                              >
                                {todo.title}
                              </span>
                            )}
                          </td>
                          <td className="col-description">
                            {inlineEditingId === todo.id && inlineEditField === 'description' ? (
                              <input
                                type="text"
                                defaultValue={todo.description}
                                autoFocus
                                className="inline-edit-input"
                                onBlur={(e) => {
                                  if (e.target.value !== todo.description) {
                                    handleInlineEditSave(todo, 'description', e.target.value)
                                  } else {
                                    handleInlineEditCancel()
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') {
                                    e.preventDefault()
                                    handleInlineEditCancel()
                                  }
                                }}
                              />
                            ) : (
                              <span
                                className="editable"
                                onClick={() => !todo.completed && handleInlineEdit(todo, 'description')}
                              >
                                {todo.description}
                              </span>
                            )}
                          </td>
                          <td className="col-assigned">
                            {inlineEditingId === todo.id && inlineEditField === 'assignedTo' ? (
                              <div className="inline-assignee-edit">
                                <div className="assignee-tags-inline">
                                  {inlineAssignees.map((person, idx) => (
                                    <span
                                      key={idx}
                                      className={`assignee-tag ${person === user?.email ? 'current-user' : ''}`}
                                    >
                                      👤 {person}
                                      <button
                                        onClick={() => setInlineAssignees(inlineAssignees.filter((_, i) => i !== idx))}
                                        className="remove-tag"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                <div style={{ position: 'relative' }}>
                                  <input
                                    type="text"
                                    placeholder="Add assignee"
                                    value={inlineAssigneeInput}
                                    onChange={(e) => {
                                      setInlineAssigneeInput(e.target.value)
                                      setShowInlineAutocomplete(e.target.value.length > 0)
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && inlineAssigneeInput.trim()) {
                                        e.preventDefault()
                                        setInlineAssignees([...inlineAssignees, inlineAssigneeInput.trim()])
                                        setInlineAssigneeInput('')
                                        setShowInlineAutocomplete(false)
                                      } else if (e.key === 'Escape') {
                                        handleInlineEditCancel()
                                      }
                                    }}
                                    onFocus={() => setShowInlineAutocomplete(inlineAssigneeInput.length > 0)}
                                    onBlur={() => {
                                      setTimeout(() => {
                                        setShowInlineAutocomplete(false)
                                        handleInlineEditSave(todo, 'assignedTo', inlineAssignees)
                                      }, INLINE_EDIT_BLUR_DELAY)
                                    }}
                                    autoFocus
                                    className="inline-edit-input"
                                    style={{ width: '100%', marginTop: '4px' }}
                                  />
                                  {showInlineAutocomplete && getAutocompleteSuggestions(inlineAssigneeInput, inlineAssignees).length > 0 && (
                                    <div className="autocomplete-dropdown">
                                      {getAutocompleteSuggestions(inlineAssigneeInput, inlineAssignees).map((suggestion, idx) => (
                                        <div
                                          key={idx}
                                          className="autocomplete-item"
                                          onMouseDown={(e) => {
                                            e.preventDefault()
                                            setInlineAssignees([...inlineAssignees, suggestion])
                                            setInlineAssigneeInput('')
                                            setShowInlineAutocomplete(false)
                                          }}
                                        >
                                          👤 {suggestion}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div
                                className="editable"
                                onClick={() => !todo.completed && handleInlineEdit(todo, 'assignedTo')}
                                style={{ cursor: todo.completed ? 'default' : 'pointer' }}
                              >
                                {todo.assignedTo && todo.assignedTo.length > 0 ? (
                                  <div className="assignee-badges">
                                    {todo.assignedTo.map((person, idx) => (
                                      <span
                                        key={idx}
                                        className={`assignee-badge-small ${person === user?.email ? 'current-user' : ''}`}
                                      >
                                        👤 {person}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ color: '#999', fontSize: '0.85rem' }}>Click to add</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="col-due">
                            {inlineEditingId === todo.id && inlineEditField === 'dueDate' ? (
                              <input
                                type="date"
                                defaultValue={todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : ''}
                                onBlur={(e) => {
                                  handleInlineEditSave(todo, 'dueDate', e.target.value)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleInlineEditSave(todo, 'dueDate', e.currentTarget.value)
                                  } else if (e.key === 'Escape') {
                                    handleInlineEditCancel()
                                  }
                                }}
                                autoFocus
                                className="inline-edit-input"
                              />
                            ) : (
                              <div
                                className="editable"
                                onClick={() => !todo.completed && handleInlineEdit(todo, 'dueDate')}
                                style={{ cursor: todo.completed ? 'default' : 'pointer' }}
                              >
                                {todo.dueDate ? (
                                  <span className="due-date">
                                    {todo.isRecurring && <span className="recurring-badge">🔄 </span>}
                                    📅 {new Date(todo.dueDate).toLocaleDateString()}
                                  </span>
                                ) : (
                                  <span style={{ color: '#999', fontSize: '0.85rem' }}>Click to add</span>
                                )}
                                {!todo.dueDate && todo.isRecurring && (
                                  <span className="recurring-badge">🔄</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="col-actions">
                            <button
                              onClick={() => handleEdit(todo)}
                              className="btn btn-icon"
                              disabled={todo.completed}
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(todo.id)}
                              className="btn btn-icon btn-danger"
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}

                  {/* Quick add row */}
                  <tr className="quick-add-row">
                    <td className="col-checkbox"></td>
                    <td className="col-title">
                      <input
                        type="text"
                        placeholder="Type to add new item..."
                        value={newRowData.title}
                        onChange={(e) => setNewRowData({ ...newRowData, title: e.target.value })}
                        onKeyDown={(e) => handleNewRowKeyDown(e, 'title')}
                        className="quick-add-input"
                      />
                    </td>
                    <td className="col-description">
                      <input
                        type="text"
                        placeholder="Description..."
                        value={newRowData.description}
                        onChange={(e) => setNewRowData({ ...newRowData, description: e.target.value })}
                        onKeyDown={(e) => handleNewRowKeyDown(e, 'description')}
                        className="quick-add-input"
                      />
                    </td>
                    <td className="col-assigned">
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="Assignees..."
                          value={newRowData.assignedTo}
                          onChange={(e) => {
                            setNewRowData({ ...newRowData, assignedTo: e.target.value })
                            setShowQuickAddAutocomplete(e.target.value.length > 0 && e.target.value.split(',').pop()?.trim().length! > 0)
                          }}
                          onKeyDown={(e) => handleNewRowKeyDown(e, 'assignedTo')}
                          onFocus={() => {
                            const lastEntry = newRowData.assignedTo.split(',').pop()?.trim() || ''
                            setShowQuickAddAutocomplete(lastEntry.length > 0)
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowQuickAddAutocomplete(false), 200)
                          }}
                          className="quick-add-input"
                        />
                        {showQuickAddAutocomplete && (() => {
                          const entries = newRowData.assignedTo.split(',').map(e => e.trim())
                          const lastEntry = entries[entries.length - 1] || ''
                          const existingAssignees = entries.slice(0, -1).filter(e => e.length > 0)
                          const suggestions = getAutocompleteSuggestions(lastEntry, existingAssignees)
                          return suggestions.length > 0 ? (
                            <div className="autocomplete-dropdown">
                              {suggestions.map((suggestion, idx) => (
                                <div
                                  key={idx}
                                  className="autocomplete-item"
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    const beforeLast = entries.slice(0, -1).filter(e => e.length > 0)
                                    setNewRowData({ ...newRowData, assignedTo: [...beforeLast, suggestion].join(', ') + ', ' })
                                    setShowQuickAddAutocomplete(false)
                                  }}
                                >
                                  👤 {suggestion}
                                </div>
                              ))}
                            </div>
                          ) : null
                        })()}
                      </div>
                    </td>
                    <td className="col-due"></td>
                    <td className="col-actions"></td>
                  </tr>
                </tbody>
              )}
            </Droppable>
          </DragDropContext>
        </table>
      </div>
    </div>
  )
}

export default App
