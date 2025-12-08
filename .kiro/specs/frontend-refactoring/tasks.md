# Implementation Plan

- [x] 1. Create custom hooks for reusable logic



  - [x] 1.1 Create useModal hook


    - Create `frontend/src/hooks/useModal.ts`
    - Implement isOpen state, open, close, toggle functions
    - Export the hook
    - _Requirements: 10.1, 10.3_


  - [x] 1.2 Create useImageUpload hook
    - Create `frontend/src/hooks/useImageUpload.ts`
    - Implement file state, previewUrl state, setFile, handleFileSelect, handleUrlLoad, clear functions
    - Handle URL.createObjectURL and URL.revokeObjectURL lifecycle
    - Implement cleanup on unmount
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 1.3 Write property test for useImageUpload lifecycle

    - **Property 11: useImageUpload lifecycle**
    - **Validates: Requirements 5.2, 5.3, 5.4**
  - [x] 1.4 Create useDragDrop hook


    - Create `frontend/src/hooks/useDragDrop.ts`
    - Implement isDragging state and dragProps (onDragOver, onDragLeave, onDrop)
    - Handle file filtering (only image files)
    - Handle URL detection and loading
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 1.5 Write property test for useDragDrop drag state

    - **Property 15: useDragDrop drag state**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 1.6 Write property test for useDragDrop file filtering

    - **Property 16: useDragDrop file filtering**
    - **Validates: Requirements 6.4**

- [x] 2. Create base Modal component





  - [x] 2.1 Create Modal component


    - Create `frontend/src/components/common/Modal.tsx`
    - Implement backdrop, animation, header (icon, title, close button), content slot, footer slot
    - Support closable prop for click outside and Escape key handling
    - Support maxWidth, borderColor, headerBgClass props
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [x] 2.2 Write property test for Modal closable behavior


    - **Property 1: Modal closable behavior**
    - **Validates: Requirements 1.5, 1.6**
  - [x] 2.3 Write property test for Modal header rendering


    - **Property 2: Modal header rendering**
    - **Validates: Requirements 1.3**

- [x] 3. Checkpoint - Ensure all tests pass






  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create common UI components





  - [x] 4.1 Create PageHeader component


    - Create `frontend/src/components/common/PageHeader.tsx`
    - Implement sticky header with blur backdrop
    - Support title with colored status dot
    - Support optional GenerationCounter
    - Support custom right content and back button
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 4.2 Write property test for PageHeader title rendering


    - **Property 7: PageHeader title rendering**
    - **Validates: Requirements 3.2**
  - [x] 4.3 Create GenerateButton component


    - Create `frontend/src/components/common/GenerateButton.tsx`
    - Implement consistent button styling with color variants
    - Support isGenerating state with spinner
    - Support disabled state with opacity
    - Support custom text and icon
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 4.4 Write property test for GenerateButton disabled states

    - **Property 21: GenerateButton disabled states**
    - **Validates: Requirements 9.2, 9.3**
  - [x] 4.5 Create ImageUploadZone component


    - Create `frontend/src/components/common/ImageUploadZone.tsx`
    - Integrate useImageUpload and useDragDrop hooks
    - Implement empty state with icon and text
    - Implement preview state with image and clear button
    - Support context menu on preview image
    - Support different aspect ratios and accent colors
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 4.6 Write property test for ImageUploadZone drag feedback

    - **Property 3: ImageUploadZone drag feedback**
    - **Validates: Requirements 2.2**

  - [x] 4.7 Write property test for ImageUploadZone file drop handling
    - **Property 4: ImageUploadZone file drop handling**

    - **Validates: Requirements 2.3**
  - [x] 4.8 Create HistorySection component

    - Create `frontend/src/components/common/HistorySection.tsx`
    - Implement white card container with title
    - Integrate HistoryImageGrid component
    - Support empty state message
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 4.9 Write property test for HistorySection data rendering

    - **Property 19: HistorySection data rendering**
    - **Validates: Requirements 8.2**

  - [x] 4.10 Create QuotaErrorHandler component

    - Create `frontend/src/components/common/QuotaErrorHandler.tsx`
    - Combine QuotaErrorAlert and ContactModal
    - Handle state transitions between modals
    - _Requirements: 10.1, 10.2, 10.3_


  - [x] 4.11 Write property test for QuotaErrorHandler state management
    - **Property 23: QuotaErrorHandler state management**
    - **Validates: Requirements 10.1, 10.3**
  - [x] 4.12 Create common components index file



    - Create `frontend/src/components/common/index.ts`
    - Export all common components
    - _Requirements: All_

