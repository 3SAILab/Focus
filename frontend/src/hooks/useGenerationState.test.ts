/**
 * Unit tests for useGenerationState hook
 *
 * Tests hook interface completeness, initial state values,
 * removePendingTask filtering, updatePendingTaskBatchId,
 * and batchHasFailedImages detection.
 *
 * Requirements: 5.2, 5.3, 5.4, 5.5
 *
 * Note: This test file is written for vitest (the frontend uses Vite).
 * Install vitest to run: npm install -D vitest @testing-library/react @testing-library/react-hooks
 */

import { describe, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGenerationState } from './useGenerationState';
import type { PendingTask } from './useGroupedHistory';
import type { BatchResult } from '../type/generation';

describe('useGenerationState', () => {
  describe('Hook Interface', () => {
    test('returns all expected properties', () => {
      const { result } = renderHook(() => useGenerationState());

      const expectedKeys = [
        'pendingTasks',
        'setPendingTasks',
        'batchResults',
        'setBatchResults',
        'failedGenerations',
        'setFailedGenerations',
        'removePendingTask',
        'updatePendingTaskBatchId',
        'batchHasFailedImages',
      ];

      for (const key of expectedKeys) {
        expect(result.current).toHaveProperty(key);
      }
    });

    test('state setters are functions', () => {
      const { result } = renderHook(() => useGenerationState());

      expect(typeof result.current.setPendingTasks).toBe('function');
      expect(typeof result.current.setBatchResults).toBe('function');
      expect(typeof result.current.setFailedGenerations).toBe('function');
    });

    test('callback functions are functions', () => {
      const { result } = renderHook(() => useGenerationState());

      expect(typeof result.current.removePendingTask).toBe('function');
      expect(typeof result.current.updatePendingTaskBatchId).toBe('function');
      expect(typeof result.current.batchHasFailedImages).toBe('function');
    });
  });

  describe('Initial State', () => {
    test('pendingTasks is initially an empty array', () => {
      const { result } = renderHook(() => useGenerationState());
      expect(result.current.pendingTasks).toEqual([]);
    });

    test('batchResults is initially an empty array', () => {
      const { result } = renderHook(() => useGenerationState());
      expect(result.current.batchResults).toEqual([]);
    });

    test('failedGenerations is initially an empty array', () => {
      const { result } = renderHook(() => useGenerationState());
      expect(result.current.failedGenerations).toEqual([]);
    });
  });

  describe('removePendingTask', () => {
    const makePendingTask = (overrides: Partial<PendingTask> = {}): PendingTask => ({
      id: 'temp-1',
      prompt: 'test prompt',
      imageCount: 1,
      timestamp: Date.now(),
      ...overrides,
    });

    test('filters by tempId (matches on id field)', () => {
      const { result } = renderHook(() => useGenerationState());

      act(() => {
        result.current.setPendingTasks([
          makePendingTask({ id: 'temp-1' }),
          makePendingTask({ id: 'temp-2' }),
          makePendingTask({ id: 'temp-3' }),
        ]);
      });

      act(() => {
        result.current.removePendingTask({ tempId: 'temp-2' });
      });

      expect(result.current.pendingTasks).toHaveLength(2);
      expect(result.current.pendingTasks.map(t => t.id)).toEqual(['temp-1', 'temp-3']);
    });

    test('filters by taskId', () => {
      const { result } = renderHook(() => useGenerationState());

      act(() => {
        result.current.setPendingTasks([
          makePendingTask({ id: 'temp-1', taskId: 'task-A' }),
          makePendingTask({ id: 'temp-2', taskId: 'task-B' }),
        ]);
      });

      act(() => {
        result.current.removePendingTask({ taskId: 'task-A' });
      });

      expect(result.current.pendingTasks).toHaveLength(1);
      expect(result.current.pendingTasks[0].taskId).toBe('task-B');
    });

    test('filters by batchId', () => {
      const { result } = renderHook(() => useGenerationState());

      act(() => {
        result.current.setPendingTasks([
          makePendingTask({ id: 'temp-1', batchId: 'batch-X' }),
          makePendingTask({ id: 'temp-2', batchId: 'batch-Y' }),
          makePendingTask({ id: 'temp-3', batchId: 'batch-X' }),
        ]);
      });

      act(() => {
        result.current.removePendingTask({ batchId: 'batch-X' });
      });

      expect(result.current.pendingTasks).toHaveLength(1);
      expect(result.current.pendingTasks[0].batchId).toBe('batch-Y');
    });

    test('no-op when identifier matches nothing', () => {
      const { result } = renderHook(() => useGenerationState());

      act(() => {
        result.current.setPendingTasks([
          makePendingTask({ id: 'temp-1' }),
        ]);
      });

      act(() => {
        result.current.removePendingTask({ tempId: 'nonexistent' });
      });

      expect(result.current.pendingTasks).toHaveLength(1);
    });

    test('no-op when called with empty identifier', () => {
      const { result } = renderHook(() => useGenerationState());

      act(() => {
        result.current.setPendingTasks([
          makePendingTask({ id: 'temp-1' }),
        ]);
      });

      act(() => {
        result.current.removePendingTask({});
      });

      expect(result.current.pendingTasks).toHaveLength(1);
    });
  });

  describe('updatePendingTaskBatchId', () => {
    const makePendingTask = (overrides: Partial<PendingTask> = {}): PendingTask => ({
      id: 'temp-1',
      prompt: 'test prompt',
      imageCount: 1,
      timestamp: Date.now(),
      ...overrides,
    });

    test('updates batchId of the task matching tempId', () => {
      const { result } = renderHook(() => useGenerationState());

      act(() => {
        result.current.setPendingTasks([
          makePendingTask({ id: 'temp-1' }),
          makePendingTask({ id: 'temp-2' }),
        ]);
      });

      act(() => {
        result.current.updatePendingTaskBatchId('temp-1', 'new-batch-id');
      });

      const updated = result.current.pendingTasks.find(t => t.id === 'temp-1');
      expect(updated?.batchId).toBe('new-batch-id');
    });

    test('does not modify other tasks', () => {
      const { result } = renderHook(() => useGenerationState());

      act(() => {
        result.current.setPendingTasks([
          makePendingTask({ id: 'temp-1', batchId: 'old-batch' }),
          makePendingTask({ id: 'temp-2', batchId: 'keep-this' }),
        ]);
      });

      act(() => {
        result.current.updatePendingTaskBatchId('temp-1', 'new-batch');
      });

      const other = result.current.pendingTasks.find(t => t.id === 'temp-2');
      expect(other?.batchId).toBe('keep-this');
    });

    test('no-op when tempId does not match any task', () => {
      const { result } = renderHook(() => useGenerationState());

      act(() => {
        result.current.setPendingTasks([
          makePendingTask({ id: 'temp-1' }),
        ]);
      });

      act(() => {
        result.current.updatePendingTaskBatchId('nonexistent', 'batch-id');
      });

      expect(result.current.pendingTasks[0].batchId).toBeUndefined();
    });
  });

  describe('batchHasFailedImages', () => {
    const makeBatch = (images: Array<{ error?: string }>): BatchResult => ({
      batchId: 'batch-1',
      images: images.map((img, index) => ({
        index,
        url: img.error ? undefined : 'http://example.com/img.jpg',
        error: img.error,
        isLoading: false,
      })),
      prompt: 'test',
      timestamp: Date.now(),
      imageCount: images.length,
      status: 'completed',
    });

    test('returns true when at least one image has an error', () => {
      const { result } = renderHook(() => useGenerationState());

      const batch = makeBatch([{ error: undefined }, { error: 'failed' }]);
      expect(result.current.batchHasFailedImages(batch)).toBe(true);
    });

    test('returns false when no images have errors', () => {
      const { result } = renderHook(() => useGenerationState());

      const batch = makeBatch([{}, {}, {}]);
      expect(result.current.batchHasFailedImages(batch)).toBe(false);
    });

    test('returns true when all images have errors', () => {
      const { result } = renderHook(() => useGenerationState());

      const batch = makeBatch([{ error: 'err1' }, { error: 'err2' }]);
      expect(result.current.batchHasFailedImages(batch)).toBe(true);
    });

    test('returns false for batch with empty images array', () => {
      const { result } = renderHook(() => useGenerationState());

      const batch = makeBatch([]);
      expect(result.current.batchHasFailedImages(batch)).toBe(false);
    });
  });
});
