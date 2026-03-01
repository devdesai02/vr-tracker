/**
 * VR Tracker Master Bridge (PRO - INSTANT HANDSHAKE)
 * Managed by VR Inventory Bot via Clasp
 */

// --- MAIN ENTRY POINT FOR WEBSITE ---
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  var ccEmail = "desaidev242003@gmail.com";
  var repo = "devdesai02/vr-tracker";
  var photoFolderId = "1njDIUbohdWyqW5J5_l5nZw2_6K5x7mb-";

  var timestamp = new Date().toISOString();
  var photoUrl = "N/A";

  if (data.type === 'return' && data.photo) {
    try {
      var folder = DriveApp.getFolderById(photoFolderId);
      var file = folder.createFile(data.photoName, Utilities.base64Decode(data.photo), MimeType.JPEG);
      photoUrl = file.getUrl();
    } catch(err) { photoUrl = "Upload Error"; }
  }

  var isCheckout = (data.type === 'checkout');
  var emailTo = data.email || data.userEmail;
  var subject = isCheckout ? "Selection Confirmed: " + data.deviceId : "Return Confirmed: " + data.deviceId;
  var statusPhrase = isCheckout ? "Request Confirmed" : "Return Confirmed";
  
  var body = "Hi " + (data.person || "there") + ",\n\n" +
             statusPhrase + " for " + data.model + ".\n\n" +
             "--- Details ---\n" +
             "Device ID: " + data.deviceId + "\n" +
             "Name: " + (data.person || "N/A") + "\n" +
             "Event: " + (data.event || "N/A") + "\n" +
             "Location: " + (data.location || "N/A") + "\n" +
             "Date: " + (data.returnDate || data.date || "N/A") + "\n\n" +
             "Thank you!\nVR Inventory Bot";

  try {
    if (emailTo) {
      GmailApp.sendEmail(emailTo, subject, body, { cc: ccEmail, name: "VR Bot" });
    }
  } catch(err) { console.log("Email Failed: " + err.message); }

  try {
    var logUrl = "https://api.github.com/repos/" + repo + "/contents/requests_log.csv";
    var res = UrlFetchApp.fetch(logUrl, { headers: { "Authorization": "token " + token }, muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      var fileData = JSON.parse(res.getContentText());
      var oldContent = Utilities.newBlob(Utilities.base64Decode(fileData.content)).getDataAsString();
      var newRow = [timestamp, data.person||"N/A", emailTo||"N/A", data.event||"N/A", data.location||"N/A", data.returnDate||data.date||"N/A", data.deviceId, data.model, data.type.toUpperCase(), photoUrl].join(",");
      var newContent = oldContent.trim() + "\n" + newRow;
      UrlFetchApp.fetch(logUrl, { method: "put", headers: { "Authorization": "token " + token, "Content-Type": "application/json" }, payload: JSON.stringify({ message: "Bot: Log " + data.type, content: Utilities.base64Encode(newContent, Utilities.Charset.UTF_8), sha: fileData.sha })});
    }
  } catch(err) { console.log("CSV Failed: " + err.message); }

  try {
    var status = isCheckout ? 'Not Available' : 'Available';
    var eventTxt = isCheckout ? (data.event + " (Due: " + data.returnDate + ")") : 'Available';
    UrlFetchApp.fetch("https://api.github.com/repos/" + repo + "/dispatches", { method: "post", headers: { "Authorization": "token " + token, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json" }, payload: JSON.stringify({ event_type: "check-out", client_payload: { device_id: String(data.deviceId), status: String(status), event: String(eventTxt) }})});
  } catch(err) { console.log("Dispatch Failed: " + err.message); }

  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

// --- NEW: AUTO-SCAN INBOX EVERY MINUTE ---
function instantHandshake() {
  var threads = GmailApp.search('is:unread "VR request" -from:me');
  var websiteUrl = "https://devdesai02.github.io/vr-tracker/";
  var ccEmail = "desaidev242003@gmail.com";

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var lastMessage = messages[messages.length - 1];
    var sender = lastMessage.getFrom();

    var body = "Hi,\n\nThanks for your VR request! Please select your device and confirm your details here:\n" + 
               websiteUrl + "\n\nOnce confirmed, we will finalize your request.\n\nBest regards,\nVR Inventory Bot";

    // Send reply
    lastMessage.reply(body, {
      cc: ccEmail,
      name: "VR Inventory Bot"
    });

    // Mark as read so we don't reply twice
    threads[i].markRead();
    console.log("Instant reply sent to: " + sender);
  }
}
