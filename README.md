# 🎥 YouTube Transcript Extractor

A beautiful, modern web application that extracts transcripts from YouTube videos with stunning glassmorphism design and 3D effects.

## ✨ Features

- **🎯 Smart URL Processing**: Just paste any YouTube URL and get instant results
- **📝 Rich Transcript Display**: Clean, formatted transcripts with optional timestamps
- **🎨 Modern Design**: Glassmorphism + 3D elements with dark theme
- **📱 Responsive**: Works perfectly on desktop and mobile
- **💾 Multiple Export Options**: Download as TXT or PDF files
- **⚡ Real-time Effects**: Interactive 3D animations and particle systems
- **🌙 Dark Theme**: Easy on the eyes with beautiful gradients

## 🚀 Live Demo

**Coming Soon!** - Deploying to Render for free access worldwide.

## 🛠️ Tech Stack

- **Backend**: Python Flask
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **YouTube API**: youtube-transcript-api
- **PDF Generation**: ReportLab
- **Design**: Glassmorphism, 3D Transforms, CSS Animations

## 🏃‍♂️ Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd youtube-transcript-app
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**
   ```bash
   python app.py
   ```

4. **Open in browser**
   ```
   http://localhost:5000
   ```

### Production Deployment

#### Option 1: Render (Recommended - Free)

1. **Fork/Clone this repository to your GitHub**

2. **Sign up for Render** (free at render.com)

3. **Create New Web Service**
   - Connect your GitHub repository
   - Select the repository
   - Choose "Python" as environment
   - Set build command: `pip install -r requirements.txt`
   - Set start command: `gunicorn app:app`

4. **Deploy!** Your app will be live in 5-10 minutes

#### Option 2: Railway

1. **Sign up for Railway** (railway.app)
2. **Connect GitHub repository**
3. **Auto-deploy** - Railway detects Flask apps automatically

#### Option 3: Heroku

1. **Install Heroku CLI**
2. **Login and create app**
   ```bash
   heroku login
   heroku create your-app-name
   git push heroku main
   ```

## 📁 Project Structure

```
youtube-transcript-app/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── Procfile              # Production server configuration
├── runtime.txt           # Python version specification
├── templates/
│   └── index.html        # Main frontend template
├── README.md             # This file
├── .gitignore           # Git ignore rules
└── start.bat            # Windows startup script
```

## 🔌 API Endpoints

- `GET /` - Main application page
- `POST /api/transcript` - Extract transcript from YouTube URL
- `POST /api/export/txt` - Export transcript as TXT file
- `POST /api/export/pdf` - Export transcript as PDF file

## 🎨 Design Features

- **Glassmorphism**: Translucent glass-like elements with backdrop blur
- **3D Transforms**: Interactive perspective and rotation effects
- **Particle System**: Dynamic background particles and glow effects
- **Smooth Animations**: CSS transitions and keyframe animations
- **Dark Theme**: Beautiful gradient backgrounds and neon accents
- **Responsive Design**: Perfect on all screen sizes

## 🔧 Customization

### Changing Colors
Edit the CSS variables in `templates/index.html`:
```css
:root {
  --primary-color: #6366f1;
  --secondary-color: #8b5cf6;
  --background-dark: #0f0f23;
}
```

### Adding New Export Formats
Extend the Flask app in `app.py` with new routes for different file formats.

## 🐛 Troubleshooting

### Common Issues

1. **"YouTubeTranscriptApi has no attribute 'get_transcript'"**
   - This is fixed in the current version using the new API structure

2. **"Unable to extract video ID"**
   - Ensure the YouTube URL is valid and public
   - Check if the video has captions/transcripts available

3. **Export fails**
   - Ensure all dependencies are installed: `pip install -r requirements.txt`

### Development vs Production

- **Development**: Uses Flask's built-in server with debug mode
- **Production**: Uses Gunicorn WSGI server for better performance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 👨‍💻 Built by

**Bhavya 🚀** - Creating beautiful, functional web applications

---

⭐ **Star this repository if you find it helpful!**
