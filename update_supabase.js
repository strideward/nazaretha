const fs = require('fs');
const filePath = 'C:/Users/ntuth/.gemini/antigravity/scratch/amanazaretha_church_app.html';
let html = fs.readFileSync(filePath, 'utf8');

const sMarker = '    // ============================================================\r\n    //  DATA\r\n    // ============================================================';
const eMarker = '    // ============================================================\r\n    //  FEED RENDER\r\n    // ============================================================';

const idx1 = html.indexOf(sMarker);
const idx2 = html.indexOf(eMarker);

if (idx1 === -1 || idx2 === -1) {
  console.error('Markers not found!');
  process.exit(1);
}

const supabaseSnippet = `    // ============================================================
    //  SUPABASE CLIENT & LIVE DATA
    // ============================================================
    const SUPABASE_PROJECT_ID = 'gzxbppwlfxtbybzxlocw';
    const SUPABASE_URL = 'https://gzxbppwlfxtbybzxlocw.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_4XPZaxufxC9NnJ3CYMrmcw_K7Jff-9g';

    // Initialize Supabase Client
    const supabase = (typeof window.supabase !== 'undefined' && window.supabase.createClient)
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;

    // Real dynamic data storage (all dummy data removed)
    let profiles = [];
    let posts = [];
    let reels = [];
    let eventsData = [];
    let notifications = [];
    let chats = [];
    let messageRequests = [];
    let postComments = {};
    let reelComments = {};

    // Helper functions to fetch remote data from Supabase
    async function loadSupabaseData() {
      if (!supabase) return;
      try {
        // Fetch posts
        const { data: dbPosts, error: postErr } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
        if (!postErr && dbPosts) {
          posts = dbPosts.map(p => ({
            id: p.id,
            icon: p.icon || 'sun',
            title: p.title || '',
            text: p.text || p.content || '',
            tags: p.tags || '',
            temple: p.temple || 'eBuhleni',
            time: p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Just now',
            likes: p.likes || 0,
            comments: p.comments || 0,
            reposts: p.reposts || 0,
            image: p.image || undefined,
            video: p.video || undefined
          }));
          renderFeed();
        }

        // Fetch events
        const { data: dbEvents, error: evErr } = await supabase.from('events').select('*').order('created_at', { ascending: false });
        if (!evErr && dbEvents) {
          eventsData = dbEvents.map(e => ({
            id: String(e.id),
            day: e.day || '01',
            month: e.month || 'JAN',
            title: e.title || '',
            type: e.type || 'Service',
            dateLabel: e.date_label || '',
            time: e.time || '',
            venue: e.venue || '',
            temple: e.temple || '',
            host: e.host || '',
            attending: e.attending || 0,
            reminded: false,
            description: e.description || '',
            cover: e.cover || ''
          }));
          renderEvents();
        }

        // Fetch reels
        const { data: dbReels, error: rErr } = await supabase.from('reels').select('*').order('created_at', { ascending: false });
        if (!rErr && dbReels) {
          reels = dbReels.map(r => ({
            id: String(r.id),
            username: r.username || '',
            initials: r.initials || 'AN',
            avatarColor: r.avatar_color || 'linear-gradient(135deg, #d4af37, #a07d1c)',
            verified: !!r.verified,
            following: false,
            location: r.location || '',
            description: r.description || '',
            tags: r.tags || '',
            music: r.music || '',
            likes: r.likes || 0,
            comments: r.comments || 0,
            reposts: r.reposts || 0,
            video: r.video || ''
          }));
          renderReels();
        }

        // Fetch profiles
        const { data: dbProfiles, error: prErr } = await supabase.from('profiles').select('*');
        if (!prErr && dbProfiles) {
          const userStr = localStorage.getItem('nazarethaUser');
          const localUser = userStr ? JSON.parse(userStr) : null;
          profiles = dbProfiles.map(p => ({
            ...p,
            me: localUser && (localUser.email === p.email || (localUser.first === p.first && localUser.surname === p.surname))
          }));
          ensureMeProfile();
          renderMyProfile();
        }
      } catch (err) {
        console.warn('Supabase loading notice:', err);
      }
    }

    function ensureMeProfile() {
      let me = profiles.find(p => p.me);
      if (!me) {
        let user = null;
        try { user = JSON.parse(localStorage.getItem('nazarethaUser')); } catch (e) {}
        const first = user && user.first ? user.first : 'Member';
        const surname = user && user.surname ? user.surname : '';
        const name = (first + ' ' + surname).trim();
        me = {
          name: name,
          first: first,
          surname: surname,
          initials: (first[0] || 'M') + (surname[0] || ''),
          avatarColor: 'linear-gradient(135deg, #d4af37, #a07d1c)',
          banner: 'linear-gradient(135deg, #f6d97a 0%, #c49a2c 45%, #5c4a12 100%)',
          bio: 'Walking the Shembe path with amaNazaretha.',
          type: 'Member',
          temple: (user && user.temple) ? user.temple : 'eBuhleni',
          joined: 'Just now',
          location: 'Durban',
          followers: 0,
          followingCount: 0,
          verified: false,
          following: false,
          me: true,
          avatarImage: (user && user.avatar) ? user.avatar : '',
          coverImage: (user && user.cover) ? user.cover : ''
        };
        profiles.unshift(me);
      }
      return me;
    }
    ensureMeProfile();\r\n\r\n`;

const newHtml = html.slice(0, idx1) + supabaseSnippet + html.slice(idx2);
fs.writeFileSync(filePath, newHtml, 'utf8');
console.log('Successfully updated HTML file with Supabase and removed dummy data!');
