/**
 * Property-based tests for useGenerationState hook
 *
 * Feature: code-structure-refactor
 * Properties 11-14: removePendingTask filtering, updatePendingTaskBatchId,
 * batchHasFailedImages, hook interface completeness
 *
 * @vitest-environment jsdom
 */

import { describe, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { useGenerationState } from './useGenerationState';
import type { PendingTask } from './useGroupedHistory';
import type { BatchResult } from '../type/generation';

const pendingTaskArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  prompt: fc.string({ minLength: 1, maxLength: 20 }),
  imageCount: fc.integer({ min: 1, max: 10 }),
  timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
  taskId: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
  batchId: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
}) as fc.Arbitrary<PendingTask>;

describe('useGenerationState property tests', () => {
  /**
   * Feature: code-structure-refactor, Property 11: removePendingTask filters correctly
   * **Validates: Requirements 5.3**
   */
  test('Property 11: removePendingTask filters correctly by tempId, taskId, or batchId', () => {
    fc.assert(
      fc.property(
        fc.array(pendingTaskArb, { minLength: 1, maxLength: 5 }),
        fc.constantFrom('tempId', 'taskId', 'batchId'),
        (tasks, identifierType) => {
          // Pick a target task to remove
          const targetIndex = 0;
          const target = tasks[targetIndex];

          const { result } = renderHook(() => useGenerationState());

          act(() => {
            result.current.setPendingTasks(tasks);
          });

          let identifier: { tempId?: string; taskId?: string; batchId?: string } = {};
          let expectedRemaining: PendingTask[];

          if (identifierType === 'tempId') {
            identifier = { tempId: target.id };
            expectedRemaining = tasks.filter(t => t.id !== target.id);
          } else if (identifierType === 'taskId' && target.taskId) {
            identifier = { taskId: target.taskId };
            expectedRemaining = tasks.filter(t => t.taskId !== target.taskId);
          } else if (identifierType === 'batchId' && target.batchId) {
            identifier = { batchId: target.batchId };
            expectedRemaining = tasks.filter(t => t.batchId !== target.batchId);
          } else {
            // If the target doesn't have the identifier field, use tempId as fallback
            identifier = { tempId: target.id };
            expectedRemaining = tasks.filter(t => t.id !== target.id);
          }

          act(() => {
            result.current.removePendingTask(identifier);
          });

          expect(result.current.pendingTasks.length).toBe(expectedRemaining.length);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: code-structure-refactor, Property 12: updatePendingTaskBatchId updates only matching task
   * **Validates: Requirements 5.4**
   */
  test('Property 12: updatePendingTaskBatchId updates only matching task', () => {
    fc.assert(
      fc.property(
        fc.array(pendingTaskArb, { minLength: 2, maxLength: 5 })
          .filter(tasks => new Set(tasks.map(t => t.id)).size === tasks.length),
        fc.string({ minLength: 1, maxLength: 10 }),
        (tasks, newBatchId) => {
          const targetId = tasks[0].id;

          const { result } = renderHook(() => useGenerationState());

          act(() => {
            result.current.setPendingTasks(tasks);
          });

          act(() => {
            result.current.updatePendingTaskBatchId(targetId, newBatchId);
          });

          // The target task should have the new batchId
          const updated = result.current.pendingTasks.find(t => t.id === targetId);
          expect(updated?.batchId).toBe(newBatchId);

          // All other tasks should be unchanged
          for (const task of result.current.pendingTasks) {
            if (task.id !== targetId) {
              const original = tasks.find(t => t.id === task.id);
              expect(task.batchId).toBe(original?.batchId);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: code-structure-refactor, Property 13: batchHasFailedImages detects errors correctly
   * **Validates: Requirements 5.5**
   */
  test('Property 13: batchHasFailedImages returns true iff any image has truthy error', () => {
    const imageArb = fc.record({
      index: fc.integer({ min: 0, max: 10 }),
      url: fc.option(fc.webUrl(), { nil: undefined }),
      error: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
      isLoading: fc.boolean(),
    });

    const batchArb = fc.record({
      batchId: fc.string({ minLength: 1, maxLength: 10 }),
      images: fc.array(imageArb, { minLength: 1, maxLength: 5 }),
      prompt: fc.string({ minLength: 1, maxLength: 20 }),
      timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
      imageCount: fc.integer({ min: 1, max: 5 }),
      status: fc.constantFrom('streaming', 'completed', 'failed') as fc.Arbitrary<'streaming' | 'completed' | 'failed'>,
    }) as fc.Arbitrary<BatchResult>;

    fc.assert(
      fc.property(
        batchArb,
        (batch) => {
          const { result } = renderHook(() => useGenerationState());

          const hasError = batch.images.some(img => !!img.error);
          const hookResult = result.current.batchHasFailedImages(batch);

          expect(hookResult).toBe(hasError);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: code-structure-refactor, Property 14: useGenerationState exports complete interface
   * **Validates: Requirements 5.2**
   */
  test('Property 14: hook exports complete interface with all 9 keys', () => {
    const expectedKeys = [
      'pendingTasks', 'setPendingTasks',
      'batchResults', 'setBatchResults',
      'failedGenerations', 'setFailedGenerations',
      'removePendingTask', 'updatePendingTaskBatchId', 'batchHasFailedImages',
    ];

    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const { result } = renderHook(() => useGenerationState());

          for (const key of expectedKeys) {
            expect(result.current).toHaveProperty(key);
          }
          expect(Object.keys(result.current)).toHaveLength(9);
        }
      ),
      { numRuns: 20 }
    );
  });
});
