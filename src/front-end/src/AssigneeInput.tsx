import { useState, useEffect, useRef } from 'react'

export interface AssigneeInputProps {
  assignedTo: string[]
  currentUser?: string
  allowedUsers: string[]
  onChange?: (assignees: string[]) => void
  onSave?: (assignees: string[]) => void
  onCancel?: () => void
  onInputChange?: (value: string) => void
  inputPlaceholder?: string
  showAddButton?: boolean
  autoFocus?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onBlur?: () => void
  className?: string
  variant?: 'default' | 'inline'
  blurDelay?: number
}

export function AssigneeInput({
  assignedTo,
  currentUser,
  allowedUsers,
  onChange,
  onSave,
  onCancel,
  onInputChange,
  inputPlaceholder = 'Add assignee (press Enter)',
  showAddButton = true,
  autoFocus = false,
  onKeyDown,
  onBlur,
  className = '',
  variant = 'default',
  blurDelay = 200,
}: AssigneeInputProps) {
  // For inline variant, manage local state and save on blur
  // For default variant, update immediately via onChange
  const isInlineMode = variant === 'inline' && onSave !== undefined
  const [localAssignees, setLocalAssignees] = useState<string[]>(assignedTo)
  const [currentAssignee, setCurrentAssignee] = useState<string>('')
  const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update local state when assignedTo prop changes (for inline mode)
  useEffect(() => {
    if (isInlineMode) {
      setLocalAssignees(assignedTo)
    }
  }, [assignedTo, isInlineMode])

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  // Use local state in inline mode, prop in default mode
  const effectiveAssignees = isInlineMode ? localAssignees : assignedTo

  const getAutocompleteSuggestions = (input: string): string[] => {
    if (!input.trim()) return []
    const lowerInput = input.toLowerCase()
    return allowedUsers.filter(
      user => user.toLowerCase().includes(lowerInput) && !effectiveAssignees.includes(user)
    )
  }

  const handleAddAssignee = (): void => {
    if (currentAssignee.trim()) {
      const newAssignees = [...effectiveAssignees, currentAssignee.trim()]
      if (isInlineMode) {
        setLocalAssignees(newAssignees)
      } else if (onChange) {
        onChange(newAssignees)
      }
      setCurrentAssignee('')
      setShowAutocomplete(false)
    }
  }

  const handleRemoveAssignee = (index: number): void => {
    const newAssignees = effectiveAssignees.filter((_, i) => i !== index)
    if (isInlineMode) {
      setLocalAssignees(newAssignees)
    } else if (onChange) {
      onChange(newAssignees)
    }
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
    } else if (e.key === 'Escape' && onCancel) {
      onCancel()
    }
    if (onKeyDown) {
      onKeyDown(e)
    }
  }

  const handleSelectSuggestion = (suggestion: string): void => {
    const newAssignees = [...effectiveAssignees, suggestion]
    if (isInlineMode) {
      setLocalAssignees(newAssignees)
    } else if (onChange) {
      onChange(newAssignees)
    }
    setCurrentAssignee('')
    setShowAutocomplete(false)
  }

  const handleBlur = (): void => {
    setTimeout(() => {
      setShowAutocomplete(false)
      // In inline mode, save on blur
      if (isInlineMode && onSave) {
        onSave(localAssignees)
      }
      if (onBlur) {
        onBlur()
      }
    }, blurDelay)
  }

  const suggestions = getAutocompleteSuggestions(currentAssignee)

  // Determine wrapper class based on variant
  const wrapperClass = variant === 'inline' ? 'inline-assignee-edit' : `assignee-section ${className}`
  const tagsClass = variant === 'inline' ? 'assignee-tags-inline' : 'assignee-tags'
  const inputClass = variant === 'inline' ? 'inline-edit-input' : 'input'
  const inputStyle = variant === 'inline' ? { width: '100%', marginTop: '4px' } : undefined

  return (
    <div className={wrapperClass}>
      {/* For inline variant, show tags above input */}
      {variant === 'inline' && effectiveAssignees.length > 0 && (
        <div className={tagsClass}>
          {effectiveAssignees.map((person, index) => (
            <span
              key={index}
              className={`assignee-tag ${person === currentUser ? 'current-user' : ''}`}
            >
              👤 {person}
              <button
                onClick={() => handleRemoveAssignee(index)}
                className="remove-tag"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* For default variant, show input group with optional add button */}
      {variant === 'default' && (
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
              onBlur={handleBlur}
              className={inputClass}
              style={inputStyle}
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
      )}

      {/* For inline variant, show input without button below tags */}
      {variant === 'inline' && (
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder={inputPlaceholder}
            value={currentAssignee}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowAutocomplete(currentAssignee.length > 0)}
            onBlur={handleBlur}
            className={inputClass}
            style={inputStyle}
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
      )}

      {/* For default variant, show tags below input */}
      {variant === 'default' && effectiveAssignees.length > 0 && (
        <div className={tagsClass}>
          {effectiveAssignees.map((person, index) => (
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
