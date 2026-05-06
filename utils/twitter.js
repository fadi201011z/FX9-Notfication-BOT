// Twitter/X — بدون API Key
// يستخدم Nitter RSS (خدمة مفتوحة بديلة لـ Twitter API)
const axios = require('axios');

// خوادم Nitter العامة — يجرّبها بالترتيب
const NITTER = [
  'https://nitter.privacyredirect.com',
  'https://nitter.poast.org',
  'https://nitter.tiekoetter.com',
  'https://xcancel.com',
  'https://nitter.net'
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Accept': 'text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8'
};

function cleanHandle(input) {
  const m = input.match(/(?:twitter|x)\.com\/([\w]+)/);
  if (m) return m[1];
  return input.replace(/^@/, '').trim();
}

async function searchUser(handleOrUrl) {
  const username = cleanHandle(handleOrUrl);

  for (const host of NITTER) {
    try {
      const res = await axios.get(`${host}/${username}`, {
        headers: HEADERS, timeout: 10000, validateStatus: s => s === 200
      });
      const html = res.data;

      const nameMatch      = html.match(/class="profile-card-fullname"[^>]*>\s*([^\n<]+)/);
      const bioMatch       = html.match(/class="profile-bio"[^>]*><p>([\s\S]*?)<\/p>/);
      const followersMatch = html.match(/Followers[\s\S]{0,200}?class="profile-stat-num">([^<]+)/);

      return {
        id:          username,
        name:        nameMatch?.[1]?.trim() || `@${username}`,
        description: bioMatch?.[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 200) || '',
        image:       null,
        followers:   followersMatch?.[1]?.trim() || null,
        slug:        username,
        url:         `https://twitter.com/${username}`
      };
    } catch { /* جرّب التالي */ }
  }

  // إذا فشل كل خادم: أرجع بيانات أساسية فقط
  return {
    id: username, name: `@${username}`, description: '',
    image: null, followers: null, slug: username,
    url: `https://twitter.com/${username}`
  };
}

async function getLatestTweet(username) {
  const handle = username.replace(/^@/, '').trim();

  for (const host of NITTER) {
    try {
      const res = await axios.get(`${host}/${handle}/rss`, {
        headers: HEADERS, timeout: 10000, validateStatus: s => s === 200
      });
      const xml = res.data;

      const items = xml.match(/<item>([\s\S]*?)<\/item>/g);
      if (!items?.length) continue;

      for (const item of items) {
        const rawTitle = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]
                      || item.match(/<title>([^<]+)<\/title>/)?.[1] || '';

        // تجاهل إعادة التغريد
        if (rawTitle.startsWith('RT @')) continue;

        const link    = item.match(/<link>([^<]+)<\/link>/)?.[1] || '';
        const pubDate = item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] || null;
        const idMatch = link.match(/\/status\/(\d+)/);
        if (!idMatch) continue;

        const text = rawTitle
          .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
          .replace(/&quot;/g,'"').replace(/&#39;/g,"'").slice(0, 280);

        return {
          id:         idMatch[1],
          text,
          created_at: pubDate ? new Date(pubDate).toISOString() : null,
          url:        `https://twitter.com/${handle}/status/${idMatch[1]}`
        };
      }
    } catch { /* جرّب التالي */ }
  }

  return null;
}

module.exports = { searchUser, getLatestTweet };
