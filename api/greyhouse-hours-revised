// gmb-oauth-get-token.js
import readline from 'readline';
import open from 'open';          // npm install open
import fetch from 'node-fetch';   // npm install node-fetch@2

const CLIENT_ID = process.env.GMB_CLIENT_ID;
const CLIENT_SECRET = process.env.GMB_CLIENT_SECRET;
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const SCOPE = 'https://www.googleapis.com/auth/business.manage';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GMB_CLIENT_ID and GMB_CLIENT_SECRET in your env before running this script.');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('Open this URL in your browser:');
  console.log(authUrl.toString());
  await open(authUrl.toString());

  rl.question('\nPaste the authorization code here: ', async (code) => {
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code.trim(),
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code'
        }).toString()
      });

      const tokenData = await tokenRes.json();
      console.log('\nToken response:');
      console.log(JSON.stringify(tokenData, null, 2));

      console.log('\nSave this REFRESH TOKEN in Vercel as GMB_REFRESH_TOKEN:');
      console.log(tokenData.refresh_token);
    } catch (err) {
      console.error('Error exchanging code:', err);
    } finally {
      rl.close();
    }
  });
}

main().catch(console.error);
