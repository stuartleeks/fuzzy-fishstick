import { useState } from 'react'

interface InlineAssigneeEditProps {
  initialAssignees: string[]
  currentUser?: string
  allowedUsers: string[]
  onSave: (assignees: string[]) => void
  onCancel: () => void
  blurDelay?: number
}

export function InlineAssigneeEdit({
  initialAssignees,
  currentUser,
  allowedUsers,
  onSave,
  onCancel,
  blurDelay = 200,
}: InlineAssigneeEditProps) {
  const [assignees, setAssignees] = useState<string[]>(initialAssignees)
  const [input, setInput] = useState<string>('')
  const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false)

  const getAutocompleteSuggestions = (input: string): string[] => {
    if (!input.trim()) return []
    const lowerInput = input.toLowerCase()
    return allowedUsers.filter(
      user => user.toLowerCase().includes(lowerInput) && !assignees.includes(user)
    )
  }

  const handleRemoveAssignee = (index: number): void => {
    setAssignees(assignees.filter((_, i) => i !== index))
  }

  const handleAddAssignee = (assignee: string): void => {
    setAssignees([...assignees, assignee])
    setInput('')
    setShowAutocomplete(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault()
      handleAddAssignee(input.trim())
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  const suggestions = getAutocompleteSuggestions(input)

  return (
    <div className="inline-assignee-edit">
      <div className="assignee-tags-inline">
        {assignees.map((person, idx) => (
          <span
            key={idx}
            className={`assignee-tag ${person === currentUser ? 'current-user' : ''}`}
          >
            👤 {person}
            <button
              onClick={() => handleRemoveAssignee(idx)}
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
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setShowAutocomplete(e.target.value.length > 0)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowAutocomplete(input.length > 0)}
          onBlur={() => {
            setTimeout(() => {
              setShowAutocomplete(false)
              onSave(assignees)
            }, blurDelay)
          }}
          autoFocus
          className="inline-edit-input"
          style={{ width: '100%', marginTop: '4px' }}
        />
        {showAutocomplete && suggestions.length > 0 && (
          <div className="autocomplete-dropdown">
            {suggestions.map((suggestion, idx) => (
              <div
                key={idx}
                className="autocomplete-item"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleAddAssignee(suggestion)
                }}
              >
                👤 {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
