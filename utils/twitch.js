const axios = require('axios');

let accessToken = null;
let tokenExpiry = 0;

function requireEnv() {
  if (!process.env.TWITCH_CLIENT_ID) throw new Error('TWITCH_CLIENT_ID غير موجود في ملف .env');
  if (!process.env.TWITCH_CLIENT_SECRET) throw new Error('TWITCH_CLIENT_SECRET غير موجود في ملف .env');
}

async function getAccessToken() {
  requireEnv();
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const res = await axios.post('https://id.twitch.tv/oauth2/token', null, {
    params: {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials'
    },
    timeout: 10000
  });

  accessToken = res.data.access_token;
  tokenExpiry = Date.now() + (res.data.expires_in - 300) * 1000;
  return accessToken;
}

async function getHeaders() {
  const token = await getAccessToken();
  return {
    'Client-ID': process.env.TWITCH_CLIENT_ID,
    Authorization: `Bearer ${token}`
  };
}

async function searchChannel(loginOrUrl) {
  let login = loginOrUrl.trim();

  const match = login.match(/twitch\.tv\/([\w]+)/);
  if (match) login = match[1];
  if (login.startsWith('@')) login = login.slice(1);

  const headers = await getHeaders();
  const res = await axios.get('https://api.twitch.tv/helix/users', {
    params: { login },
    headers,
    timeout: 10000
  });

  const user = res.data.data?.[0];
  if (!user) return null;

  return {
    id: user.id,
    name: user.display_name,
    login: user.login,
    description: user.description || '',
    image: user.profile_image_url || null,
    url: `https://www.twitch.tv/${user.login}`
  };
}

async function isLive(userId) {
  const headers = await getHeaders();

  const [streamRes, userRes] = await Promise.all([
    axios.get('https://api.twitch.tv/helix/streams', {
      params: { user_id: userId },
      headers,
      timeout: 10000
    }),
    axios.get('https://api.twitch.tv/helix/users', {
      params: { id: userId },
      headers,
      timeout: 10000
    })
  ]);

  const stream = streamRes.data.data?.[0];
  if (!stream) return null;

  let gameName = 'غير محدد';
  if (stream.game_id) {
    try {
      const gameRes = await axios.get('https://api.twitch.tv/helix/games', {
        params: { id: stream.game_id },
        headers,
        timeout: 8000
      });
      gameName = gameRes.data.data?.[0]?.name || gameName;
    } catch {}
  }

  const login = userRes.data.data?.[0]?.login || userId;

  return {
    id: stream.id,
    title: stream.title || 'بدون عنوان',
    game: gameName,
    viewers: stream.viewer_count || 0,
    thumbnail: stream.thumbnail_url
      .replace('{width}', '1280')
      .replace('{height}', '720'),
    startedAt: stream.started_at,
    login,
    url: `https://www.twitch.tv/${login}`
  };
}

async function getLatestVod(userId) {
  const headers = await getHeaders();
  const res = await axios.get('https://api.twitch.tv/helix/videos', {
    params: { user_id: userId, type: 'archive', first: 1 },
    headers,
    timeout: 10000
  });
  return res.data.data?.[0] || null;
}

module.exports = { searchChannel, isLive, getLatestVod };
