import { Input, Select } from '@cloudflare/kumo'
import { useMemo } from 'react'
import type { ModelOption } from '../lib/types'

export function ModelPicker({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  options: ModelOption[]
  placeholder: string
  onChange: (value: string) => void
}) {
  const selectItems = useMemo(
    () => options.map((option) => ({ label: option.label, value: option.value })),
    [options],
  )

  if (!options.length) {
    return (
      <Input
        label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    )
  }

  return (
    <Select
      label={label}
      value={value}
      items={selectItems}
      placeholder={placeholder}
      onValueChange={(next) => onChange(String(next || ''))}
    />
  )
}
