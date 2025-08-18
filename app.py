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
import random
import time

app = Flask(__name__)
CORS(app)

# Production configuration
app.config['JSON_AS_ASCII'] = False
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False

# List of free proxy servers (you can add more)
PROXY_LIST = [
    None,  # Direct connection (no proxy)
    # Add more proxies here if needed
]

def get_random_proxy():
    """Get a random proxy from the list"""
    return random.choice(PROXY_LIST)

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
        
        # Try multiple approaches to get transcript
        transcript_list = None
        error_message = ""
        
        # Approach 1: Try with different proxies
        for attempt in range(3):
            try:
                proxy = get_random_proxy()
                api = YouTubeTranscriptApi()
                
                if proxy:
                    # Configure proxy if available
                    api.proxies = {'http': proxy, 'https': proxy}
                
                transcript_list = api.fetch(video_id)
                break  # Success, exit the loop
                
            except Exception as e:
                error_message = str(e)
                time.sleep(1)  # Wait before retry
                continue
        
        # Approach 2: If still failing, try with different user agents
        if transcript_list is None:
            user_agents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            ]
            
            for user_agent in user_agents:
                try:
                    api = YouTubeTranscriptApi()
                    api.headers = {'User-Agent': user_agent}
                    transcript_list = api.fetch(video_id)
                    break
                except Exception as e:
                    error_message = str(e)
                    time.sleep(1)
                    continue
        
        if transcript_list is None:
            return jsonify({
                'error': f'Could not retrieve transcript. This might be due to:\n\n1. YouTube blocking requests from cloud servers\n2. The video has no available transcript\n3. The video is private or restricted\n\nTechnical details: {error_message}\n\nTry using the app locally or contact support for assistance.'
            }), 500
        
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
            'transcript': formatted_transcript,
            'full_text': full_text,
            'video_info': video_info,
            'success': True
        })
        
    except Exception as e:
        return jsonify({
            'error': f'An unexpected error occurred: {str(e)}\n\nThis might be due to YouTube blocking requests from cloud servers. Try using the app locally for better results.'
        }), 500

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
