import imaplib
import smtplib
import email
import json
import os
import csv
import re
from email.mime.text import MIMEText
from datetime import datetime

# --- CONFIGURATION ---
GMAIL_USER = os.environ.get("GMAIL_USER")
GMAIL_APP_PASS = os.environ.get("GMAIL_APP_PASS")
INVITE_KEYWORDS = 'TEXT "VR request"'
CONFIRM_KEYWORDS = 'SUBJECT "Selection Confirmed:"'
# Use relative paths for GitHub Actions
INVENTORY_FILE = "vr_inventory.json"
LOG_FILE = "requests_log.csv"

REPLY_BODY = """Hi,

Thanks for your request! We have received your inquiry regarding the VR headset for your event.

A copy of this request has been sent to desaidev242003@gmail.com for tracking.

Please select your device and confirm your details here:
https://devdesai02.github.io/vr-tracker/

Once you've confirmed, we'll finalize your request.

Best regards,
VR Inventory Bot"""

def log_to_csv(data):
    file_exists = os.path.isfile(LOG_FILE)
    with open(LOG_FILE, mode='a', newline='') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["Timestamp", "Name", "Email", "Event", "Location", "Date", "Device ID", "Model"])
        writer.writerow([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            data.get('Name', 'N/A'),
            data.get('Email', 'N/A'),
            data.get('Event', 'N/A'),
            data.get('Location', 'N/A'),
            data.get('Date', 'N/A'),
            data.get('ID', 'N/A'),
            data.get('Model', 'N/A')
        ])

def update_inventory(device_id, event_info):
    try:
        with open(INVENTORY_FILE, 'r') as f:
            data = json.load(f)
        for item in data:
            if item.get('id') == device_id:
                item['status'] = 'Not Available'
                item['last_event'] = event_info
        with open(INVENTORY_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Inventory Update Error: {e}")

def push_to_github(msg):
    try:
        os.chdir(os.path.expanduser("~/vr_management"))
        os.system('git add .')
        os.system(f'git commit -m "{msg}"')
        os.system('git push origin main')
        print("GitHub updated successfully.")
    except Exception as e:
        print(f"GitHub Sync Error: {e}")

def parse_confirmation(body, sender_email):
    # Basic regex to extract fields from the email body
    data = {'Email': sender_email}
    patterns = {
        'ID': r"\(VR-\d+\)",
        'Model': r"Selected Device: (.+) \(",
        'Name': r"Name: (.+)",
        'Event': r"Event: (.+)",
        'Location': r"Location: (.+)",
        'Date': r"Date: (.+)"
    }
    for key, pattern in patterns.items():
        match = re.search(pattern, body)
        if match:
            data[key] = match.group(1).strip()
            if key == 'ID': data[key] = data[key].replace('(', '').replace(')', '')
    return data

def process_emails():
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(GMAIL_USER, GMAIL_APP_PASS)
        mail.select("inbox")

        # 1. Process Invitations (New Requests)
        status, messages = mail.search(None, f'(UNSEEN {INVITE_KEYWORDS})')
        if status == 'OK' and messages[0]:
            server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
            server.login(GMAIL_USER, GMAIL_APP_PASS)
            for msg_id in messages[0].split():
                res, msg_data = mail.fetch(msg_id, "(RFC822)")
                msg = email.message_from_bytes(msg_data[0][1])
                sender = msg['From']
                reply = MIMEText(REPLY_BODY)
                reply['Subject'] = f"Re: {msg['Subject']}"
                reply['To'] = sender
                reply['Cc'] = "desaidev242003@gmail.com"
                server.sendmail(GMAIL_USER, [sender, "desaidev242003@gmail.com"], reply.as_string())
                print(f"Invite sent to {sender}")
            server.quit()

        # 2. Process Confirmations (Selections made on website)
        status, messages = mail.search(None, f'(UNSEEN {CONFIRM_KEYWORDS})')
        if status == 'OK' and messages[0]:
            for msg_id in messages[0].split():
                res, msg_data = mail.fetch(msg_id, "(RFC822)")
                msg = email.message_from_bytes(msg_data[0][1])
                body = msg.get_payload(decode=True).decode()
                sender = email.utils.parseaddr(msg['From'])[1]
                
                data = parse_confirmation(body, sender)
                if data.get('ID'):
                    update_inventory(data['ID'], f"{data['Event']} @ {data['Location']} (By: {data['Name']})")
                    log_to_csv(data)
                    push_to_github(f"Bot: Confirmation from {data['Name']} for {data['ID']}")
                    print(f"Selection processed for {data['ID']}")

        mail.logout()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    import time
    # Check every 60 seconds for 5 minutes (Total 5 checks)
    for _ in range(5):
        print(f"Checking for requests at {datetime.now().strftime('%H:%M:%S')}...")
        process_emails()
        time.sleep(60)

