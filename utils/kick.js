const axios = require('axios');

const BASE = 'https://kick.com/api/v2/channels';

const HEADERS = {
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
  'Referer': 'https://kick.com/'
};

function extractSlug(input) {
  input = input.trim();
  const match = input.match(/kick\.com\/([\w-]+)/);
  if (match) return match[1].toLowerCase();
  if (input.startsWith('@')) return input.slice(1).toLowerCase();
  return input.toLowerCase();
}

async function searchChannel(slugOrUrl) {
  const slug = extractSlug(slugOrUrl);
  const res = await axios.get(`${BASE}/${slug}`, { headers: HEADERS, timeout: 12000 });
  const d = res.data;
  if (!d || !d.user) return null;

  return {
    id: String(d.id),
    slug: d.slug,
    name: d.user.username,
    description: d.user.bio || '',
    image: d.user.profile_pic || null,
    followers: d.followers_count ?? null,
    isLiveNow: !!d.livestream,
    url: `https://kick.com/${d.slug}`
  };
}

async function isLive(slug) {
  try {
    const res = await axios.get(`${BASE}/${slug}`, { headers: HEADERS, timeout: 12000 });
    const d = res.data;
    const stream = d?.livestream;
    if (!stream) return null;

    return {
      id: String(stream.id),
      title: stream.session_title || 'بدون عنوان',
      viewers: stream.viewer_count ?? 0,
      thumbnail: stream.thumbnail?.url || null,
      startedAt: stream.created_at,
      categories: stream.categories?.map(c => c.name).join(', ') || 'غير محدد',
      slug: d.slug,
      url: `https://kick.com/${d.slug}`
    };
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

module.exports = { searchChannel, isLive, extractSlug };
