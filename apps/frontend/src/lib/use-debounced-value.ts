'use client'

import { useEffect, useState } from 'react'

/**
 * Returns `value` after it has stayed unchanged for `delay` milliseconds.
 *
 * Useful for keeping an input responsive while throttling the expensive work
 * (network requests, filtering) that reacts to it.
 *
 * @example
 * const [query, setQuery] = useState('')
 * const debouncedQuery = useDebouncedValue(query, 300)
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
