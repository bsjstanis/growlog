import { SB_URL, SB_KEY } from './config.js';

export async function sb(table, method, body, query) {
  method = method || 'GET'; query = query || '';
  var h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
  if (method === 'POST') h['Prefer'] = 'return=representation';
  if (method === 'PATCH') h['Prefer'] = 'return=representation';
  var r = await fetch(SB_URL + '/rest/v1/' + table + query, { method: method, headers: h, body: body ? JSON.stringify(body) : null });
  if (!r.ok) { var e = await r.text(); throw new Error(e); }
  if (method === 'DELETE') return null;
  var txt = await r.text(); return txt ? JSON.parse(txt) : null;
}

export async function uploadPhoto(file) {
  var ext = file.name.split('.').pop();
  var path = 'harvests/' + Date.now() + '.' + ext;
  var r = await fetch(SB_URL + '/storage/v1/object/plant-photos/' + path, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': file.type },
    body: file
  });
  if (!r.ok) throw new Error('Photo upload failed');
  return SB_URL + '/storage/v1/object/public/plant-photos/' + path;
}
