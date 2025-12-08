# Application Icons

This directory contains the application icons for different platforms.

## Required Icon Files

### Windows
- **File**: `icon.ico`
- **Format**: ICO file with multiple resolutions
- **Recommended sizes**: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256
- **Tools**: 
  - [IcoFX](https://icofx.ro/) (Windows)
  - [ImageMagick](https://imagemagick.org/): `convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico`

### macOS
- **File**: `icon.icns`
- **Format**: ICNS file with multiple resolutions
- **Recommended sizes**: 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024
- **Tools**:
  - [Image2Icon](https://img2icnsapp.com/) (macOS)
  - [iconutil](https://developer.apple.com/library/archive/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/Optimizing/Optimizing.html) (built-in macOS tool)

### Linux
- **File**: `icon.png`
- **Format**: PNG file
- **Recommended size**: 512x512 or 1024x1024
- **Note**: Should have transparent background

## How to Replace Icons

### Step 1: Create Your Icon Design
- Start with a 1024x1024 PNG with transparent background
- Use simple, recognizable design that works at small sizes
- Test visibility on both light and dark backgrounds
- Save as a high-quality PNG file

### Step 2: Convert to Platform-Specific Formats

#### For Windows (.ico)
```bash
# Using ImageMagick
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```
Or use [IcoFX](https://icofx.ro/) or online converters.

#### For macOS (.icns)
```bash
# Using iconutil (macOS only)
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
```
Or use [Image2Icon](https://img2icnsapp.com/) app.

#### For Linux (.png)
Simply use your 512x512 or 1024x1024 PNG file directly.

### Step 3: Place Files in Assets Directory
Replace the placeholder files with your actual icons:
- `assets/icon.ico` (Windows)
- `assets/icon.icns` (macOS) - remove the .placeholder file
- `assets/icon.png` (Linux) - remove the .placeholder file

### Step 4: Rebuild the Application
```bash
npm run build
```

The electron-builder will automatically use the icons from this directory.

## Current Status

This directory contains:
- ✅ `icon.ico` - Windows icon (placeholder - replace before distribution)
- ⚠️ `icon.icns.placeholder` - macOS icon placeholder (needs to be created)
- ⚠️ `icon.png.placeholder` - Linux icon placeholder (needs to be created)

**Important**: Replace all placeholder icons with your actual application icons before building for distribution.

## Quick Start

If you want to build the application without custom icons, you can:
1. Use the existing `icon.ico` as-is (it's a basic placeholder)
2. For macOS and Linux builds, you'll need to create the icon files or the build will fail

For production releases, follow the complete icon replacement process below.

## Icon Design Guidelines

- Use a simple, recognizable design
- Ensure the icon looks good at small sizes (16x16, 32x32)
- Use high contrast for better visibility
- Avoid fine details that may not be visible at smaller sizes
- Test the icon on different backgrounds (light and dark)
- Consider platform-specific design guidelines:
  - Windows: Flat, modern design
  - macOS: Rounded corners, subtle shadows
  - Linux: Varies by desktop environment

## Recommended Icon Conversion Tools

### Online Tools (Cross-platform)
- [CloudConvert](https://cloudconvert.com/) - Supports ICO, ICNS, PNG conversions
- [AConvert](https://www.aconvert.com/icon/) - Free online icon converter
- [ICO Convert](https://icoconvert.com/) - Specialized for ICO files
- [Favicon.io](https://favicon.io/) - Simple PNG to ICO converter

### Desktop Tools

#### Windows
- **IcoFX** (https://icofx.ro/) - Professional icon editor
- **GIMP** (https://www.gimp.org/) - Free, with ICO plugin
- **ImageMagick** (https://imagemagick.org/) - Command-line tool

#### macOS
- **Image2Icon** (https://img2icnsapp.com/) - Drag-and-drop ICNS creator
- **iconutil** - Built-in macOS command-line tool
- **Pixelmator Pro** - Professional image editor with ICNS export
- **Sketch** - Design tool with icon export capabilities

#### Linux
- **GIMP** (https://www.gimp.org/) - Free image editor
- **ImageMagick** - Command-line conversion
- **Inkscape** (https://inkscape.org/) - Vector graphics editor

### Command-Line Quick Reference

#### ImageMagick (All platforms)
```bash
# Install ImageMagick first
# Windows: choco install imagemagick
# macOS: brew install imagemagick
# Linux: sudo apt install imagemagick

# Create Windows ICO
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# Create multiple PNG sizes for macOS
for size in 16 32 64 128 256 512 1024; do
  convert icon.png -resize ${size}x${size} icon_${size}.png
done
```

#### macOS iconutil
```bash
# Complete script to create ICNS from PNG
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
rm -rf icon.iconset
```

## Troubleshooting

### Icon Not Showing After Build

**Problem**: The application still shows the default Electron icon after building.

**Solutions**:
1. Clear the build cache: `rm -rf dist release`
2. Rebuild: `npm run build`
3. Verify icon files exist in `assets/` directory
4. Check `package.json` build configuration points to correct icon paths
5. On macOS, clear icon cache: `sudo rm -rf /Library/Caches/com.apple.iconservices.store`

### ICO File Not Working on Windows

**Problem**: Windows installer doesn't show the icon.

**Solutions**:
1. Ensure ICO file contains multiple resolutions (16, 32, 48, 64, 128, 256)
2. Verify ICO file is not corrupted (open in an image viewer)
3. Use a proper ICO creation tool (not just renaming PNG to ICO)
4. Check file size - very large ICO files may cause issues

### ICNS File Not Working on macOS

**Problem**: macOS app doesn't show the icon.

**Solutions**:
1. Ensure ICNS file contains all required sizes
2. Use `iconutil` or proper ICNS creation tool
3. Remove `.placeholder` extension if present
4. Verify file permissions: `chmod 644 assets/icon.icns`
5. Clear icon cache and rebuild

### Icon Looks Blurry

**Problem**: Icon appears blurry or pixelated at certain sizes.

**Solutions**:
1. Start with a high-resolution source (1024x1024 or larger)
2. Use vector graphics (SVG) as source when possible
3. Ensure all required sizes are included in ICO/ICNS
4. Use proper anti-aliasing when resizing
5. Test icon at all target sizes before finalizing

## Resources

- [Electron Icon Guidelines](https://www.electron.build/icons)
- [Windows Icon Design](https://docs.microsoft.com/en-us/windows/apps/design/style/iconography/app-icon-design)
- [macOS Icon Design](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Icon Design Best Practices](https://www.electronjs.org/docs/latest/tutorial/application-distribution#icon-requirements)
