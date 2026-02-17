import subprocess
import time
import requests
import sys
import os

def test_app():
    print("Starting Flask app...")
    # Start the app in the background
    process = subprocess.Popen([sys.executable, 'app.py'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    try:
        # Wait for app to start
        time.sleep(5)
        
        print("Sending request to /convert...")
        code = """
from fpdf import FPDF
pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)
pdf.cell(200, 10, txt="Verification Test", ln=1, align="C")
pdf.output("test.pdf")
"""
        response = requests.post('http://127.0.0.1:5000/convert', json={'code': code})
        
        if response.status_code == 200:
            if response.headers.get('Content-Type') == 'application/pdf':
                print("SUCCESS: Received PDF file.")
                with open('verification_output.pdf', 'wb') as f:
                    f.write(response.content)
                print("Saved to verification_output.pdf")
            else:
                print(f"FAILURE: Content-Type is {response.headers.get('Content-Type')}")
                sys.exit(1)
        else:
            print(f"FAILURE: Status code {response.status_code}")
            print(response.text)
            sys.exit(1)
            
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    finally:
        print("Stopping Flask app...")
        process.terminate()
        process.wait()

if __name__ == "__main__":
    test_app()
