# 🚀 Getting Started with TranscriptFlow

## 🎯 Quick Start (3 Steps)

### 1. **Install Dependencies**
```bash
pip install -r requirements.txt
```

### 2. **Start the Application**
```bash
python app.py
```
*Or double-click `start.bat` on Windows*

### 3. **Open Your Browser**
Navigate to: `http://localhost:5000`

## 🎬 How to Use

1. **Paste a YouTube URL** in the input field
2. **Click "Extract Transcript"** 
3. **View the beautiful results** with video thumbnail and transcript
4. **Export** as TXT or PDF files

## 🧪 Test the Application

Run the test script to verify everything works:
```bash
python test_transcript.py
```

## 🌟 Features You'll Love

- ✨ **Beautiful Design**: Modern, aesthetic interface
- 🎥 **Video Info**: Thumbnail and title display
- 📝 **Smart Transcripts**: Timestamped and formatted
- 📄 **Export Options**: TXT and PDF downloads
- 📱 **Mobile Friendly**: Works perfectly on all devices

## 🔧 Troubleshooting

### **Port Already in Use**
If you get a port error, change the port in `app.py`:
```python
app.run(debug=True, host='0.0.0.0', port=5001)  # Change 5000 to 5001
```

### **Dependencies Issues**
Make sure you have Python 3.8+ and try:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### **YouTube API Issues**
Some videos may not have transcripts available. Try different videos.

## 🎨 Customization

The design is fully customizable through the CSS in `templates/index.html`:
- Change colors in the CSS variables
- Modify fonts and spacing
- Adjust animations and effects

## 📱 Mobile Usage

The app is fully responsive and works great on:
- 📱 Smartphones
- 📱 Tablets  
- 💻 Laptops
- 🖥️ Desktop computers

---

**🎬 Ready to transform your YouTube experience? Start using TranscriptFlow now!**
