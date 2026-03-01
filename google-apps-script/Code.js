/**
 * VR Tracker Master Bridge (PRO - SMART LIFECYCLE)
 * Managed by VR Inventory Bot via Clasp
 */

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  var ccEmail = "desaidev242003@gmail.com";
  var repo = "devdesai02/vr-tracker";
  var photoFolderId = "1njDIUbohdWyqW5J5_l5nZw2_6K5x7mb-";
  var timestamp = new Date().toISOString();

  // 1. Fetch current Inventory and Logs from GitHub
  var inventoryUrl = "https://api.github.com/repos/" + repo + "/contents/vr_inventory.json";
  var logUrl = "https://api.github.com/repos/" + repo + "/contents/requests_log.csv";
  
  var invRes = UrlFetchApp.fetch(inventoryUrl, { headers: { "Authorization": "token " + token } });
  var invData = JSON.parse(invRes.getContentText());
  var inventory = JSON.parse(Utilities.newBlob(Utilities.base64Decode(invData.content)).getDataAsString());

  var logRes = UrlFetchApp.fetch(logUrl, { headers: { "Authorization": "token " + token } });
  var logFileData = JSON.parse(logRes.getContentText());
  var logs = Utilities.newBlob(Utilities.base64Decode(logFileData.content)).getDataAsString();

  var photoUrl = "N/A";
  var targetUserEmail = "";
  var targetUserName = "";
  var emailBody = "";
  var emailSubject = "";

  if (data.type === 'checkout') {
    // --- CHECKOUT LOGIC ---
    targetUserEmail = data.email;
    targetUserName = data.person;
    emailSubject = "Selection Confirmed: " + data.deviceId;
    emailBody = "Hi " + targetUserName + ",\n\nRequest Confirmed for " + data.model + ".\n\n" +
                "--- Details ---\n" +
                "Device ID: " + data.deviceId + "\n" +
                "Event: " + data.event + "\n" +
                "Location: " + data.location + "\n" +
                "Return Due Date: " + data.returnDate + "\n\n" +
                "Thank you!\nVR Inventory Bot";

    // Update Inventory JSON locally
    inventory.forEach(function(item) {
      if (item.id === data.deviceId) {
        item.status = "Not Available";
        item.last_event = data.event + " (Due: " + data.returnDate + ")";
        item.borrower_name = data.person;
        item.borrower_email = data.email;
        item.event_name = data.event;
        item.location = data.location;
        item.return_date = data.returnDate;
      }
    });

  } else if (data.type === 'return') {
    // --- RETURN LOGIC (SMART FETCH) ---
    var borrowerInfo = {};
    inventory.forEach(function(item) {
      if (item.id === data.deviceId) {
        borrowerInfo = item;
        item.status = "Available";
        item.last_event = "Available";
        // Clear borrower info
        delete item.borrower_name; delete item.borrower_email; delete item.event_name; 
        delete item.location; delete item.return_date;
      }
    });

    targetUserEmail = borrowerInfo.borrower_email || "desaidev2423@gmail.com";
    targetUserName = borrowerInfo.borrower_name || "Borrower";
    
    if (data.photo) {
      try {
        var folder = DriveApp.getFolderById(photoFolderId);
        var file = folder.createFile(data.photoName, Utilities.base64Decode(data.photo), MimeType.JPEG);
        photoUrl = file.getUrl();
      } catch(e) { photoUrl = "Error"; }
    }

    emailSubject = "Return Confirmed: " + data.deviceId;
    emailBody = "Hi " + targetUserName + ",\n\nReturn Confirmed for " + data.model + ".\n\n" +
                "--- Return Details ---\n" +
                "Device ID: " + data.deviceId + "\n" +
                "Original Event: " + (borrowerInfo.event_name || "N/A") + "\n" +
                "Returned On: " + timestamp.split('T')[0] + "\n" +
                "Condition Photo: " + photoUrl + "\n\n" +
                "Thank you for returning the device!\nVR Inventory Bot";
  }

  // 2. Push updated CSV Log back to GitHub
  var newLogRow = [timestamp, targetUserName, targetUserEmail, data.event||"N/A", data.location||"N/A", data.returnDate||"N/A", data.deviceId, data.model, data.type.toUpperCase(), photoUrl].join(",");
  var updatedLogs = logs.trim() + "\n" + newLogRow;
  UrlFetchApp.fetch(logUrl, {
    method: "put",
    headers: { "Authorization": "token " + token, "Content-Type": "application/json" },
    payload: JSON.stringify({ message: "Bot: Update log [" + data.type + "]", content: Utilities.base64Encode(updatedLogs, Utilities.Charset.UTF_8), sha: logFileData.sha })
  });

  // 3. Push updated Inventory JSON back to GitHub
  UrlFetchApp.fetch(inventoryUrl, {
    method: "put",
    headers: { "Authorization": "token " + token, "Content-Type": "application/json" },
    payload: JSON.stringify({ message: "Bot: Update inventory [" + data.type + "]", content: Utilities.base64Encode(JSON.stringify(inventory, null, 2), Utilities.Charset.UTF_8), sha: invData.sha })
  });

  // 4. Send the Email
  try {
    GmailApp.sendEmail(targetUserEmail, emailSubject, emailBody, { cc: ccEmail, name: "VR Bot" });
  } catch(err) { console.log("Mail Failed: " + err.message); }

  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

// --- INSTANT HANDSHAKE LOGIC ---
function instantHandshake() {
  var threads = GmailApp.search('is:unread VR'); 
  var websiteUrl = "https://devdesai02.github.io/vr-tracker/";
  var ccEmail = "desaidev242003@gmail.com";

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var lastMsg = messages[messages.length - 1];
    var content = (lastMsg.getSubject() + " " + lastMsg.getPlainBody()).toLowerCase();
    
    if (lastMsg.isUnread() && content.indexOf("request") !== -1 && lastMsg.getFrom().indexOf("VR Inventory Bot") === -1) {
      lastMsg.reply("Hi,\n\nThanks for your VR request! Please select your device and confirm your details here:\n" + websiteUrl + "\n\nBest regards,\nVR Inventory Bot", { cc: ccEmail, name: "VR Inventory Bot" });
      threads[i].markRead();
    }
  }
}
