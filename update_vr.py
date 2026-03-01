import json
import sys
import os

def update_vr(device_id, person, event, location):
    inventory_file = os.path.expanduser("~/vr_management/vr_inventory.json")
    
    try:
        with open(inventory_file, 'r') as f:
            data = json.load(f)
        
        found = False
        for item in data:
            if item.get('id') == device_id:
                item['status'] = 'Not Available'
                item['last_event'] = f"{event} @ {location} (By: {person})"
                found = True
                break
        
        if not found:
            print(f"Error: Device {device_id} not found.")
            return

        with open(inventory_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"Successfully updated {device_id}. Syncing with GitHub...")
        
        # Sync to GitHub
        os.chdir(os.path.expanduser("~/vr_management"))
        os.system('git add vr_inventory.json')
        os.system(f'git commit -m "Checkout: {device_id} for {event}"')
        os.system('git push origin main')
        print("Done! Website will update in 30 seconds.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: python3 update_vr.py <ID> <Person> <Event> <Location>")
    else:
        update_vr(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
