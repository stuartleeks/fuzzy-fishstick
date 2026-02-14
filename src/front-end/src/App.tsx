import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import axios from 'axios'
import './App.css'
import type { TodoItem, RecurringItemDefinition, FormData, NewRowData, ReorderItem } from './types'
import { useAuth } from './AuthProvider'
import LoginPage from './LoginPage'
import { TodoItemForm } from './TodoItemForm'
import { InlineAssigneeEdit } from './InlineAssigneeEdit'
import { InlineTextEdit } from './InlineTextEdit'

const API_BASE = '/api'

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
  const [allowedUsers, setAllowedUsers] = useState<string[]>([]) // List of allowed users for autocompletion
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

  // Delay before saving inline edits on blur (allows remove button clicks to process first)
  const INLINE_EDIT_BLUR_DELAY = 200 // milliseconds

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

  const handleDoubleClick = (todo: TodoItem): void => {
    if (!todo.completed) {
      handleEdit(todo)
    }
  }

  const handleInlineEdit = (todo: TodoItem, field: 'title' | 'description' | 'assignedTo' | 'dueDate'): void => {
    setInlineEditingId(todo.id)
    setInlineEditField(field)
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
            <TodoItemForm
              formData={formData}
              onFormDataChange={setFormData}
              onSubmit={handleSubmit}
              onCancel={resetForm}
              editingId={editingId}
              editingRecurringDefId={editingRecurringDefId}
              originallyRecurring={originallyRecurring}
              todos={todos}
              recurringDefs={recurringDefs}
              onEditRecurringDefinition={handleEditRecurringDefinition}
              currentUser={user?.email}
              allowedUsers={allowedUsers}
            />
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
                  {todos.map((todo, index) => (
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
                              <InlineTextEdit
                                initialValue={todo.title}
                                onSave={(value) => handleInlineEditSave(todo, 'title', value)}
                                onCancel={handleInlineEditCancel}
                                type="text"
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
                              <InlineTextEdit
                                initialValue={todo.description}
                                onSave={(value) => handleInlineEditSave(todo, 'description', value)}
                                onCancel={handleInlineEditCancel}
                                type="text"
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
                              <InlineAssigneeEdit
                                initialAssignees={todo.assignedTo || []}
                                currentUser={user?.email}
                                allowedUsers={allowedUsers}
                                onSave={(assignees) => handleInlineEditSave(todo, 'assignedTo', assignees)}
                                onCancel={handleInlineEditCancel}
                                blurDelay={INLINE_EDIT_BLUR_DELAY}
                              />
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
                              <InlineTextEdit
                                initialValue={todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : ''}
                                onSave={(value) => handleInlineEditSave(todo, 'dueDate', value)}
                                onCancel={handleInlineEditCancel}
                                type="date"
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
