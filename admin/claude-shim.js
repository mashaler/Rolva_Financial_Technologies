/* Lets the loan manager run on your own website.
   It provides the small "window.claude" interface the manager expects,
   backed by Supabase (login, database, file storage). */
(function () {
  'use strict';
  var C = window.RF_CONFIG || {};
  if (!window.supabase || !C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.insertAdjacentHTML('afterbegin', '<p style="padding:16px;font:14px system-ui">This site is not configured yet. Add your Supabase URL and key to config.js.</p>');
    });
    return;
  }
  var sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  window.RF_SB = sb;
  var meP = null;
  var hang = function () { return new Promise(function () {}); };

  function who() {
    if (!meP) meP = (async function () {
      var s = await sb.auth.getSession();
      var u = s.data && s.data.session && s.data.session.user;
      if (!u) { location.replace('index.html'); return null; }
      var r = await sb.from('admins').select('user_id,role,name').eq('user_id', u.id).maybeSingle();
      if (!r.data) { await sb.auth.signOut(); location.replace('index.html?denied=1'); return null; }
      return { id: u.id, role: r.data.role, name: r.data.name };
    })();
    return meP;
  }

  function watch(name, o, cb, err) {
    var alive = true, timer = null;
    var load = async function () {
      var q = sb.from('docs').select('id,data').eq('collection', name);
      if (o.order) q = q.order('data->>' + o.order[0], { ascending: o.order[1] !== 'desc' });
      if (o.limit) q = q.limit(o.limit);
      var r = await q;
      if (!alive) return;
      if (r.error) { if (err) err(r.error); return; }
      cb({ docs: r.data.map(function (x) { return { id: x.id, data: function () { return x.data; } }; }) });
    };
    var soon = function () { clearTimeout(timer); timer = setTimeout(load, 150); };
    load();
    var ch = sb.channel('rf-' + name + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'collection=eq.' + name }, soon)
      .subscribe();
    return function () { alive = false; clearTimeout(timer); sb.removeChannel(ch); };
  }

  function query(name, o) {
    return {
      orderBy: function (f, d) { return query(name, Object.assign({}, o, { order: [f, d] })); },
      limit: function (n) { return query(name, Object.assign({}, o, { limit: n })); },
      onSnapshot: function (cb, err) { return watch(name, o, cb, err); }
    };
  }
  function ref(name, id) {
    return {
      set: async function (obj) {
        var r = await sb.from('docs').upsert({ collection: name, id: id, data: obj }, { onConflict: 'collection,id' });
        if (r.error) throw r.error;
      },
      delete: async function () {
        var r = await sb.from('docs').delete().eq('collection', name).eq('id', id);
        if (r.error) throw r.error;
      },
      onSnapshot: function (cb, err) {
        var alive = true, timer = null;
        var load = async function () {
          var r = await sb.from('docs').select('data').eq('collection', name).eq('id', id).maybeSingle();
          if (!alive) return;
          if (r.error) { if (err) err(r.error); return; }
          var d = r.data ? r.data.data : null;
          cb({ exists: !!r.data, data: function () { return d || {}; } });
        };
        var soon = function () { clearTimeout(timer); timer = setTimeout(load, 150); };
        load();
        var ch = sb.channel('rf-d-' + name + '-' + id + '-' + Math.random().toString(36).slice(2))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'collection=eq.' + name }, soon)
          .subscribe();
        return function () { alive = false; clearTimeout(timer); sb.removeChannel(ch); };
      }
    };
  }
  var dbApi = {
    collection: function (name) {
      var q = query(name, {});
      q.doc = function (id) { return ref(name, id); };
      q.add = async function (obj) {
        var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
        var r = await sb.from('docs').insert({ collection: name, id: id, data: obj });
        if (r.error) throw r.error;
        return { id: id };
      };
      return q;
    },
    doc: function (path) { var p = String(path).split('/'); return ref(p[0], p[1]); }
  };

  function userApi(m) {
    var owner = m.role === 'owner', edit = owner || m.role === 'editor';
    return {
      isOwner: async function () { return owner; },
      canEdit: async function () { return edit; },
      can: async function (n) { return n === 'data.write' ? m.role !== 'viewer' : true; },
      id: async function () { return m.id; },
      profiles: async function (ids) {
        var out = {};
        if (!ids || !ids.length) return out;
        var r = await sb.from('admins').select('user_id,name').in('user_id', ids);
        (r.data || []).forEach(function (x) { out[x.user_id] = { name: x.name || 'Staff' }; });
        return out;
      }
    };
  }
  var assetsApi = {
    upload: async function (file) {
      var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
      var r = await sb.storage.from('kyc').upload(id, file, { contentType: file.type || 'application/octet-stream' });
      if (r.error) throw r.error;
      return { id: id, url: '/_blob/' + id };
    }
  };
  function save(o) {
    var f = o.filename || 'file';
    var type = /\.csv$/i.test(f) ? 'text/csv;charset=utf-8' : /\.json$/i.test(f) ? 'application/json' : 'text/html;charset=utf-8';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([o.data], { type: type }));
    a.download = f;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return Promise.resolve();
  }

  window.claude = {
    use: async function (name) {
      var m = await who();
      if (!m) return hang();
      if (name === 'db') return dbApi;
      if (name === 'user') return userApi(m);
      if (name === 'assets') return (m.role === 'owner' || m.role === 'editor') ? assetsApi : null;
      if (name === 'downloads') return { save: save };
      return null;
    }
  };

  // Open uploaded KYC documents through a short-lived signed link.
  document.addEventListener('click', async function (e) {
    var a = e.target.closest && e.target.closest('a[href^="/_blob/"]');
    if (!a) return;
    e.preventDefault();
    var r = await sb.storage.from('kyc').createSignedUrl(a.getAttribute('href').slice(7), 120);
    if (r.data && r.data.signedUrl) window.open(r.data.signedUrl, '_blank', 'noopener');
  }, true);

  document.addEventListener('DOMContentLoaded', function () {
    var b = document.createElement('a');
    b.href = '#'; b.textContent = 'Sign out';
    b.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);right:12px;font:12px system-ui,sans-serif;color:inherit;opacity:.7;z-index:50';
    b.onclick = async function (e) { e.preventDefault(); await sb.auth.signOut(); location.replace('index.html'); };
    document.body.appendChild(b);
  });
})();
