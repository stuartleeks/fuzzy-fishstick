import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import axios from 'axios'
import './App.css'

const API_BASE = '/api'

function App() {
  const [todos, setTodos] = useState([])
  const [recurringDefs, setRecurringDefs] = useState([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [inlineEditingId, setInlineEditingId] = useState(null)
  const [inlineEditField, setInlineEditField] = useState(null)
  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: [],
    currentAssignee: '',
    isRecurring: false,
    frequency: 'daily',
    interval: 1,
    daysOfWeek: [],
  })

  // Load todos and recurring definitions
  useEffect(() => {
    loadTodos()
    loadRecurringDefs()
  }, [])

  const loadTodos = async () => {
    try {
      const response = await axios.get(`${API_BASE}/todos`)
      setTodos(response.data || [])
    } catch (error) {
      console.error('Error loading todos:', error)
    }
  }

  const loadRecurringDefs = async () => {
    try {
      const response = await axios.get(`${API_BASE}/recurring`)
      setRecurringDefs(response.data || [])
    } catch (error) {
      console.error('Error loading recurring definitions:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      if (editingId) {
        // Check if we need to convert to/from recurring
        const currentTodo = todos.find(t => t.id === editingId)
        
        if (formData.isRecurring && !currentTodo?.isRecurring) {
          // Convert to recurring
          await axios.post(`${API_BASE}/todos/${editingId}/convert-recurring`, {
            toRecurring: true,
            pattern: {
              frequency: formData.frequency,
              interval: parseInt(formData.interval),
              daysOfWeek: formData.daysOfWeek,
            },
          })
        } else if (!formData.isRecurring && currentTodo?.isRecurring) {
          // Convert from recurring to one-off
          await axios.post(`${API_BASE}/todos/${editingId}/convert-recurring`, {
            toRecurring: false,
          })
        } else {
          // Regular update
          await axios.put(`${API_BASE}/todos/${editingId}`, {
            title: formData.title,
            description: formData.description,
            assignedTo: formData.assignedTo,
            completed: false,
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
            interval: parseInt(formData.interval),
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
      interval: 1,
      daysOfWeek: [],
    })
    setIsAdding(false)
    setEditingId(null)
    setShowRecurringForm(false)
  }

  const handleEdit = (todo) => {
    setFormData({
      title: todo.title,
      description: todo.description,
      assignedTo: Array.isArray(todo.assignedTo) ? [...todo.assignedTo] : [],
      currentAssignee: '',
      isRecurring: todo.isRecurring || false,
      frequency: 'daily',
      interval: 1,
      daysOfWeek: [],
    })
    setEditingId(todo.id)
    setIsAdding(true)
  }

  const handleAddAssignee = () => {
    if (formData.currentAssignee.trim()) {
      setFormData({
        ...formData,
        assignedTo: [...formData.assignedTo, formData.currentAssignee.trim()],
        currentAssignee: '',
      })
    }
  }

  const handleRemoveAssignee = (index) => {
    setFormData({
      ...formData,
      assignedTo: formData.assignedTo.filter((_, i) => i !== index),
    })
  }

  const handleAssigneeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddAssignee()
    }
  }

  const handleDoubleClick = (todo) => {
    if (!todo.completed) {
      handleEdit(todo)
    }
  }

  const handleInlineEdit = (todo, field, value) => {
    setInlineEditingId(todo.id)
    setInlineEditField(field)
  }

  const handleInlineEditSave = async (todo, field, newValue) => {
    try {
      const updatedTodo = {
        ...todo,
        [field]: newValue,
      }
      await axios.put(`${API_BASE}/todos/${todo.id}`, updatedTodo)
      await loadTodos()
      setInlineEditingId(null)
      setInlineEditField(null)
    } catch (error) {
      console.error('Error updating todo:', error)
    }
  }

  const handleInlineEditCancel = () => {
    setInlineEditingId(null)
    setInlineEditField(null)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return
    
    try {
      await axios.delete(`${API_BASE}/todos/${id}`)
      await loadTodos()
    } catch (error) {
      console.error('Error deleting todo:', error)
    }
  }

  const handleToggleComplete = async (todo) => {
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

  const handleDragEnd = async (result) => {
    if (!result.destination) return

    const items = Array.from(todos)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    // Update local state optimistically
    setTodos(items)

    // Send reorder request to backend
    const reorderData = items.map((item, index) => ({
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

  const handleDeleteRecurring = async (id) => {
    if (!window.confirm('Delete this recurring item definition?')) return
    
    try {
      await axios.delete(`${API_BASE}/recurring/${id}`)
      await loadRecurringDefs()
      await loadTodos()
    } catch (error) {
      console.error('Error deleting recurring definition:', error)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>📝 To-Do List</h1>
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
                  <input
                    type="text"
                    placeholder="Add assignee (press Enter)"
                    value={formData.currentAssignee}
                    onChange={(e) => setFormData({ ...formData, currentAssignee: e.target.value })}
                    onKeyDown={handleAssigneeKeyDown}
                    className="input"
                  />
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
                      <span key={index} className="assignee-tag">
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
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                />
                Make this a recurring item
              </label>

              {formData.isRecurring && (
                <div className="recurring-options">
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
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

              {formData.isRecurring && formData.frequency === 'weekly' && (
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

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Update' : 'Add'}
                </button>
                <button type="button" onClick={resetForm} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="todos">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="todo-list"
              >
                {todos.length === 0 ? (
                  <p className="empty-message">No items yet. Add your first to-do!</p>
                ) : (
                  todos.map((todo, index) => (
                    <Draggable key={todo.id} draggableId={String(todo.id)} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          onDoubleClick={() => handleDoubleClick(todo)}
                          className={`todo-item ${todo.completed ? 'completed' : ''} ${
                            snapshot.isDragging ? 'dragging' : ''
                          }`}
                        >
                          <div className="todo-content">
                            <input
                              type="checkbox"
                              checked={todo.completed}
                              onChange={() => handleToggleComplete(todo)}
                              className="checkbox"
                            />
                            <div className="todo-details">
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
                                      if (e.target.value !== todo.title) {
                                        handleInlineEditSave(todo, 'title', e.target.value)
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
                                <h3 
                                  className="todo-title editable"
                                  onClick={() => !todo.completed && handleInlineEdit(todo, 'title')}
                                >
                                  {todo.title}
                                  {todo.isRecurring && <span className="recurring-badge">🔄</span>}
                                </h3>
                              )}
                              
                              {inlineEditingId === todo.id && inlineEditField === 'description' ? (
                                <textarea
                                  defaultValue={todo.description}
                                  autoFocus
                                  className="inline-edit-textarea"
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
                                todo.description && (
                                  <p 
                                    className="todo-description editable"
                                    onClick={() => !todo.completed && handleInlineEdit(todo, 'description')}
                                  >
                                    {todo.description}
                                  </p>
                                )
                              )}
                              
                              {todo.assignedTo && todo.assignedTo.length > 0 && (
                                <div className="todo-assigned">
                                  {todo.assignedTo.map((person, idx) => (
                                    <span key={idx} className="assignee-badge">
                                      👤 {person}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {todo.dueDate && (
                                <p className="todo-due">
                                  📅 {new Date(todo.dueDate).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="todo-actions">
                            <button
                              onClick={() => handleEdit(todo)}
                              className="btn btn-small"
                              disabled={todo.completed}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(todo.id)}
                              className="btn btn-small btn-danger"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {recurringDefs.length > 0 && (
          <div className="recurring-section">
            <h2>Recurring Item Definitions</h2>
            <div className="recurring-list">
              {recurringDefs.map((def) => (
                <div key={def.id} className="recurring-def">
                  <div className="recurring-content">
                    <h3>{def.title}</h3>
                    <p>
                      {def.pattern.frequency} (every {def.pattern.interval}{' '}
                      {def.pattern.frequency === 'daily'
                        ? 'day(s)'
                        : def.pattern.frequency === 'weekly'
                        ? 'week(s)'
                        : 'month(s)'}
                      )
                    </p>
                    {def.assignedTo && <p>👤 {def.assignedTo}</p>}
                  </div>
                  <button
                    onClick={() => handleDeleteRecurring(def.id)}
                    className="btn btn-small btn-danger"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
