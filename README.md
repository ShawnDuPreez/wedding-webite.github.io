# 📰 Zimri & Shawn Wedding Website

A beautiful, newspaper-themed wedding website with a built-in disposable camera feature for guests to capture and share moments from the celebration.

![Newspaper Theme](https://img.shields.io/badge/Theme-Newspaper-1a1a1a?style=for-the-badge)
![Date](https://img.shields.io/badge/Date-September%2010%2C%202026-c9a961?style=for-the-badge)

## ✨ Features

### 📰 Newspaper Design
- Authentic vintage newspaper aesthetic with masthead, headlines, and columns
- Beautiful typography using Playfair Display, EB Garamond, and decorative fonts
- Animated breaking news ticker
- Elegant ornaments and vintage styling throughout

### ⏰ Wedding Day Timeline
- **1:00 PM - 3:00 PM**: The Ceremony
- **3:00 PM - 5:00 PM**: Photo Session & Cocktail Hour
- **5:00 PM - 9:00 PM**: Reception & Celebration

### 📸 Disposable Camera
- **Built-in camera interface** that looks like a real disposable camera
- Each guest can take **up to 10 photos**
- Photos save instantly to the live gallery
- Mobile-friendly with front/back camera toggle
- Fallback to file upload if camera access is denied

### 🎞️ Live Photo Gallery
- Real-time photo display as guests take pictures
- Paginated gallery (8 photos per page)
- Lightbox view for full-size images
- Live status indicator showing "LIVE"
- Guest photo counter

### 💝 PayPal Registry
- Primary PayPal contribution option prominently displayed
- Alternative registry links (Amazon, Target, etc.)
- Beautiful card-based layout

### 📋 Additional Features
- **RSVP Form** with meal preferences and dietary restrictions
- **Q&A Accordion** with common wedding questions
- **Countdown Timer** to the big day
- **Photo Catalogue** for engagement and memory photos
- **Smooth animations** and scroll effects
- **Fully responsive** design for all devices

## 🚀 Getting Started

### 1. Clone or Download
```bash
git clone <repository-url>
cd wedding-website
```

### 2. Open Locally
Simply open `index.html` in your browser, or use a local server:
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```

### 3. Customize
Edit the HTML file to add:
- Your actual photos (replace placeholder images)
- Venue details and address
- PayPal link (replace `https://paypal.me/zimriandshawn`)
- Registry links
- Contact information

## 🗄️ Supabase Integration (Future)

The website is ready for Supabase integration. Here's how to set it up:

### 1. Create Supabase Project
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Initialize project
supabase init
```

### 2. Database Schema
```sql
-- Create photos table
CREATE TABLE photos (
    id BIGSERIAL PRIMARY KEY,
    guest_id TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RSVPs table
CREATE TABLE rsvps (
    id BIGSERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    attending BOOLEAN NOT NULL,
    guests INTEGER,
    meal TEXT,
    dietary TEXT,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all inserts" ON photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all selects" ON photos FOR SELECT USING (true);
CREATE POLICY "Allow all inserts" ON rsvps FOR INSERT WITH CHECK (true);
```

### 3. Storage Bucket
Create a storage bucket named `wedding-photos` with public access.

### 4. JavaScript Configuration
Uncomment the Supabase section in `script.js` and add your credentials:
```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-key';
```

### 5. Include Supabase Client
Add to HTML head:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

## 📁 File Structure

```
wedding-website/
├── index.html          # Main HTML file
├── styles.css          # All styles and animations
├── script.js           # All JavaScript functionality
└── README.md           # This file
```

## 🎨 Customization Guide

### Colors
Edit CSS variables in `styles.css`:
```css
:root {
    --paper-white: #faf8f3;
    --paper-cream: #f5f0e6;
    --ink-black: #1a1a1a;
    --accent-gold: #c9a961;
    /* ... */
}
```

### Fonts
The website uses Google Fonts:
- **Playfair Display**: Headlines and titles
- **EB Garamond**: Body text
- **UnifrakturMaguntia**: Decorative newspaper text
- **Inter**: UI elements

### Wedding Details
Search for these placeholders in `index.html`:
- `September 10th, 2026` - Date
- `123 Wedding Lane` - Venue address
- `zimriandshawn@wedding.com` - Email
- `https://paypal.me/zimriandshawn` - PayPal link

## 📱 Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ iOS Safari
- ✅ Chrome Android

Camera functionality requires HTTPS in production (except localhost).

## 🔒 Privacy

- Photos are stored in browser's localStorage temporarily
- Guest IDs are randomly generated and stored locally
- No data is sent to any server until Supabase is configured
- Users have full control over their photos

## 💡 Tips for Guests

1. **Enable camera access** when prompted for the best experience
2. **You have 10 photos** - use them wisely!
3. **Photos appear instantly** in the gallery below
4. **Tap photos** to view them in full size
5. **Works offline** - photos save locally even without internet

## 🐛 Troubleshooting

### Camera not working?
- Ensure you're on HTTPS (or localhost)
- Check browser permissions
- Try the upload option instead
- Refresh the page and try again

### Photos not saving?
- Check browser's localStorage isn't full
- Try clearing some old photos
- Ensure cookies are enabled

### Layout issues?
- Clear browser cache
- Try a different browser
- Check console for errors

## 📄 License

This project is for personal use for Zimri and Shawn's wedding.

## 🙏 Credits

- Fonts: Google Fonts
- Icons: Emoji
- Design: Newspaper theme inspiration

---

Made with 💕 for Zimri & Shawn's special day!
