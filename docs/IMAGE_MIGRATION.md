# Image Migration Guide

## Current Status

Your images are currently in the root `/public/images/` folder. This guide will help you organize them into the new folder structure.

## Step-by-Step Migration

### 1. Move Logo Files

Move these files from `/public/images/` to `/public/images/logos/`:

```
MoEYS logo.png          → logos/MoEYS logo.png
FOED logo.PNG          → logos/FOED logo.PNG
world bank.png         → logos/world bank.png
IMG_5840.PNG           → logos/IMG_5840.PNG
MoEys(New) (3).png     → logos/MoEys(New) (3).png
```

**Quick Command (Windows PowerShell):**
```powershell
cd public\images
Move-Item "MoEYS logo.png" logos\
Move-Item "FOED logo.PNG" logos\
Move-Item "world bank.png" logos\
Move-Item "IMG_5840.PNG" logos\
Move-Item "MoEys(New) (3).png" logos\
```

**Quick Command (Git Bash):**
```bash
cd public/images
mv "MoEYS logo.png" logos/
mv "FOED logo.PNG" logos/
mv "world bank.png" logos/
mv "IMG_5840.PNG" logos/
mv "MoEys(New) (3).png" logos/
```

### 2. Add Promotional Image

When you download the MOEYS EDTECH Version 2.0 poster:

1. Save it as `moeys-edtech-v2-poster.jpg` in `/public/images/promotional/`
2. Update `lib/images.ts`:

```typescript
promotional: {
  version2: '/images/promotional/moeys-edtech-v2-poster.jpg',
}
```

### 3. Update Code References

After moving files, update `lib/images.ts`:

```typescript
logos: {
  moeys: '/images/logos/MoEYS logo.png',
  foed: '/images/logos/FOED logo.PNG',
  worldBank: '/images/logos/world bank.png',
  partner: '/images/logos/IMG_5840.PNG',
}
```

### 4. Test

After migration:
1. Restart your dev server
2. Check that all images load correctly
3. Verify the login page displays properly

## Folder Structure After Migration

```
public/images/
├── logos/
│   ├── MoEYS logo.png
│   ├── FOED logo.PNG
│   ├── world bank.png
│   ├── IMG_5840.PNG
│   └── MoEys(New) (3).png
├── promotional/
│   └── moeys-edtech-v2-poster.jpg (add this)
├── banners/
├── avatars/
├── icons/
└── thumbnails/
```

## Notes

- The current code still works with images in the root folder
- You can migrate gradually - move images as needed
- Update `lib/images.ts` paths when you move files
- Keep filenames consistent (use lowercase with hyphens when possible)

