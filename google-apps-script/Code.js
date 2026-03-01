/**
 * VR Tracker Master Bridge (PRO - V2.4 - THE FINAL EMAIL FIX)
 * Managed by VR Inventory Bot via Clasp
 */

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  
  // THE CORRECT CC ADDRESS
  var CC_ADDRESS = "desaidev242003@gmail.com"; 
  
  var repo = "devdesai02/vr-tracker";
  var photoFolderId = "1njDIUbohdWyqW5J5_l5nZw2_6K5x7mb-";
  var timestamp = new Date();
  var currentDateStr = Utilities.formatDate(timestamp, "GMT+5:30", "yyyy-MM-dd");

  // 1. Fetch current Inventory from GitHub
  var inventoryUrl = "https://api.github.com/repos/" + repo + "/contents/vr_inventory.json";
  var logUrl = "https://api.github.com/repos/" + repo + "/contents/requests_log.csv";
  
  var invRes = UrlFetchApp.fetch(inventoryUrl, { headers: { "Authorization": "token " + token } });
  var invFileData = JSON.parse(invRes.getContentText());
  var inventory = JSON.parse(Utilities.newBlob(Utilities.base64Decode(invFileData.content)).getDataAsString());

  var logRes = UrlFetchApp.fetch(logUrl, { headers: { "Authorization": "token " + token } });
  var logFileData = JSON.parse(logRes.getContentText());
  var logs = Utilities.newBlob(Utilities.base64Decode(logFileData.content)).getDataAsString();

  var targetUserEmail = "";
  var targetUserName = "";
  var photoUrl = "N/A";

  if (data.type === 'checkout') {
    targetUserEmail = data.email; // FROM WEBSITE FORM
    targetUserName = data.person;
    
    // Update Inventory
    inventory.forEach(function(item) {
      if (item.id === data.deviceId) {
        item.status = "Not Available";
        item.last_event = data.event + " (" + data.startDate + " to " + data.endDate + ")";
        item.borrower_name = targetUserName;
        item.borrower_email = targetUserEmail;
        item.event_name = data.event;
        item.start_date = data.startDate;
        item.end_date = data.endDate;
      }
    });

    var subject = "Selection Confirmed: " + data.deviceId;
    var body = "Hi " + targetUserName + ",\n\nRequest Confirmed for " + data.model + ".\n\n" +
               "Device: " + data.deviceId + "\nEvent: " + data.event + "\n" +
               "Period: " + data.startDate + " to " + data.endDate + "\n\n" +
               "Thank you!";

  } else if (data.type === 'return') {
    var borrowerInfo = {};
    inventory.forEach(function(item) {
      if (item.id === data.deviceId) {
        borrowerInfo = JSON.parse(JSON.stringify(item));
        item.status = "Available";
        item.last_event = "Available";
        delete item.borrower_name; delete item.borrower_email; 
      }
    });

    targetUserEmail = borrowerInfo.borrower_email; // FETCHED FROM SAVED JSON
    targetUserName = borrowerInfo.borrower_name;
    
    if (data.photo) {
      var folder = DriveApp.getFolderById(photoFolderId);
      var file = folder.createFile(data.photoName, Utilities.base64Decode(data.photo), MimeType.JPEG);
      photoUrl = file.getUrl();
    }

    var subject = "Return Confirmed: " + data.deviceId;
    var body = "Hi " + (targetUserName || "Borrower") + ",\n\nReturn Confirmed for " + data.model + ".\n\n" +
               "Device: " + data.deviceId + "\nReturned On: " + currentDateStr + "\n" +
               "Photo: " + photoUrl + "\n\nThank you!";
  }

  // 2. Push to GitHub (CSV & JSON)
  var updatedLogs = logs.trim() + "\n" + [timestamp.toISOString(), targetUserName, targetUserEmail, data.deviceId, data.type.toUpperCase(), photoUrl].join(",");
  UrlFetchApp.fetch(logUrl, { method: "put", headers: { "Authorization": "token " + token }, payload: JSON.stringify({ message: "Bot: Update log", content: Utilities.base64Encode(updatedLogs, Utilities.Charset.UTF_8), sha: logFileData.sha })});
  UrlFetchApp.fetch(inventoryUrl, { method: "put", headers: { "Authorization": "token " + token }, payload: JSON.stringify({ message: "Bot: Update inventory", content: Utilities.base64Encode(JSON.stringify(inventory, null, 2), Utilities.Charset.UTF_8), sha: invFileData.sha })});

  // 3. SEND EMAIL (TO USER, CC YOU)
  if (targetUserEmail) {
    GmailApp.sendEmail(targetUserEmail, subject, body, { cc: CC_ADDRESS, name: "VR Inventory Bot" });
  }

  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

function instantHandshake() {
  var threads = GmailApp.search('is:unread VR request'); 
  var CC_ADDRESS = "desaidev242003@gmail.com";
  for (var i = 0; i < threads.length; i++) {
    var lastMsg = threads[i].getMessages().pop();
    if (lastMsg.isUnread() && lastMsg.getFrom().indexOf("VR Inventory Bot") === -1) {
      lastMsg.reply("Hi,\n\nThanks for your VR request! Select your device here: https://devdesai02.github.io/vr-tracker/", { cc: CC_ADDRESS, name: "VR Inventory Bot" });
      threads[i].markRead();
    }
  }
}
