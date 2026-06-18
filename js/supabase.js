import { SB_URL, SB_KEY } from './config.js';

// Session stored in memory + localStorage
var _session = null;

export function setSession(s) { _session = s; }
export function getStoredSession() { return _session; }

export async function sb(table, method, body, query) {
  method = method || 'GET'; query = query || '';
  var token = (_session && _session.access_token) ? _session.access_token : SB_KEY;
  var h = { apikey: SB_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  if (method === 'POST') h['Prefer'] = 'return=representation';
  if (method === 'PATCH') h['Prefer'] = 'return=representation';
  var r = await fetch(SB_URL + '/rest/v1/' + table + query, {
    method: method, headers: h, body: body ? JSON.stringify(body) : null
  });
  if (!r.ok) { var e = await r.text(); throw new Error(e); }
  if (method === 'DELETE') return null;
  var txt = await r.text(); return txt ? JSON.parse(txt) : null;
}

export async function uploadPhoto(file) {
  var token = (_session && _session.access_token) ? _session.access_token : SB_KEY;
  var ext = file.name.split('.').pop();
  var path = 'harvests/' + Date.now() + '.' + ext;
  var r = await fetch(SB_URL + '/storage/v1/object/plant-photos/' + path, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + token, 'Content-Type': file.type },
    body: file
  });
  if (!r.ok) throw new Error('Photo upload failed');
  return SB_URL + '/storage/v1/object/public/plant-photos/' + path;
}
