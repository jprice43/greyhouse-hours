// api/gmb-auth-test.js
// Tests OAuth with My Business Business Information API

async function getAccessToken(debug) {
  const clientId = process.env.GMB_CLIENT_ID;
  const clientSecret = process.env.GMB_CLIENT_SECRET;
  const refreshToken = process.env.GMB_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing env vars: GMB_CLIENT_ID, GMB_CLIENT_SECRET, or GMB_REFRESH_TOKEN'
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const data = await resp.json();

  if (!resp.ok) {
    // Surface the Google error when debug=1
    const msg = `Failed to get access token: ${resp.status} ${
      data.error || JSON.stringify(data)
    }`;
    if (debug) {
      throw new Error(msg);
    } else {
      throw new Error('Failed to get access token');
    }
  }

  if (!data.access_token) {
    throw new Error('No access_token in token response');
  }

  return data.access_token;
}

export default async function handler(req, res) {
  const debug = req.query.debug === '1';

  try {
    const accessToken = await getAccessToken(debug);

    // Call Business Information API: list accounts
    const accountsResp = await fetch(
      'https://mybusinessbusinessinformation.googleapis.com/v1/accounts',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      }
    );

    const accountsData = await accountsResp.json();

    if (!accountsResp.ok) {
      const detail = debug ? accountsData : undefined;
      return res.status(500).json({
        error: 'Failed to list accounts',
        status: accountsResp.status,
        detail
      });
    }

    // Success: show what Google sees for your accounts
    return res.status(200).json({ accounts: accountsData });

  } catch (err) {
    console.error('GMB OAuth test error:', err);
    return res.status(500).json({
      error: err.message || 'Unknown error',
      stack: debug ? err.stack : undefined
    });
  }
}
