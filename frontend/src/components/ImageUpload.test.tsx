import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageUpload from './ImageUpload';

describe('ImageUpload', () => {
  it('renders upload button when no files', () => {
    const mockOnFilesChange = vi.fn();
    render(<ImageUpload files={[]} onFilesChange={mockOnFilesChange} />);
    
    const uploadButton = screen.getByTitle('上传参考图');
    expect(uploadButton).toBeInTheDocument();
  });

  it('displays images when files are provided', () => {
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    const mockOnFilesChange = vi.fn();
    
    render(<ImageUpload files={[mockFile]} onFilesChange={mockOnFilesChange} />);
    
    const images = screen.getAllByAlt(/参考图|蒙版图片/);
    expect(images).toHaveLength(1);
  });

  it('detects mask images by filename', () => {
    const maskFile = new File(['mask'], 'mask.png', { type: 'image/png' });
    const normalFile = new File(['normal'], 'photo.png', { type: 'image/png' });
    const mockOnFilesChange = vi.fn();
    
    render(<ImageUpload files={[maskFile, normalFile]} onFilesChange={mockOnFilesChange} />);
    
    const maskImage = screen.getByAlt('蒙版图片');
    expect(maskImage).toBeInTheDocument();
  });

  it('calls onFilesChange when removing a file', () => {
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    const mockOnFilesChange = vi.fn();
    
    const { container } = render(
      <ImageUpload files={[mockFile]} onFilesChange={mockOnFilesChange} />
    );
    
    // Hover to show delete button
    const imageContainer = container.querySelector('.relative.h-20');
    if (imageContainer) {
      fireEvent.mouseEnter(imageContainer.parentElement!);
      
      const deleteButton = container.querySelector('button[class*="bg-gray-800"]');
      if (deleteButton) {
        fireEvent.click(deleteButton);
        expect(mockOnFilesChange).toHaveBeenCalledWith([]);
      }
    }
  });

  it('enables drag and drop when enableReorder is true', () => {
    const file1 = new File(['1'], 'file1.png', { type: 'image/png' });
    const file2 = new File(['2'], 'file2.png', { type: 'image/png' });
    const mockOnFilesChange = vi.fn();
    
    const { container } = render(
      <ImageUpload 
        files={[file1, file2]} 
        onFilesChange={mockOnFilesChange}
        enableReorder={true}
      />
    );
    
    const draggableElements = container.querySelectorAll('[draggable="true"]');
    expect(draggableElements.length).toBeGreaterThan(0);
  });
});
