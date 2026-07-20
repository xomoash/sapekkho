const { google } = require('googleapis');
const Store = require('electron-store');
const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const store = new Store();
let oauth2Client = null;
let currentAuthServer = null;

// Sapekkho priorities to Google Calendar color ID mapping
const PRIORITY_COLORS = {
  'ফরয': '11',        // Tomato (Red)
  'আম্মু বলসে': '11', // Tomato (Red)
  'High': '11',
  'দরকারি': '5',      // Banana (Yellow)
  'Medium': '5',
  'কালকে করব': '7',     // Peacock (Cyan)
  'পরে করি': '9',     // Blueberry (Blue)
  'Low': '9'
};

function initOAuthClient() {
  if (oauth2Client) return oauth2Client;
  
  try {
    const credentialsPath = path.join(__dirname, 'google-credentials.json');
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    
    oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uri
    );
    
    // Load existing tokens if available
    const tokens = store.get('google-tokens');
    if (tokens) {
      oauth2Client.setCredentials(tokens);
    }
    
    return oauth2Client;
  } catch (error) {
    console.error('Error initializing OAuth client:', error);
    return null;
  }
}

function getAuthUrl() {
  const client = initOAuthClient();
  if (!client) return null;
  
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    prompt: 'consent' // Force to get refresh_token
  });
}

