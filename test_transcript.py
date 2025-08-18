#!/usr/bin/env python3
"""
Test script for TranscriptFlow YouTube transcript extraction
"""

import requests
import json

def test_transcript_extraction():
    """Test the transcript extraction API"""
    
    # Test URL (a popular YouTube video)
    test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    
    print("🧪 Testing TranscriptFlow API...")
    print(f"Test URL: {test_url}")
    print("-" * 50)
    
    try:
        # Test transcript extraction
        response = requests.post(
            'http://localhost:5000/api/transcript',
            json={'url': test_url},
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Transcript extraction successful!")
            print(f"Video Title: {data['video_info']['title']}")
            print(f"Video ID: {data['video_id']}")
            print(f"Transcript segments: {len(data['transcript'])}")
            print(f"First segment: {data['transcript'][0]['text'][:100]}...")
            
            # Test export functionality
            print("\n📄 Testing export functionality...")
            
            # Test TXT export
            txt_response = requests.post(
                'http://localhost:5000/api/export/txt',
                json={
                    'transcript': data['full_text'],
                    'title': data['video_info']['title']
                },
                headers={'Content-Type': 'application/json'}
            )
            
            if txt_response.status_code == 200:
                print("✅ TXT export successful!")
            else:
                print("❌ TXT export failed")
            
            # Test PDF export
            pdf_response = requests.post(
                'http://localhost:5000/api/export/pdf',
                json={
                    'transcript': data['full_text'],
                    'title': data['video_info']['title']
                },
                headers={'Content-Type': 'application/json'}
            )
            
            if pdf_response.status_code == 200:
                print("✅ PDF export successful!")
            else:
                print("❌ PDF export failed")
                
        else:
            print(f"❌ API request failed with status {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to the server. Make sure the Flask app is running on localhost:5000")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_transcript_extraction()
