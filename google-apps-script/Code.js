/**
 * VR Tracker Master Bridge (PRO - SMART LIFECYCLE V2.3 - FIX)
 * Managed by VR Inventory Bot via Clasp
 */

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  var ccEmail = "desaidev242003@gmail.com";
  var repo = "devdesai02/vr-tracker";
  var photoFolderId = "1njDIUbohdWyqW5J5_l5nZw2_6K5x7mb-";
  
  var timestamp = new Date();
  var currentDateStr = Utilities.formatDate(timestamp, "GMT+5:30", "yyyy-MM-dd");
  var isoTimestamp = timestamp.toISOString();

  // 1. Fetch current Inventory from GitHub
  var inventoryUrl = "https://api.github.com/repos/" + repo + "/contents/vr_inventory.json";
  var logUrl = "https://api.github.com/repos/" + repo + "/contents/requests_log.csv";
  
  var invRes = UrlFetchApp.fetch(inventoryUrl, { headers: { "Authorization": "token " + token } });
  var invFileData = JSON.parse(invRes.getContentText());
  var inventory = JSON.parse(Utilities.newBlob(Utilities.base64Decode(invFileData.content)).getDataAsString());

  var logRes = UrlFetchApp.fetch(logUrl, { headers: { "Authorization": "token " + token } });
  var logFileData = JSON.parse(logRes.getContentText());
  var logs = Utilities.newBlob(Utilities.base64Decode(logFileData.content)).getDataAsString();

  var photoUrl = "N/A";
  var targetUserEmail = "";
  var targetUserName = "";
  var emailBody = "";
  var emailSubject = "";

  if (data.type === 'checkout') {
    // SAVE THE DATA PROVIDED BY THE WEBSITE FORM
    targetUserEmail = data.email;
    targetUserName = data.person;
    
    emailSubject = "Selection Confirmed: " + data.deviceId;
    emailBody = "Hi " + targetUserName + ",\n\nSelection Confirmed for " + data.model + ".\n\n" +
                "--- Details ---\n" +
                "Device ID: " + data.deviceId + "\n" +
                "Event: " + (data.event || "N/A") + "\n" +
                "Location: " + (data.location || "N/A") + "\n" +
                "From Date: " + (data.startDate || "N/A") + "\n" +
                "To Date: " + (data.endDate || "N/A") + "\n\n" +
                "Thank you!\nVR Inventory Bot";

    inventory.forEach(function(item) {
      if (item.id === data.deviceId) {
        item.status = "Not Available";
        item.last_event = (data.event || "N/A") + " (" + (data.startDate || "N/A") + " to " + (data.endDate || "N/A") + ")";
        // EXPLICITLY STORE THESE FIELDS IN THE JSON
        item.borrower_name = targetUserName;
        item.borrower_email = targetUserEmail;
        item.event_name = data.event || "N/A";
        item.location = data.location || "N/A";
        item.start_date = data.startDate || "N/A";
        item.end_date = data.endDate || "N/A";
      }
    });

  } else if (data.type === 'return') {
    var borrowerInfo = {};
    inventory.forEach(function(item) {
      if (item.id === data.deviceId) {
        borrowerInfo = JSON.parse(JSON.stringify(item));
        item.status = "Available";
        item.last_event = "Available";
        // Reset fields
        item.borrower_name = ""; item.borrower_email = ""; item.event_name = ""; 
        item.location = ""; item.start_date = ""; item.end_date = "";
      }
    });

    // READ THE STORED EMAIL FROM THE JSON
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
                "Period: " + (borrowerInfo.start_date || "N/A") + " to " + (borrowerInfo.end_date || "N/A") + "\n" +
                "Returned On: " + currentDateStr + "\n" +
                "Condition Photo: " + photoUrl + "\n\n" +
                "Thank you for returning the device!\nVR Inventory Bot";
  }

  // 2. Sync Logs CSV
  var logDateRange = (data.type === 'checkout') ? (data.startDate + " to " + data.endDate) : ((borrowerInfo.start_date || "N/A") + " to " + (borrowerInfo.end_date || "N/A"));
  var newLogRow = [isoTimestamp, targetUserName, targetUserEmail, (data.event||borrowerInfo.event_name||"N/A"), (data.location||borrowerInfo.location||"N/A"), logDateRange, data.deviceId, data.model, data.type.toUpperCase(), photoUrl].join(",");
  var updatedLogs = logs.trim() + "\n" + newLogRow;
  
  UrlFetchApp.fetch(logUrl, {
    method: "put",
    headers: { "Authorization": "token " + token, "Content-Type": "application/json" },
    payload: JSON.stringify({ message: "Bot: Update log [" + data.type + "]", content: Utilities.base64Encode(updatedLogs, Utilities.Charset.UTF_8), sha: logFileData.sha })
  });

  // 3. Sync Inventory JSON
  UrlFetchApp.fetch(inventoryUrl, {
    method: "put",
    headers: { "Authorization": "token " + token, "Content-Type": "application/json" },
    payload: JSON.stringify({ message: "Bot: Update inventory [" + data.type + "]", content: Utilities.base64Encode(JSON.stringify(inventory, null, 2), Utilities.Charset.UTF_8), sha: invFileData.sha })
  });

  // 4. Send the Email
  try {
    if (targetUserEmail) {
      GmailApp.sendEmail(targetUserEmail, emailSubject, emailBody, { cc: ccEmail, name: "VR Bot" });
    }
  } catch(err) { console.log("Mail Failed: " + err.message); }

  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

function instantHandshake() {
  var threads = GmailApp.search('is:unread VR'); 
  var websiteUrl = "https://devdesai02.github.io/vr-tracker/";
  var ccEmail = "desaidev242003@gmail.com";
  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var lastMsg = messages[messages.length - 1];
    var content = (lastMsg.getSubject() + " " + lastMsg.getPlainBody()).toLowerCase();
    if (lastMsg.isUnread() && content.indexOf("request") !== -1 && lastMsg.getFrom().indexOf("VR Inventory Bot") === -1) {
      lastMsg.reply("Hi,\n\nThanks for your VR request! Please select your device and confirm your details here:\n" + websiteUrl + "\n\nOnce confirmed, we will finalize your request.\n\nBest regards,\nVR Inventory Bot", { cc: ccEmail, name: "VR Inventory Bot" });
      threads[i].markRead();
    }
  }
}
