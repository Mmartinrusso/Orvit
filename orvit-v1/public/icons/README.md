# PWA Icons

This directory should contain the following icon files for the PWA manifest:

- `icon-72x72.png`
- `icon-96x96.png`
- `icon-128x128.png`
- `icon-144x144.png`
- `icon-152x152.png`
- `icon-192x192.png`
- `icon-384x384.png`
- `icon-512x512.png`

## Generate Icons

You can generate these icons from the main logo using various tools:

### Option 1: Online Tool
Use https://realfavicongenerator.net/ or https://www.pwabuilder.com/imageGenerator

### Option 2: Command Line (ImageMagick)
```bash
# Install ImageMagick first
# From the project root with logo-orvit.png

convert public/logo-orvit.png -resize 72x72 public/icons/icon-72x72.png
convert public/logo-orvit.png -resize 96x96 public/icons/icon-96x96.png
convert public/logo-orvit.png -resize 128x128 public/icons/icon-128x128.png
convert public/logo-orvit.png -resize 144x144 public/icons/icon-144x144.png
convert public/logo-orvit.png -resize 152x152 public/icons/icon-152x152.png
convert public/logo-orvit.png -resize 192x192 public/icons/icon-192x192.png
convert public/logo-orvit.png -resize 384x384 public/icons/icon-384x384.png
convert public/logo-orvit.png -resize 512x512 public/icons/icon-512x512.png
```

### Option 3: Node.js Script
```bash
npm install sharp
# Then run a script to generate icons programmatically
```

## Temporary Workaround

Until proper icons are generated, the PWA will function without them, but:
- The "Add to Home Screen" prompt may not work correctly
- The app icon on mobile devices will be a generic icon

To quickly enable PWA installation, you can copy and rename the existing logo:
```bash
copy public\logo-orvit.png public\icons\icon-192x192.png
copy public\logo-orvit.png public\icons\icon-512x512.png
```
