'use client'

import { useEffect, useRef, useState } from 'react'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { IconSearch, IconX } from './icons'

interface SearchInputProps {
  /** Called with the debounced query whenever it settles. */
  onSearch: (query: string) => void
  /** Initial text in the field. */
  initialValue?: string
  /** Debounce delay in milliseconds. Defaults to 300. */
  delay?: number
  placeholder?: string
  /** Shows a spinner instead of the clear button while a search is in flight. */
  loading?: boolean
  /** Width of the field. Defaults to 100%. */
  width?: number | string
  'aria-label'?: string
}

/**
 * Debounced search field. Keeps typing instant and only fires `onSearch`
 * once the user pauses, so it can be wired straight to a network request.
 *
 * @example
 * <SearchInput placeholder="Buscar clientes..." onSearch={setQuery} />
 */
export function SearchInput({
  onSearch,
  initialValue = '',
  delay = 300,
  placeholder = 'Buscar...',
  loading = false,
  width = '100%',
  'aria-label': ariaLabel,
}: SearchInputProps) {
  const [value, setValue] = useState(initialValue)
  const debounced = useDebouncedValue(value, delay)

  // Keep the callback out of the effect deps so callers can pass inline arrows.
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch

  const lastEmitted = useRef(initialValue)

  useEffect(() => {
    if (debounced === lastEmitted.current) return
    lastEmitted.current = debounced
    onSearchRef.current(debounced)
  }, [debounced])

  return (
    <div className="search-input" style={{ width }}>
      <span className="search-input-icon" aria-hidden="true">
        <IconSearch width={16} height={16} />
      </span>
      <input
        type="search"
        className="form-input search-input-field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
      />
      {loading ? (
        <span className="search-input-action" aria-hidden="true">
          <span className="spinner" />
        </span>
      ) : (
        value && (
          <button
            type="button"
            className="search-input-action search-input-clear"
            onClick={() => setValue('')}
            aria-label="Limpiar búsqueda"
          >
            <IconX width={14} height={14} />
          </button>
        )
      )}
    </div>
  )
}
