import { useState, useEffect, useRef } from 'react'

export interface AssigneeInputProps {
  assignedTo: string[]
  currentUser?: string
  allowedUsers: string[]
  onChange: (assignees: string[]) => void
  onInputChange?: (value: string) => void
  inputPlaceholder?: string
  showAddButton?: boolean
  autoFocus?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onBlur?: () => void
  className?: string
}

export function AssigneeInput({
  assignedTo,
  currentUser,
  allowedUsers,
  onChange,
  onInputChange,
  inputPlaceholder = 'Add assignee (press Enter)',
  showAddButton = true,
  autoFocus = false,
  onKeyDown,
  onBlur,
  className = '',
}: AssigneeInputProps) {
  const [currentAssignee, setCurrentAssignee] = useState<string>('')
  const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const getAutocompleteSuggestions = (input: string): string[] => {
    if (!input.trim()) return []
    const lowerInput = input.toLowerCase()
    return allowedUsers.filter(
      user => user.toLowerCase().includes(lowerInput) && !assignedTo.includes(user)
    )
  }

  const handleAddAssignee = (): void => {
    if (currentAssignee.trim()) {
      onChange([...assignedTo, currentAssignee.trim()])
      setCurrentAssignee('')
      setShowAutocomplete(false)
    }
  }

  const handleRemoveAssignee = (index: number): void => {
    onChange(assignedTo.filter((_, i) => i !== index))
  }

  const handleInputChange = (value: string): void => {
    setCurrentAssignee(value)
    setShowAutocomplete(value.length > 0)
    if (onInputChange) {
      onInputChange(value)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddAssignee()
    }
    if (onKeyDown) {
      onKeyDown(e)
    }
  }

  const handleSelectSuggestion = (suggestion: string): void => {
    onChange([...assignedTo, suggestion])
    setCurrentAssignee('')
    setShowAutocomplete(false)
  }

  const suggestions = getAutocompleteSuggestions(currentAssignee)

  return (
    <div className={`assignee-section ${className}`}>
      <div className="assignee-input-group">
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            ref={inputRef}
            type="text"
            placeholder={inputPlaceholder}
            value={currentAssignee}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowAutocomplete(currentAssignee.length > 0)}
            onBlur={() => {
              setTimeout(() => {
                setShowAutocomplete(false)
                if (onBlur) {
                  onBlur()
                }
              }, 200)
            }}
            className="input"
          />
          {showAutocomplete && suggestions.length > 0 && (
            <div className="autocomplete-dropdown">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className="autocomplete-item"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelectSuggestion(suggestion)
                  }}
                >
                  👤 {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
        {showAddButton && (
          <button
            type="button"
            onClick={handleAddAssignee}
            className="btn btn-secondary btn-small"
          >
            + Add
          </button>
        )}
      </div>
      {assignedTo.length > 0 && (
        <div className="assignee-tags">
          {assignedTo.map((person, index) => (
            <span
              key={index}
              className={`assignee-tag ${person === currentUser ? 'current-user' : ''}`}
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
  )
}