- [x] 5. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Extend error handling utility






  - [x] 6.1 Extend parseApiError function

    - Update `frontend/src/utils/errorHandler.ts`
    - Add support for nested error formats
    - Add quota error detection with keywords
    - Return ParsedError interface with message and isQuotaError
    - _Requirements: 7.1, 7.2, 7.3_


  - [x] 6.2 Write property test for error parsing consistency





    - **Property 18: Error parsing consistency**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 7. Refactor modal components to use base Modal





  - [x] 7.1 Refactor ContactModal


    - Update `frontend/src/components/ContactModal.tsx`
    - Use base Modal component
    - Remove duplicate backdrop and animation code
    - _Requirements: 1.1, 1.2, 1.3, 1.4_


  - [x] 7.2 Refactor DisclaimerModal
    - Update `frontend/src/components/DisclaimerModal.tsx`
    - Use base Modal component
    - Keep countdown and agree logic
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 7.3 Refactor QuotaErrorAlert


    - Update `frontend/src/components/QuotaErrorAlert.tsx`
    - Use base Modal component
    - Keep warning styling with borderColor prop
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 7.4 Refactor ShadowOptionDialog


    - Update `frontend/src/components/ShadowOptionDialog.tsx`
    - Use base Modal component
    - Keep radio button selection logic
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 7.5 Refactor ApiKeyModal


    - Update `frontend/src/components/ApiKeyModal.tsx`
    - Use base Modal component
    - Keep form submission logic
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 8. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Refactor WhiteBackground view






  - [x] 9.1 Refactor WhiteBackground to use new components

    - Update `frontend/src/views/WhiteBackground.tsx`
    - Replace header with PageHeader component
    - Replace upload area with ImageUploadZone component
    - Replace generate button with GenerateButton component
    - Replace history section with HistorySection component
    - Replace quota error handling with QuotaErrorHandler component
    - Use useImageUpload hook for file management
    - _Requirements: 2.1-2.7, 3.1-3.4, 8.1-8.3, 9.1-9.4, 10.1-10.3_

- [x] 10. Refactor ClothingChange view






  - [x] 10.1 Refactor ClothingChange to use new components

    - Update `frontend/src/views/ClothingChange.tsx`
    - Replace header with PageHeader component
    - Replace upload areas with ImageUploadZone components
    - Replace generate button with GenerateButton component
    - Replace history section with HistorySection component
    - Replace quota error handling with QuotaErrorHandler component
    - Use useImageUpload hook for model and clothing file management
    - _Requirements: 2.1-2.7, 3.1-3.4, 8.1-8.3, 9.1-9.4, 10.1-10.3_

- [x] 11. Refactor Create view






  - [x] 11.1 Refactor Create to use new components

    - Update `frontend/src/views/Create.tsx`
    - Replace header with PageHeader component
    - Replace quota error handling with QuotaErrorHandler component
    - _Requirements: 3.1-3.4, 10.1-10.3_

- [x] 12. Refactor History views






  - [x] 12.1 Refactor History view

    - Update `frontend/src/views/History.tsx`
    - Replace header with PageHeader component
    - _Requirements: 3.1-3.4_




  - [x] 12.2 Refactor HistoryDetail view



    - Update `frontend/src/views/HistoryDetail.tsx`
    - Replace header with PageHeader component (with back button)
    - _Requirements: 3.1-3.4_


- [x] 13. Final Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Cleanup and verification






  - [x] 14.1 Remove unused code

    - Review all refactored files for unused imports
    - Remove any dead code
    - Verify no duplicate logic remains
    - _Requirements: All_


  - [ ] 14.2 Verify all functionality works
    - Test WhiteBackground page functionality
    - Test ClothingChange page functionality
    - Test Create page functionality
    - Test History pages functionality
    - Test all modal dialogs
    - _Requirements: All_
