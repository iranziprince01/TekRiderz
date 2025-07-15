import { beforeEach, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Mock IndexedDB for tests
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
}

Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
})

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true,
})

// Mock service worker
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    register: vi.fn(),
    ready: Promise.resolve({
      sync: { register: vi.fn() }
    }),
  },
  writable: true,
})

// Cleanup after each test
afterEach(() => {
  cleanup()
}) 