function startAuthServer(callback) {
  if (currentAuthServer) {
    currentAuthServer.close();
  }

  currentAuthServer = http.createServer(async (req, res) => {
    if (req.url.startsWith('/callback')) {
      const qs = new url.URL(req.url, 'http://localhost:8234').searchParams;
      const code = qs.get('code');
      
      const sendHtml = (res, title, message, isSuccess) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
              :root {
                --text-main: #1a1a1a;
                --text-muted: #666666;
                --page-bg: #f5f4f0;
                --glass-bg: rgba(255, 255, 255, 0.5);
                --glass-border: rgba(255, 255, 255, 0.4);
                --glass-shadow: rgba(0, 0, 0, 0.05);
                --success: #0d8268;
                --error: #d93d42;
                --btn-bg: rgba(255, 255, 255, 0.7);
                --btn-hover: rgba(255, 255, 255, 0.9);
              }
              @media (prefers-color-scheme: dark) {
                :root {
                  --text-main: #f0f0f0;
                  --text-muted: #999999;
                  --page-bg: #1a1a1a;
                  --glass-bg: rgba(40, 40, 40, 0.5);
                  --glass-border: rgba(255, 255, 255, 0.1);
                  --glass-shadow: rgba(0, 0, 0, 0.2);
                  --success: #14b894;
                  --error: #fb5d62;
                  --btn-bg: rgba(60, 60, 60, 0.7);
                  --btn-hover: rgba(80, 80, 80, 0.9);
                }
              }

              body { 
                font-family: Söhne, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; 
                background: var(--page-bg);
                color: var(--text-main); 
                display: flex; flex-direction: column; align-items: center; justify-content: center; 
                min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box;
                position: relative; overflow: hidden;
                font-feature-settings: "cv01", "cv02", "cv03", "cv04", "cv05", "cv06", "cv09", "cv10", "cv11";
                -webkit-font-smoothing: antialiased;
              }

              body::before {
                content: ""; position: absolute; top: 20%; left: 20%; width: 30vw; height: 30vw; min-width: 300px; min-height: 300px;
                background: #4ade80; border-radius: 50%; filter: blur(120px); opacity: 0.15; z-index: -1;
              }
              body::after {
                content: ""; position: absolute; bottom: 20%; right: 20%; width: 25vw; height: 25vw; min-width: 250px; min-height: 250px;
                background: #3b82f6; border-radius: 50%; filter: blur(100px); opacity: 0.15; z-index: -1;
              }

              .card { 
                background: var(--glass-bg);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                padding: 48px 40px; 
                border-radius: 20px; 
                box-shadow: 0 8px 32px var(--glass-shadow); 
                border: 1px solid var(--glass-border);
                text-align: center; max-width: 420px; width: 100%;
                display: flex; flex-direction: column; align-items: center;
              }
              
              h1 { margin-top: 0; font-size: 24px; font-weight: 500; letter-spacing: -0.02em; margin-bottom: 12px; }
              p { font-size: 15px; color: var(--text-muted); line-height: 1.6; margin-bottom: 32px; font-weight: 400; }
              
              .icon { width: 64px; height: 64px; margin-bottom: 24px; animation: popIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
              @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

              .countdown-container {
                display: flex; align-items: center; justify-content: center; gap: 12px;
                margin-bottom: 32px; color: var(--text-muted); font-size: 14px;
              }

              .ios-spinner {
                display: inline-block; width: 18px; height: 18px; position: relative;
                color: var(--text-muted);
              }
              .ios-spinner div { transform-origin: 9px 9px; animation: ios-spinner-anim 1.2s linear infinite; }
              .ios-spinner div:after {
                content: " "; display: block; position: absolute; top: 1px; left: 8.5px;
                width: 1.5px; height: 4px; border-radius: 1px; background: currentColor;
              }
              .ios-spinner div:nth-child(1) { transform: rotate(0deg); animation-delay: -1.1s; }
              .ios-spinner div:nth-child(2) { transform: rotate(30deg); animation-delay: -1s; }
              .ios-spinner div:nth-child(3) { transform: rotate(60deg); animation-delay: -0.9s; }
              .ios-spinner div:nth-child(4) { transform: rotate(90deg); animation-delay: -0.8s; }
              .ios-spinner div:nth-child(5) { transform: rotate(120deg); animation-delay: -0.7s; }
              .ios-spinner div:nth-child(6) { transform: rotate(150deg); animation-delay: -0.6s; }
              .ios-spinner div:nth-child(7) { transform: rotate(180deg); animation-delay: -0.5s; }
              .ios-spinner div:nth-child(8) { transform: rotate(210deg); animation-delay: -0.4s; }
              .ios-spinner div:nth-child(9) { transform: rotate(240deg); animation-delay: -0.3s; }
              .ios-spinner div:nth-child(10) { transform: rotate(270deg); animation-delay: -0.2s; }
              .ios-spinner div:nth-child(11) { transform: rotate(300deg); animation-delay: -0.1s; }
              .ios-spinner div:nth-child(12) { transform: rotate(330deg); animation-delay: 0s; }
              @keyframes ios-spinner-anim { 0% { opacity: 1; } 100% { opacity: 0.15; } }

              .btn {
                display: inline-flex; align-items: center; justify-content: center;
                background: var(--btn-bg); color: var(--text-main);
                backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
                font-weight: 500; font-size: 14px; letter-spacing: -0.01em;
                padding: 12px 24px; border-radius: 10px; text-decoration: none; 
                border: 1px solid var(--glass-border); cursor: pointer;
                transition: all 0.2s; box-sizing: border-box; box-shadow: 0 4px 12px var(--glass-shadow);
              }
              .btn:hover { background: var(--btn-hover); transform: translateY(-1px); box-shadow: 0 6px 16px var(--glass-shadow); }
              .btn:active { transform: translateY(1px); box-shadow: 0 2px 8px var(--glass-shadow); }

            </style>
          </head>
          <body>
            <div class="card">
              ${isSuccess 
                ? '<svg class="icon" viewBox="0 0 50 50"><circle cx="25" cy="25" r="25" fill="var(--success)"/><path d="M16 26l6 6 12-12" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' 
                : '<svg class="icon" viewBox="0 0 50 50"><circle cx="25" cy="25" r="25" fill="var(--error)"/><path d="M18 18l14 14M32 18L18 32" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'}
              <h1>${title}</h1>
              <p>${message}</p>
              
              ${isSuccess ? `
              <div class="countdown-container">
                <div class="ios-spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
                <span>Opening Sapekkho, this tab will be closed in <span id="countdown">5</span>...</span>
              </div>
              ` : ''}

              <button class="btn" onclick="window.close()">
                ${isSuccess ? 'Open Sapekkho' : 'Close Tab'}
              </button>
              
              ${isSuccess ? `
              <script>
                let count = 5;
                const el = document.getElementById('countdown');
                const interval = setInterval(() => {
                  count--;
                  if (el) el.innerText = count;
                  if(count <= 0) {
                    clearInterval(interval);
                    window.close();
                    
                    // Fallback in case browser blocks auto-close
                    setTimeout(() => {
                      document.querySelector('.countdown-container').innerHTML = '<span>You can safely close this tab now.</span>';
                    }, 500);
                  }
                }, 1000);
              </script>
              ` : ''}
            </div>
          </body>
          </html>
        `);
      };

      if (code) {
        sendHtml(res, 'Authentication Successful', 'Your Google account has been connected securely. You can safely close this window and return to Sapekkho.', true);
        
        try {
          const client = initOAuthClient();
          const { tokens } = await client.getToken(code);
          client.setCredentials(tokens);
          store.set('google-tokens', tokens);
          
          // Get user email
          const oauth2 = google.oauth2({ version: 'v2', auth: client });
          const userInfo = await oauth2.userinfo.get();
          if (userInfo.data && userInfo.data.email) {
            store.set('google-email', userInfo.data.email);
          }
          
          callback(null, { connected: true, email: store.get('google-email') });
        } catch (err) {
          console.error('Error getting tokens:', err);
          callback(err, null);
        }
      } else {
        sendHtml(res, "Authentication Failed", "We couldn't connect to your Google account. Please try again from Sapekkho.", false);
        callback(new Error('No code found'), null);
      }
      
      currentAuthServer.close();
      currentAuthServer = null;
    }
  });

  currentAuthServer.listen(8234, () => {
    console.log('Auth server listening on port 8234');
  });
}

function isAuthenticated() {
  return !!store.get('google-tokens');
}

async function disconnectAccount() {
  store.delete('google-tokens');
  store.delete('google-email');
  store.delete('sapekkho-calendar-id');
  if (oauth2Client) {
    try {
      await oauth2Client.revokeCredentials();
    } catch (e) {
      console.error(e);
    }
    oauth2Client.setCredentials(null);
  }
  return true;
}

function getUserEmail() {
  return store.get('google-email');
}

async function getOrCreateSapekkhoCalendar() {
  const client = initOAuthClient();
  if (!client) throw new Error('Not authenticated');

  const calendar = google.calendar({ version: 'v3', auth: client });
  let calendarId = store.get('sapekkho-calendar-id');

  if (calendarId) {
    try {
      await calendar.calendars.get({ calendarId });
      return calendarId;
    } catch (e) {
      // Calendar might have been deleted, proceed to create
      calendarId = null;
    }
  }

  // Try to find it in calendar list
  const list = await calendar.calendarList.list();
  const existing = list.data.items.find(c => c.summary === 'Sapekkho');
  if (existing) {
    store.set('sapekkho-calendar-id', existing.id);
    return existing.id;
  }

  // Create it
  const created = await calendar.calendars.insert({
    requestBody: {
      summary: 'Sapekkho',
      description: 'Tasks synced from Sapekkho'
    }
  });

  store.set('sapekkho-calendar-id', created.data.id);
  return created.data.id;
}

// Convert HTML notes to plain text for calendar description
function htmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/ig, '')
    .trim();
}

async function syncTaskToCalendar(task) {
  if (!isAuthenticated()) return null;
  if (!task.reminder) return null; // Only sync tasks with reminders

  const client = initOAuthClient();
  const calendar = google.calendar({ version: 'v3', auth: client });
  const calendarId = await getOrCreateSapekkhoCalendar();

  // Determine start/end times
  // task.reminder is usually "YYYY-MM-DDTHH:mm"
  const startDate = new Date(task.reminder);
  
  // Default to 1 hour duration
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  
  const event = {
    summary: (task.done ? '✅ ' : '') + task.title,
    description: htmlToText(task.note),
    start: {
      dateTime: startDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    colorId: PRIORITY_COLORS[task.priority] || '9', // Default blue
    reminders: {
      useDefault: true
    }
  };

  try {
    if (task.gcalEventId) {
      // Update existing
      const res = await calendar.events.update({
        calendarId,
        eventId: task.gcalEventId,
        requestBody: event
      });
      return res.data.id;
    } else {
      // Create new
      const res = await calendar.events.insert({
        calendarId,
        requestBody: event
      });
      return res.data.id;
    }
  } catch (error) {
    console.error('Error syncing to Google Calendar:', error);
    // If event not found (deleted manually by user), clear the ID and retry insert?
    if (error.code === 404 && task.gcalEventId) {
      const res = await calendar.events.insert({
        calendarId,
        requestBody: event
      });
      return res.data.id;
    }
    return null;
  }
}

async function deleteCalendarEvent(eventId) {
  if (!isAuthenticated() || !eventId) return;

  const client = initOAuthClient();
  const calendar = google.calendar({ version: 'v3', auth: client });
  const calendarId = await getOrCreateSapekkhoCalendar();

  try {
    await calendar.events.delete({
      calendarId,
      eventId
    });
  } catch (error) {
    console.error('Error deleting event from Google Calendar:', error);
  }
}

async function listCalendarEvents() {
  if (!isAuthenticated()) return [];
  const client = initOAuthClient();
  const calendar = google.calendar({ version: 'v3', auth: client });
  
  try {
    const calendarId = await getOrCreateSapekkhoCalendar();
    const res = await calendar.events.list({
      calendarId,
      maxResults: 250,
      singleEvents: true
    });
    return res.data.items || [];
  } catch (error) {
    console.error('Error listing calendar events:', error);
    return [];
  }
}

module.exports = {
  getAuthUrl,
  startAuthServer,
  isAuthenticated,
  disconnectAccount,
  getUserEmail,
  syncTaskToCalendar,
  deleteCalendarEvent,
  listCalendarEvents
};
