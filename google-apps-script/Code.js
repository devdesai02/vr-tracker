/**
 * VR Tracker Master Bridge (v3.3 - REFINED THREADING)
 */

function doGet(e) {
  var params = e.parameter;
  if (!params.action) return ContentService.createTextOutput("No action specified");
  
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  var repo = "devdesai02/vr-tracker";
  var inventoryUrl = "https://api.github.com/repos/" + repo + "/contents/vr_inventory.json";
  var logUrl = "https://api.github.com/repos/" + repo + "/contents/requests_log.csv";
  var OWNER_EMAIL = "desaidev242003@gmail.com";
  
  var invRes = UrlFetchApp.fetch(inventoryUrl, { headers: { "Authorization": "token " + token } });
  var inventory = JSON.parse(Utilities.newBlob(Utilities.base64Decode(JSON.parse(invRes.getContentText()).content)).getDataAsString());
  var logRes = UrlFetchApp.fetch(logUrl, { headers: { "Authorization": "token " + token } });
  var logFileData = JSON.parse(logRes.getContentText());
  var logs = Utilities.newBlob(Utilities.base64Decode(logFileData.content)).getDataAsString();

  var timestamp = new Date();
  var currentDateStr = Utilities.formatDate(timestamp, "GMT+5:30", "yyyy-MM-dd");
  var userEmail = params.email;
  var userName = params.person;
  var statusUpdateMsg = "";

  if (params.action === 'approveCheckout') {
    inventory.forEach(function(item) {
      if (item.id === params.deviceId) {
        item.status = "Not Available";
        item.last_event = params.event + " (" + params.startDate + " to " + params.endDate + ")";
        item.borrower_name = userName;
        item.borrower_email = userEmail;
        item.event_name = params.event || "";
        item.start_date = params.startDate || "";
        item.end_date = params.endDate || "";
      }
    });
    statusUpdateMsg = "Hi " + userName + ",\n\nYour request for " + params.model + " has been APPROVED.\n\nEnjoy your session!";
    
  } else if (params.action === 'rejectCheckout') {
    statusUpdateMsg = "Hi " + userName + ",\n\nSorry, your request for " + params.model + " was declined at this time.";
    
  } else if (params.action === 'confirmReturn') {
    inventory.forEach(function(item) {
      if (item.id === params.deviceId) {
        item.status = "Available";
        item.last_event = "Available";
        item.borrower_name = "";
        item.borrower_email = "";
        item.event_name = "";
        item.start_date = "";
        item.end_date = "";
      }
    });
    statusUpdateMsg = "Hi " + (userName || "Borrower") + ",\n\nWe have received the " + params.model + ".\n\nThank you for returning it!";
  }

  // Update GitHub
  if (params.action !== 'rejectCheckout') {
    var logEntry = [timestamp.toISOString(), userName || "N/A", userEmail || "N/A", params.event || "N/A", params.location || "N/A", currentDateStr, params.deviceId, params.model, params.action.toUpperCase(), params.photoUrl || "N/A"].join(",");
    var updatedLogs = logs.trim() + "\n" + logEntry;
    UrlFetchApp.fetch(logUrl, { method: "put", headers: { "Authorization": "token " + token }, payload: JSON.stringify({ message: "Bot: " + params.action, content: Utilities.base64Encode(updatedLogs, Utilities.Charset.UTF_8), sha: logFileData.sha })});
    UrlFetchApp.fetch(inventoryUrl, { method: "put", headers: { "Authorization": "token " + token }, payload: JSON.stringify({ message: "Bot: " + params.action, content: Utilities.base64Encode(JSON.stringify(inventory, null, 2), Utilities.Charset.UTF_8), sha: JSON.parse(invRes.getContentText()).sha })});
  }

  // SEND REPLY TO USER
  if (userEmail) {
    var options = { cc: OWNER_EMAIL, name: "VR Inventory Bot" };
    if (params.threadId) {
      try {
        var thread = GmailApp.getThreadById(params.threadId);
        thread.reply(statusUpdateMsg, options);
      } catch(e) { 
        GmailApp.sendEmail(userEmail, "Update: " + params.deviceId, statusUpdateMsg, options); 
      }
    } else {
      GmailApp.sendEmail(userEmail, "Update: " + params.deviceId, statusUpdateMsg, options);
    }
  }
  return ContentService.createTextOutput("Status Updated Successfully").setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var scriptUrl = ScriptApp.getService().getUrl();
  var OWNER_EMAIL = "desaidev242003@gmail.com"; 
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  var repo = "devdesai02/vr-tracker";
  var logUrl = "https://api.github.com/repos/" + repo + "/contents/requests_log.csv";
  
  var timestamp = new Date();
  var currentDateStr = Utilities.formatDate(timestamp, "GMT+5:30", "yyyy-MM-dd");
  var threadId = data.threadId || "";

  // 1. Log Initial Request
  try {
    var logFileData = JSON.parse(UrlFetchApp.fetch(logUrl, { headers: { "Authorization": "token " + token } }).getContentText());
    var updatedLogs = Utilities.newBlob(Utilities.base64Decode(logFileData.content)).getDataAsString().trim() + "\n" + [timestamp.toISOString(), data.person || "N/A", data.email || "N/A", data.event || "N/A", data.location || "N/A", currentDateStr, data.deviceId, data.model, (data.type + "_REQUEST").toUpperCase(), "N/A"].join(",");
    UrlFetchApp.fetch(logUrl, { method: "put", headers: { "Authorization": "token " + token }, payload: JSON.stringify({ message: "Bot: Log " + data.type, content: Utilities.base64Encode(updatedLogs, Utilities.Charset.UTF_8), sha: logFileData.sha })});
  } catch(e) {}

  var userMsg = ""; var ownerSubject = ""; var ownerBody = "";

  if (data.type === 'checkout') {
    userMsg = "Hi " + data.person + ",\n\nYour request for " + data.model + " (" + data.deviceId + ") has been received. I am checking availability and will approve/decline shortly.";
    ownerSubject = "ACTION REQUIRED: Checkout - " + data.deviceId;
    var approveUrl = scriptUrl + "?action=approveCheckout&deviceId=" + data.deviceId + "&model=" + encodeURIComponent(data.model) + "&person=" + encodeURIComponent(data.person) + "&email=" + data.email + "&event=" + encodeURIComponent(data.event) + "&location=" + encodeURIComponent(data.location) + "&startDate=" + data.startDate + "&endDate=" + data.endDate + "&threadId=" + threadId;
    var rejectUrl = scriptUrl + "?action=rejectCheckout&deviceId=" + data.deviceId + "&model=" + encodeURIComponent(data.model) + "&person=" + encodeURIComponent(data.person) + "&email=" + data.email + "&threadId=" + threadId;
    ownerBody = "New Request from " + data.person + " (" + data.email + ")\nDevice: " + data.deviceId + "\nEvent: " + data.event + "\n\n[ APPROVE ]: " + approveUrl + "\n\n[ REJECT ]: " + rejectUrl;

  } else if (data.type === 'return') {
    var photoUrl = "N/A";
    if (data.photo) {
      var file = DriveApp.getFolderById("1njDIUbohdWyqW5J5_l5nZw2_6K5x7mb-").createFile(Utilities.newBlob(Utilities.base64Decode(data.photo), data.mimeType, data.fileName));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      photoUrl = file.getUrl();
    }
    updateStatusOnGithub(data.deviceId, "In Transit");
    userMsg = "Hi,\n\nReturn generated for " + data.model + ". The device is now marked as 'In Transit' and I will confirm once I physically receive it.\n\nPhoto: " + photoUrl;
    ownerSubject = "ACTION REQUIRED: Confirm Return - " + data.deviceId;
    var confirmUrl = scriptUrl + "?action=confirmReturn&deviceId=" + data.deviceId + "&model=" + encodeURIComponent(data.model) + "&photoUrl=" + encodeURIComponent(photoUrl) + "&threadId=" + threadId + "&email=" + data.email + "&person=" + encodeURIComponent(data.person || "");
    ownerBody = "Device " + data.deviceId + " is being returned.\nPhoto: " + photoUrl + "\n\n[ CONFIRM RECEIPT ]: " + confirmUrl;
  }

  // SEND REPLY TO USER THREAD
  var options = { name: "VR Inventory Bot", cc: OWNER_EMAIL };
  if (threadId) {
    try {
      var thread = GmailApp.getThreadById(threadId);
      thread.reply(userMsg, options);
    } catch(e) {
      GmailApp.sendEmail(data.email || OWNER_EMAIL, "Update: " + data.deviceId, userMsg, options);
    }
  } else {
    GmailApp.sendEmail(data.email || OWNER_EMAIL, "Update: " + data.deviceId, userMsg, options);
  }

  // Notify Owner (New email is fine for owner, but keep the link to the thread)
  GmailApp.sendEmail(OWNER_EMAIL, ownerSubject, ownerBody, { name: "VR Inventory Bot" });

  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

function updateStatusOnGithub(deviceId, status) {
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  var repo = "devdesai02/vr-tracker";
  var inventoryUrl = "https://api.github.com/repos/" + repo + "/contents/vr_inventory.json";
  var invRes = UrlFetchApp.fetch(inventoryUrl, { headers: { "Authorization": "token " + token } });
  var invData = JSON.parse(invRes.getContentText());
  var inventory = JSON.parse(Utilities.newBlob(Utilities.base64Decode(invData.content)).getDataAsString());
  inventory.forEach(function(item) { if (item.id === deviceId) item.status = status; });
  UrlFetchApp.fetch(inventoryUrl, { method: "put", headers: { "Authorization": "token " + token }, payload: JSON.stringify({ message: "Bot: Status to " + status, content: Utilities.base64Encode(JSON.stringify(inventory, null, 2), Utilities.Charset.UTF_8), sha: invData.sha })});
}

function instantHandshake() {
  var threads = GmailApp.search('is:unread VR request'); 
  var dashboardUrl = "https://devdesai02.github.io/vr-tracker/";
  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var lastMsg = thread.getMessages().pop();
    if (lastMsg.isUnread() && lastMsg.getFrom().indexOf("VR Inventory Bot") === -1) {
      thread.reply("Hi,\n\nThanks! Select your device here: " + dashboardUrl + "?threadId=" + thread.getId(), { cc: "desaidev242003@gmail.com", name: "VR Inventory Bot" });
      thread.markRead();
    }
  }
}
