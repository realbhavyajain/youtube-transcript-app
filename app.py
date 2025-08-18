from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi
import re
import requests
from bs4 import BeautifulSoup
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.units import inch
import io
import os
from urllib.parse import urlparse, parse_qs

app = Flask(__name__)
CORS(app)

# Production configuration
app.config['JSON_AS_ASCII'] = False
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False

def extract_video_id(url):
    """Extract YouTube video ID from various URL formats"""
    # Handle different YouTube URL formats
    if 'youtube.com/watch' in url:
        parsed_url = urlparse(url)
        return parse_qs(parsed_url.query).get('v', [None])[0]
    elif 'youtu.be/' in url:
        return url.split('youtu.be/')[-1].split('?')[0]
    elif 'youtube.com/embed/' in url:
        return url.split('youtube.com/embed/')[-1].split('?')[0]
    else:
        return None

def get_video_info(video_id):
    """Get video thumbnail and title"""
    try:
        # Get video info from YouTube
        url = f"https://www.youtube.com/watch?v={video_id}"
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract thumbnail
        thumbnail_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
        
        # Extract title
        title_tag = soup.find('meta', property='og:title')
        title = title_tag['content'] if title_tag else "YouTube Video"
        
        return {
            'thumbnail': thumbnail_url,
            'title': title
        }
    except Exception as e:
        return {
            'thumbnail': f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
            'title': "YouTube Video"
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/transcript', methods=['POST'])
def get_transcript():
    try:
        data = request.get_json()
        youtube_url = data.get('url')
        show_timestamps = data.get('showTimestamps', True)
        
        if not youtube_url:
            return jsonify({'error': 'URL is required'}), 400
        
        video_id = extract_video_id(youtube_url)
        if not video_id:
            return jsonify({'error': 'Invalid YouTube URL'}), 400
        
        # Get transcript using the new instance-based API
        api = YouTubeTranscriptApi()
        transcript_list = api.fetch(video_id)
        
        # Format transcript
        formatted_transcript = []
        full_text = ""
        
        for entry in transcript_list:
            start_time = int(entry.start)
            minutes = start_time // 60
            seconds = start_time % 60
            timestamp = f"{minutes:02d}:{seconds:02d}"
            
            formatted_transcript.append({
                'timestamp': timestamp,
                'text': entry.text,
                'start': start_time
            })
            
            if show_timestamps:
                full_text += f"[{timestamp}] {entry.text}\n"
            else:
                full_text += f"{entry.text}\n"
        
        # Get video info
        video_info = get_video_info(video_id)
        
        return jsonify({
            'success': True,
            'video_id': video_id,
            'transcript': formatted_transcript,
            'full_text': full_text,
            'video_info': video_info
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/export/txt', methods=['POST'])
def export_txt():
    try:
        data = request.get_json()
        transcript_text = data.get('transcript', '')
        video_title = data.get('title', 'YouTube Transcript')
        show_timestamps = data.get('showTimestamps', True)
        
        # Create text file
        output = io.StringIO()
        output.write(f"Transcript: {video_title}\n")
        output.write("=" * 50 + "\n\n")
        
        # Process transcript text based on timestamp preference
        if show_timestamps:
            output.write(transcript_text)
        else:
            # Remove timestamps from the text
            lines = transcript_text.split('\n')
            clean_lines = []
            for line in lines:
                if line.strip():
                    # Remove timestamp pattern [00:00] from the beginning
                    clean_line = re.sub(r'^\[\d{2}:\d{2}\]\s*', '', line)
                    clean_lines.append(clean_line)
            output.write('\n'.join(clean_lines))
        
        output.seek(0)
        
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/plain',
            as_attachment=True,
            download_name=f"{video_title[:50]}_transcript.txt"
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/export/pdf', methods=['POST'])
def export_pdf():
    try:
        data = request.get_json()
        transcript_text = data.get('transcript', '')
        video_title = data.get('title', 'YouTube Transcript')
        show_timestamps = data.get('showTimestamps', True)
        
        # Create PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        story = []
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            spaceAfter=20,
            alignment=1  # Center alignment
        )
        
        # Add title
        story.append(Paragraph(f"Transcript: {video_title}", title_style))
        story.append(Spacer(1, 20))
        
        # Add transcript based on timestamp preference
        lines = transcript_text.split('\n')
        for line in lines:
            if line.strip():
                if show_timestamps:
                    story.append(Paragraph(line, styles['Normal']))
                else:
                    # Remove timestamp pattern [00:00] from the beginning
                    clean_line = re.sub(r'^\[\d{2}:\d{2}\]\s*', '', line)
                    story.append(Paragraph(clean_line, styles['Normal']))
                story.append(Spacer(1, 6))
        
        doc.build(story)
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"{video_title[:50]}_transcript.pdf"
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Get port from environment variable (for production) or use 5000 for development
    port = int(os.environ.get('PORT', 5000))
    
    # Use 0.0.0.0 for production (allows external connections)
    # Use 127.0.0.1 for development (localhost only)
    host = '0.0.0.0' if os.environ.get('RENDER') else '127.0.0.1'
    
    # Debug mode only in development
    debug = not os.environ.get('RENDER')
    
    app.run(host=host, port=port, debug=debug)
