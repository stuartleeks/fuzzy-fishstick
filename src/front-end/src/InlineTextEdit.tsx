interface InlineTextEditProps {
  initialValue: string
  onSave: (value: string) => void
  onCancel: () => void
  type?: 'text' | 'date'
  className?: string
}

export function InlineTextEdit({
  initialValue,
  onSave,
  onCancel,
  type = 'text',
  className = 'inline-edit-input',
}: InlineTextEditProps) {
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>): void => {
    if (e.target.value !== initialValue) {
      onSave(e.target.value)
    } else {
      onCancel()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.currentTarget.value !== initialValue) {
        onSave(e.currentTarget.value)
      } else {
        onCancel()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <input
      type={type}
      defaultValue={initialValue}
      autoFocus
      className={className}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )
}
