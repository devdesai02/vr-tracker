/**
 * VR Tracker Master Bridge (GITHUB ONLY)
 * Managed by VR Inventory Bot via Clasp
 */

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput("Error parsing JSON: " + err.message);
  }
  
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  var ccEmail = "desaidev242003@gmail.com";
  var repo = "devdesai02/vr-tracker";
  var photoFolderId = "1njDIUbohdWyqW5J5_l5nZw2_6K5x7mb-";

  var timestamp = new Date().toISOString();
  var photoUrl = "N/A";

  // 1. Handle Photo Upload (for returns)
  if (data.type === 'return' && data.photo) {
    try {
      var folder = DriveApp.getFolderById(photoFolderId);
      var file = folder.createFile(data.photoName, Utilities.base64Decode(data.photo), MimeType.JPEG);
      photoUrl = file.getUrl();
    } catch(err) { photoUrl = "Upload Error: " + err.message; }
  }

  // 2. Send Confirmation Email
  var emailTo = data.email || data.userEmail;
  var subject = "VR Tracker Confirmation: " + data.deviceId + " (" + data.type.toUpperCase() + ")";
  var body = "Hi " + (data.person || "there") + ",\n\n" +
             "Your " + data.type + " for " + data.model + " has been processed.\n\n" +
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

  // 3. Log to GitHub CSV
  try {
    var logUrl = "https://api.github.com/repos/" + repo + "/contents/requests_log.csv";
    var res = UrlFetchApp.fetch(logUrl, { headers: { "Authorization": "token " + token }, muteHttpExceptions: true });
    
    if (res.getResponseCode() === 200) {
      var fileData = JSON.parse(res.getContentText());
      var oldContent = Utilities.newBlob(Utilities.base64Decode(fileData.content)).getDataAsString();
      
      var newRow = [
        timestamp, 
        data.person || "N/A", 
        emailTo || "N/A", 
        data.event || "N/A", 
        data.location || "N/A", 
        data.returnDate || data.date || "N/A", 
        data.deviceId, 
        data.model, 
        data.type.toUpperCase(),
        photoUrl
      ].join(",");
      
      var newContent = oldContent.trim() + "\n" + newRow;

      UrlFetchApp.fetch(logUrl, {
        method: "put",
        headers: { "Authorization": "token " + token, "Content-Type": "application/json" },
        payload: JSON.stringify({
          message: "Bot: Log " + data.type + " for " + data.deviceId,
          content: Utilities.base64Encode(newContent, Utilities.Charset.UTF_8),
          sha: fileData.sha
        })
      });
    }
  } catch(err) { console.log("CSV Failed: " + err.message); }

  // 4. Update Website Status (Repository Dispatch)
  try {
    var status = (data.type === 'checkout') ? 'Not Available' : 'Available';
    var eventTxt = (data.type === 'checkout') ? (data.event + " (Due: " + data.returnDate + ")") : 'None';
    
    UrlFetchApp.fetch("https://api.github.com/repos/" + repo + "/dispatches", {
      method: "post",
      headers: {
        "Authorization": "token " + token,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      payload: JSON.stringify({
        event_type: "check-out",
        client_payload: {
          device_id: String(data.deviceId),
          status: String(status),
          event: String(eventTxt)
        }
      })
    });
  } catch(err) { console.log("Dispatch Failed: " + err.message); }

  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}
