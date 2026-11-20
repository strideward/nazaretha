const fs = require('fs');
const filePath = 'C:/Users/ntuth/.gemini/antigravity/scratch/amanazaretha_church_app.html';
const html = fs.readFileSync(filePath, 'utf8');
const lines = html.split(/\r?\n/);

let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('//  DATA') && startIdx === -1) {
    startIdx = i - 1; // start at comment separator
  }
  if (lines[i].includes('//  FEED RENDER') && endIdx === -1) {
    endIdx = i - 1; // start of FEED RENDER section
    break;
  }
}

console.log('Lines range to replace:', startIdx, 'to', endIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find line indices');
  process.exit(1);
}

const supabaseCode = [
  '    // ============================================================',
  '    //  SUPABASE CLIENT & REAL DATA',
  '    // ============================================================',
  '    const SUPABASE_PROJECT_ID = "gzxbppwlfxtbybzxlocw";',
  '    const SUPABASE_URL = "https://gzxbppwlfxtbybzxlocw.supabase.co";',
  '    const SUPABASE_ANON_KEY = "sb_publishable_4XPZaxufxC9NnJ3CYMrmcw_K7Jff-9g";',
  '',
  '    // Initialize Supabase Client',
  '    const supabase = (typeof window.supabase !== "undefined" && window.supabase.createClient)',
  '      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)',
  '      : null;',
  '',
  '    // Clean data storage (all dummy data removed)',
  '    let profiles = [];',
  '    let posts = [];',
  '    let reels = [];',
  '    let eventsData = [];',
  '    let notifications = [];',
  '    let chats = [];',
  '    let messageRequests = [];',
  '    let postComments = {};',
  '    let reelComments = {};',
  '',
  '    // Load live data from Supabase',
  '    async function loadSupabaseData() {',
  '      if (!supabase) return;',
  '      try {',
  '        // Posts',
  '        const { data: dbPosts, error: postErr } = await supabase.from("posts").select("*").order("created_at", { ascending: false });',
  '        if (!postErr && dbPosts && dbPosts.length) {',
  '          posts = dbPosts.map(p => ({',
  '            id: p.id,',
  '            icon: p.icon || "sun",',
  '            title: p.title || "",',
  '            text: p.text || p.content || "",',
  '            tags: p.tags || "",',
  '            temple: p.temple || "eBuhleni",',
  '            time: p.created_at ? new Date(p.created_at).toLocaleDateString() : "Just now",',
  '            likes: p.likes || 0,',
  '            comments: p.comments || 0,',
  '            reposts: p.reposts || 0,',
  '            image: p.image || undefined,',
  '            video: p.video || undefined',
  '          }));',
  '          renderFeed();',
  '        }',
  '',
  '        // Events',
  '        const { data: dbEvents, error: evErr } = await supabase.from("events").select("*").order("created_at", { ascending: false });',
  '        if (!evErr && dbEvents && dbEvents.length) {',
  '          eventsData = dbEvents.map(e => ({',
  '            id: String(e.id),',
  '            day: e.day || "01",',
  '            month: e.month || "JAN",',
  '            title: e.title || "",',
  '            type: e.type || "Service",',
  '            dateLabel: e.date_label || "",',
  '            time: e.time || "",',
  '            venue: e.venue || "",',
  '            temple: e.temple || "",',
  '            host: e.host || "",',
  '            attending: e.attending || 0,',
  '            reminded: false,',
  '            description: e.description || "",',
  '            cover: e.cover || ""',
  '          }));',
  '          renderEvents();',
  '        }',
  '',
  '        // Reels',
  '        const { data: dbReels, error: rErr } = await supabase.from("reels").select("*").order("created_at", { ascending: false });',
  '        if (!rErr && dbReels && dbReels.length) {',
  '          reels = dbReels.map(r => ({',
  '            id: String(r.id),',
  '            username: r.username || "",',
  '            initials: r.initials || "AN",',
  '            avatarColor: r.avatar_color || "linear-gradient(135deg, #d4af37, #a07d1c)",',
  '            verified: !!r.verified,',
  '            following: false,',
  '            location: r.location || "",',
  '            description: r.description || "",',
  '            tags: r.tags || "",',
  '            music: r.music || "",',
  '            likes: r.likes || 0,',
  '            comments: r.comments || 0,',
  '            reposts: r.reposts || 0,',
  '            video: r.video || ""',
  '          }));',
  '          renderReels();',
  '        }',
  '',
  '        // Profiles',
  '        const { data: dbProfiles, error: prErr } = await supabase.from("profiles").select("*");',
  '        if (!prErr && dbProfiles) {',
  '          const userStr = localStorage.getItem("nazarethaUser");',
  '          const localUser = userStr ? JSON.parse(userStr) : null;',
  '          profiles = dbProfiles.map(p => ({',
  '            ...p,',
  '            me: localUser && (localUser.email === p.email || (localUser.first === p.first && localUser.surname === p.surname))',
  '          }));',
  '          ensureMeProfile();',
  '          renderMyProfile();',
  '        }',
  '      } catch (err) {',
  '        console.warn("Supabase load notice:", err);',
  '      }',
  '    }',
  '',
  '    function ensureMeProfile() {',
  '      let me = profiles.find(p => p.me);',
  '      if (!me) {',
  '        let user = null;',
  '        try { user = JSON.parse(localStorage.getItem("nazarethaUser")); } catch (e) {}',
  '        const first = user && user.first ? user.first : "Member";',
  '        const surname = user && user.surname ? user.surname : "";',
  '        const name = (first + " " + surname).trim();',
  '        me = {',
  '          name: name,',
  '          first: first,',
  '          surname: surname,',
  '          initials: ((first[0] || "M") + (surname[0] || "")).toUpperCase(),',
  '          avatarColor: "linear-gradient(135deg, #d4af37, #a07d1c)",',
  '          banner: "linear-gradient(135deg, #f6d97a 0%, #c49a2c 45%, #5c4a12 100%)",',
  '          bio: "Walking the Shembe path with amaNazaretha.",',
  '          type: "Member",',
  '          temple: (user && user.temple) ? user.temple : "eBuhleni",',
  '          joined: "Just now",',
  '          location: "Durban",',
  '          followers: 0,',
  '          followingCount: 0,',
  '          verified: false,',
  '          following: false,',
  '          me: true,',
  '          avatarImage: (user && user.avatar) ? user.avatar : "",',
  '          coverImage: (user && user.cover) ? user.cover : ""',
  '        };',
  '        profiles.unshift(me);',
  '      }',
  '      return me;',
  '    }',
  '    ensureMeProfile();',
  ''
];

const newLines = [
  ...lines.slice(0, startIdx),
  ...supabaseCode,
  ...lines.slice(endIdx)
];

fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
console.log('Successfully replaced dummy data with Supabase integration and empty data arrays!');
