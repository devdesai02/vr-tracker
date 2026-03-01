import imaplib
import smtplib
import email
import json
import os
from email.mime.text import MIMEText
from datetime import datetime

# --- CONFIGURATION ---
GMAIL_USER = "desaidev2423@gmail.com"
GMAIL_APP_PASS = "glljqpbwftdmxyjy" # 16-character code
KEYWORDS = 'TEXT "VR request"'
INVENTORY_FILE = os.path.expanduser("~/vr_management/vr_inventory.json")

REPLY_BODY = """Hi,

Thanks for your request! We have received your inquiry regarding the VR headset for your event.

You can track our current device availability and updates here:
https://your-tracking-website.com/v1/status

Our team will follow up with you shortly.

Best regards,
VR Inventory Bot"""

def update_inventory_log(sender_email):
    try:
        with open(INVENTORY_FILE, 'r') as f:
            data = json.load(f)
        
        # Add a new log entry for the request
        request_entry = {
            "type": "request",
            "from": sender_email,
            "timestamp": datetime.now().isoformat()
        }
        
        # Check if we have a 'requests' list, if not create it
        if isinstance(data, list):
            data.append(request_entry)
        
        with open(INVENTORY_FILE, 'w') as f:
            json.dump(data, f, indent=2)
            
        print(f"Logged request from: {sender_email}")
    except Exception as e:
        print(f"Failed to log request: {e}")

def push_to_github():
    try:
        print("Syncing with GitHub...")
        os.chdir(os.path.expanduser("~/vr_management"))
        # Add, commit, and push the updated JSON
        os.system('git add vr_inventory.json')
        os.system('git commit -m "Auto-update: New VR request received [bot]"')
        os.system('git push origin main')
        print("GitHub updated successfully.")
    except Exception as e:
        print(f"Failed to push to GitHub: {e}")

def process_emails():
    try:
        # 1. Connect to IMAP (Read)
        print(f"Connecting to imap.gmail.com as {GMAIL_USER}...")
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(GMAIL_USER, GMAIL_APP_PASS)
        print("Login successful.")
        
        mail.select("inbox")
        print(f"Searching for unread emails with criteria: {KEYWORDS}")
        
        # Search for unread emails with keywords
        status, messages = mail.search(None, f'(UNSEEN {KEYWORDS})')
        
        processed_any = False
        
        if status != 'OK' or not messages[0]:
            print("No new/unseen VR requests found.")
        else:
            # 2. Connect to SMTP (Send)
            print("Connecting to smtp.gmail.com...")
            server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
            server.login(GMAIL_USER, GMAIL_APP_PASS)
            
            for msg_id in messages[0].split():
                res, msg_data = mail.fetch(msg_id, "(RFC822)")
                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        msg = email.message_from_bytes(response_part[1])
                        sender = msg['From']
                        subject = msg['Subject']
                        msg_id_header = msg['Message-ID']

                        print(f"Processing request from: {sender}")

                        # Create Reply
                        reply = MIMEText(REPLY_BODY)
                        reply['Subject'] = f"Re: {subject}"
                        reply['To'] = sender
                        reply['In-Reply-To'] = msg_id_header
                        reply['References'] = msg_id_header

                        server.sendmail(GMAIL_USER, sender, reply.as_string())
                        print(f"Sent auto-reply to {sender}")
                        
                        update_inventory_log(sender)
                        processed_any = True

            server.quit()
            
        if processed_any:
            push_to_github()

        mail.logout()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    process_emails()
