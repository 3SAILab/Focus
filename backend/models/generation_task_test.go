package models

import (
	"testing"
	"testing/quick"
	"time"
)

// **Feature: generation-persistence, Property 2: Task Completion State Transition**
// *For any* task that completes successfully, the task status SHALL transition from
// "processing" to "completed" and the image_url field SHALL be non-empty.
// **Validates: Requirements 1.2**
func TestProperty_TaskCompletionStateTransition(t *testing.T) {
	// Property: For any non-empty imageURL, completing a processing task
	// results in status "completed" and non-empty image_url
	property := func(imageURL string) bool {
		// Skip empty imageURLs as they are invalid inputs
		if imageURL == "" {
			return true
		}

		task := &GenerationTask{
			TaskID:    "test-task-id",
			Status:    TaskStatusProcessing,
			Type:      GenerationTypeCreate,
			Prompt:    "test prompt",
			StartedAt: time.Now(),
		}

		success := task.CompleteTask(imageURL)

		// Property assertions:
		// 1. CompleteTask should succeed for processing tasks with non-empty imageURL
		// 2. Status should be "completed"
		// 3. ImageURL should be the provided value (non-empty)
		return success &&
			task.Status == TaskStatusCompleted &&
			task.ImageURL == imageURL &&
			task.ImageURL != ""
	}

	if err := quick.Check(property, &quick.Config{MaxCount: 100}); err != nil {
		t.Errorf("Property 2 (Task Completion State Transition) failed: %v", err)
	}
}

// **Feature: generation-persistence, Property 3: Task Failure State Transition**
// *For any* task that fails, the task status SHALL transition from "processing"
// to "failed" and the error_msg field SHALL be non-empty.
// **Validates: Requirements 1.3**
func TestProperty_TaskFailureStateTransition(t *testing.T) {
	// Property: For any non-empty errorMsg, failing a processing task
	// results in status "failed" and non-empty error_msg
	property := func(errorMsg string) bool {
		// Skip empty errorMsgs as they are invalid inputs
		if errorMsg == "" {
			return true
		}

		task := &GenerationTask{
			TaskID:    "test-task-id",
			Status:    TaskStatusProcessing,
			Type:      GenerationTypeCreate,
			Prompt:    "test prompt",
			StartedAt: time.Now(),
		}

		success := task.FailTask(errorMsg)

		// Property assertions:
		// 1. FailTask should succeed for processing tasks with non-empty errorMsg
		// 2. Status should be "failed"
		// 3. ErrorMsg should be the provided value (non-empty)
		return success &&
			task.Status == TaskStatusFailed &&
			task.ErrorMsg == errorMsg &&
			task.ErrorMsg != ""
	}

	if err := quick.Check(property, &quick.Config{MaxCount: 100}); err != nil {
		t.Errorf("Property 3 (Task Failure State Transition) failed: %v", err)
	}
}

// Additional property tests for state transition invariants

// Test that completed tasks cannot transition to other states
func TestProperty_CompletedTaskCannotTransition(t *testing.T) {
	property := func(imageURL, errorMsg string) bool {
		if imageURL == "" {
			return true
		}

		task := &GenerationTask{
			TaskID:    "test-task-id",
			Status:    TaskStatusProcessing,
			Type:      GenerationTypeCreate,
			Prompt:    "test prompt",
			StartedAt: time.Now(),
		}

		// Complete the task first
		task.CompleteTask(imageURL)

		// Try to transition again - should fail
		canComplete := task.CanTransitionTo(TaskStatusCompleted)
		canFail := task.CanTransitionTo(TaskStatusFailed)
		canProcess := task.CanTransitionTo(TaskStatusProcessing)

		return !canComplete && !canFail && !canProcess
	}

	if err := quick.Check(property, &quick.Config{MaxCount: 100}); err != nil {
		t.Errorf("Completed task transition invariant failed: %v", err)
	}
}

// Test that failed tasks cannot transition to other states
func TestProperty_FailedTaskCannotTransition(t *testing.T) {
	property := func(errorMsg string) bool {
		if errorMsg == "" {
			return true
		}

		task := &GenerationTask{
			TaskID:    "test-task-id",
			Status:    TaskStatusProcessing,
			Type:      GenerationTypeCreate,
			Prompt:    "test prompt",
			StartedAt: time.Now(),
		}

		// Fail the task first
		task.FailTask(errorMsg)

		// Try to transition again - should fail
		canComplete := task.CanTransitionTo(TaskStatusCompleted)
		canFail := task.CanTransitionTo(TaskStatusFailed)
		canProcess := task.CanTransitionTo(TaskStatusProcessing)

		return !canComplete && !canFail && !canProcess
	}

	if err := quick.Check(property, &quick.Config{MaxCount: 100}); err != nil {
		t.Errorf("Failed task transition invariant failed: %v", err)
	}
}

// Test that empty values are rejected
func TestProperty_EmptyValuesRejected(t *testing.T) {
	// Test that CompleteTask rejects empty imageURL
	task1 := &GenerationTask{
		TaskID:    "test-task-id",
		Status:    TaskStatusProcessing,
		Type:      GenerationTypeCreate,
		StartedAt: time.Now(),
	}
	if task1.CompleteTask("") {
		t.Error("CompleteTask should reject empty imageURL")
	}
	if task1.Status != TaskStatusProcessing {
		t.Error("Status should remain processing when CompleteTask fails")
	}

	// Test that FailTask rejects empty errorMsg
	task2 := &GenerationTask{
		TaskID:    "test-task-id",
		Status:    TaskStatusProcessing,
		Type:      GenerationTypeCreate,
		StartedAt: time.Now(),
	}
	if task2.FailTask("") {
		t.Error("FailTask should reject empty errorMsg")
	}
	if task2.Status != TaskStatusProcessing {
		t.Error("Status should remain processing when FailTask fails")
	}
}
