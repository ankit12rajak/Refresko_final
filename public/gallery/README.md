# Gallery Images

This folder contains all the images displayed in the Refresko Gallery.

## How to Add Images

1. **Upload your images** to this folder (`public/gallery/`)

2. **Supported formats:**
   - JPG/JPEG
   - PNG
   - WEBP
   - GIF

3. **Recommended specifications:**
   - Resolution: 1200x900px or higher
   - Aspect ratio: 4:3 recommended
   - File size: Under 2MB for optimal loading

4. **Update the Gallery component:**
   - Open: `src/components/Gallery/Gallery.jsx`
   - Find the `galleryImages` array
   - Add your images following this format:

   ```javascript
   {
     id: 9,
     src: '/gallery/your-image-name.jpg',
     alt: 'Description of image',
     category: 'events', // options: 'events', 'team', 'workshops'
     title: 'Image Title'
   }
   ```

## Image Categories

- **events**: Main event photos, performances, ceremonies
- **team**: Team photos, group photos, organizers
- **workshops**: Workshop sessions, training, seminars

## Example File Structure

```
gallery/
├── event1.jpg
├── event2.jpg
├── team1.jpg
├── workshop1.jpg
└── README.md
```

## Tips

- Use descriptive file names (e.g., `opening-ceremony-2026.jpg`)
- Keep file names lowercase with hyphens
- Optimize images before uploading to reduce load time
- Remove any unused images to keep the folder organized
