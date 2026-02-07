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
  const [newRowData, setNewRowData] = useState({
    title: '',
    description: '',
    assignedTo: '',
  })
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

  const handleEdit = async (todo) => {
    // If editing a recurring item, fetch its definition to get pattern details
    let frequency = 'daily'
    let interval = 1
    let daysOfWeek = []
    
    if (todo.isRecurring && todo.recurrenceId) {
      try {
        const recDef = recurringDefs.find(def => def.id === todo.recurrenceId)
        if (recDef && recDef.pattern) {
          frequency = recDef.pattern.frequency || 'daily'
          interval = recDef.pattern.interval || 1
          daysOfWeek = recDef.pattern.daysOfWeek || []
        }
      } catch (error) {
        console.error('Error loading recurrence pattern:', error)
      }
    }
    
    setFormData({
      title: todo.title,
      description: todo.description,
      assignedTo: Array.isArray(todo.assignedTo) ? [...todo.assignedTo] : [],
      currentAssignee: '',
      isRecurring: todo.isRecurring || false,
      frequency: frequency,
      interval: interval,
      daysOfWeek: daysOfWeek,
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

  const handleQuickAdd = async () => {
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

  const handleNewRowKeyDown = (e, field) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (field === 'assignedTo' || newRowData.title) {
        handleQuickAdd()
      }
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
                          className={`todo-row ${todo.completed ? 'completed' : ''} ${
                            snapshot.isDragging ? 'dragging' : ''
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
                              <span 
                                className="editable"
                                onClick={() => !todo.completed && handleInlineEdit(todo, 'title')}
                              >
                                {todo.title}
                                {todo.isRecurring && <span className="recurring-badge">🔄</span>}
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
                            {todo.assignedTo && todo.assignedTo.length > 0 && (
                              <div className="assignee-badges">
                                {todo.assignedTo.map((person, idx) => (
                                  <span key={idx} className="assignee-badge-small">
                                    👤 {person}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="col-due">
                            {todo.dueDate && (
                              <span className="due-date">
                                📅 {new Date(todo.dueDate).toLocaleDateString()}
                              </span>
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
                        onBlur={handleQuickAdd}
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
                      <input
                        type="text"
                        placeholder="Assignees..."
                        value={newRowData.assignedTo}
                        onChange={(e) => setNewRowData({ ...newRowData, assignedTo: e.target.value })}
                        onKeyDown={(e) => handleNewRowKeyDown(e, 'assignedTo')}
                        className="quick-add-input"
                      />
                    </td>
                    <td className="col-due"></td>
                    <td className="col-actions"></td>
                  </tr>
                </tbody>
              )}
            </Droppable>
          </DragDropContext>
        </table>

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
