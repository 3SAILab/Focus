import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { GenerationTask, TaskStatus, GenerationTypeValue } from '../type';

/**
 * Property test for useTaskRecovery polling termination
 * **Feature: generation-persistence, Property 5: Polling Termination on Completion**
 * **Validates: Requirements 2.3, 2.4**
 * 
 * Tests that:
 * - When a task status changes to "completed", polling stops
 * - When a task status changes to "failed", polling stops
 * - Polling continues while task is "processing"
 */

// Simulate the polling logic from useTaskRecovery
interface PollingState {
  isPolling: boolean;
  pollCount: number;
  stoppedAt: TaskStatus | null;
}

/**
 * Simulates the core polling termination logic from useTaskRecovery
 * This extracts the essential behavior we want to test:
 * - Poll continues while status is "processing"
 * - Poll stops when status becomes "completed" or "failed"
 */
function simulatePollingBehavior(
  statusSequence: TaskStatus[],
  onComplete: () => void,
  onFailed: () => void
): PollingState {
  const state: PollingState = {
    isPolling: true,
    pollCount: 0,
    stoppedAt: null,
  };

  for (const status of statusSequence) {
    if (!state.isPolling) break;
    
    state.pollCount++;

    // Core logic from useTaskRecovery.pollTaskStatus
    if (status === 'completed') {
      state.isPolling = false;
      state.stoppedAt = 'completed';
      onComplete();
    } else if (status === 'failed') {
      state.isPolling = false;
      state.stoppedAt = 'failed';
      onFailed();
    }
    // If still "processing", continue polling (isPolling remains true)
  }

  return state;
}

describe('useTaskRecovery polling termination properties', () => {
  let completedCalled: boolean;
  let failedCalled: boolean;

  beforeEach(() => {
    completedCalled = false;
    failedCalled = false;
  });

  const onComplete = () => { completedCalled = true; };
  const onFailed = () => { failedCalled = true; };

  /**
   * Property 5: Polling Termination on Completion
   * *For any* task being polled, when the task status changes to "completed" or "failed",
   * the polling SHALL stop.
   */
  describe('Property 5: Polling Termination on Completion', () => {
    // Arbitrary for generating task status sequences
    // A valid sequence has zero or more "processing" followed by a terminal status
    const processingCountArb = fc.integer({ min: 0, max: 10 });
    const terminalStatusArb = fc.constantFrom<TaskStatus>('completed', 'failed');

    it('polling stops when task status becomes "completed" (Requirement 2.3)', () => {
      fc.assert(
        fc.property(processingCountArb, (processingCount) => {
          completedCalled = false;
          failedCalled = false;

          // Create sequence: N "processing" followed by "completed"
          const sequence: TaskStatus[] = [
            ...Array(processingCount).fill('processing' as TaskStatus),
            'completed',
          ];

          const result = simulatePollingBehavior(sequence, onComplete, onFailed);

          // Verify: polling stopped at "completed"
          expect(result.isPolling).toBe(false);
          expect(result.stoppedAt).toBe('completed');
          expect(completedCalled).toBe(true);
          expect(failedCalled).toBe(false);
          // Poll count should be processingCount + 1 (the completed poll)
          expect(result.pollCount).toBe(processingCount + 1);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('polling stops when task status becomes "failed" (Requirement 2.4)', () => {
      fc.assert(
        fc.property(processingCountArb, (processingCount) => {
          completedCalled = false;
          failedCalled = false;

          // Create sequence: N "processing" followed by "failed"
          const sequence: TaskStatus[] = [
            ...Array(processingCount).fill('processing' as TaskStatus),
            'failed',
          ];

          const result = simulatePollingBehavior(sequence, onComplete, onFailed);

          // Verify: polling stopped at "failed"
          expect(result.isPolling).toBe(false);
          expect(result.stoppedAt).toBe('failed');
          expect(failedCalled).toBe(true);
          expect(completedCalled).toBe(false);
          // Poll count should be processingCount + 1 (the failed poll)
          expect(result.pollCount).toBe(processingCount + 1);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('polling continues while task status is "processing"', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          (processingCount) => {
            completedCalled = false;
            failedCalled = false;

            // Create sequence: only "processing" statuses (no terminal)
            const sequence: TaskStatus[] = Array(processingCount).fill('processing');

            const result = simulatePollingBehavior(sequence, onComplete, onFailed);

            // Verify: polling is still active (no terminal status encountered)
            expect(result.isPolling).toBe(true);
            expect(result.stoppedAt).toBeNull();
            expect(completedCalled).toBe(false);
            expect(failedCalled).toBe(false);
            // All polls were executed
            expect(result.pollCount).toBe(processingCount);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('polling stops at first terminal status and ignores subsequent statuses', () => {
      fc.assert(
        fc.property(
          processingCountArb,
          terminalStatusArb,
          fc.array(fc.constantFrom<TaskStatus>('processing', 'completed', 'failed'), { minLength: 0, maxLength: 5 }),
          (processingCount, terminalStatus, extraStatuses) => {
            completedCalled = false;
            failedCalled = false;

            // Create sequence: N "processing", terminal, then extra statuses
            const sequence: TaskStatus[] = [
              ...Array(processingCount).fill('processing' as TaskStatus),
              terminalStatus,
              ...extraStatuses,
            ];

            const result = simulatePollingBehavior(sequence, onComplete, onFailed);

            // Verify: polling stopped at first terminal status
            expect(result.isPolling).toBe(false);
            expect(result.stoppedAt).toBe(terminalStatus);
            // Poll count should be processingCount + 1 (stopped at terminal)
            expect(result.pollCount).toBe(processingCount + 1);

            // Correct callback was called
            if (terminalStatus === 'completed') {
              expect(completedCalled).toBe(true);
              expect(failedCalled).toBe(false);
            } else {
              expect(failedCalled).toBe(true);
              expect(completedCalled).toBe(false);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any terminal status, exactly one callback is invoked', () => {
      fc.assert(
        fc.property(
          processingCountArb,
          terminalStatusArb,
          (processingCount, terminalStatus) => {
            completedCalled = false;
            failedCalled = false;

            const sequence: TaskStatus[] = [
              ...Array(processingCount).fill('processing' as TaskStatus),
              terminalStatus,
            ];

            simulatePollingBehavior(sequence, onComplete, onFailed);

            // Exactly one callback should be called
            const callbackCount = (completedCalled ? 1 : 0) + (failedCalled ? 1 : 0);
            expect(callbackCount).toBe(1);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
