// Settings: appearance + pickers (this device), centre profile + logo, enrolment link, support access, account
import { S, isOwner } from '../store.js';
import { t, prefs, savePrefs, isBn } from '../i18n.js';
import { ACT, INP, esc, toast, busy, THEMES, BNF, ENF, applyTheme, resizeImage, svg, val, $ } from '../ui.js';
import { errText } from '../db.js';

export const enrolUrl = slug => location.origin + location.pathname.replace(/[^/]*$/, '') + 'enroll.html?c=' + slug;

export function settingsView() {
  const c = S.centre, supOn = c?.support_until && new Date(c.support_until).getTime() > Date.now();
  const until = supOn ? new Date(c.support_until).toLocaleString(isBn() ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  const opt = (act, cur, items) => `<div class="opt">${items.map(([v, label, style]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" ${style ? `style="${style}"` : ''} data-act="${act}" data-v="${v}">${label}</button>`).join('')}</div>`;
  return `<h2>${t('settings')}</h2><div class="cols"><div>
  <div class="card"><h3>${t('appearance')}</h3><p class="sm mut" style="margin:0">${t('deviceOnly')}</p>
    <div class="lab">${t('language')}</div>${opt('setLang', prefs.lang, [['bn', 'বাংলা'], ['en', 'English']])}
    <div class="lab">${t('modeL')}</div>${opt('setMode', prefs.mode, [['auto', '🌓 ' + t('auto')], ['light', '☀️ ' + t('light')], ['dark', '🌙 ' + t('dark')]])}
    <div class="lab">${t('themeColour')}</div><div class="sw">${THEMES.map((x, i) => `<button class="${i === prefs.theme ? 'on' : ''}" style="background:${x[2]}" data-act="setTheme" data-v="${i}" aria-label="${x[0]}" title="${x[isBn() ? 1 : 0]}">${i === prefs.theme ? '✓' : ''}</button>`).join('')}</div>
    <div class="lab">${t('bnFont')}</div>${opt('setBnf', prefs.bnf, BNF.map((f, i) => [i, `হাজিরা খাতা<br><small>${f}</small>`, `font-family:'${f}'`]))}
    <div class="lab">${t('enFont')}</div>${opt('setEnf', prefs.enf, ENF.map((f, i) => [i, `Physics 2026<br><small>${f}</small>`, `font-family:'${f}'`]))}
    <div class="lab">${t('pickerL')}</div>${opt('setPicker', prefs.picker, [['app', '📅 ' + t('pickerApp')], ['phone', '📱 ' + t('pickerPhone')]])}
    <p class="sm mut" style="margin:6px 0 0">${t('pickerHint')}</p></div>
  ${c && isOwner() ? `<div class="card"><h3>${t('centreProfile')}</h3>
    <div class="row" style="padding-top:0">${c.logo_url ? `<img class="clogo" src="${esc(c.logo_url)}" alt="">` : `<span class="logo big">${esc(c.name[0])}</span>`}
      <label class="btn sm" style="margin:0;color:var(--ink)">${t('uploadLogo')}<input type="file" accept="image/png,image/jpeg,image/webp" data-inp="logoFile" hidden></label></div>
    <label>${t('centreName')}<input id="cName" value="${esc(c.name)}"></label>
    <label>${t('centrePhone')}<input id="cPhone" type="tel" value="${esc(c.phone || '')}"></label>
    <label>${t('address')}<input id="cAddr" value="${esc(c.address || '')}"></label>
    <button class="btn pri wide" data-act="saveCentre">✓ ${t('save')}</button></div>` : ''}
  </div><div>
  ${c && isOwner() ? `<div class="card"><h3>${svg('link')} ${t('enrolLink')}</h3><p class="sm mut">${t('enrolLinkP')}</p>
    <div class="linkbox"><code>${esc(enrolUrl(c.slug))}</code><button class="btn sm" data-act="copyLink">${t('copy')}</button></div>
    <div class="slugrow"><span class="mut">…?c=</span><input id="slugIn" value="${esc(c.slug)}" autocapitalize="off" spellcheck="false"></div>
    <div class="sm mut">${t('slugHint')}</div><button class="btn wide" data-act="saveSlug">${t('changeLink')}</button>
    <a class="btn wide" href="${enrolUrl(c.slug)}" target="_blank" rel="noopener">👁 ${t('openPage')}</a>
    <p class="sm mut">${t('pageFromBatches')} <a href="#batches">${t('batches')} →</a></p></div>
  <div class="card"><h3>${svg('shield')} ${t('support')}</h3><p class="sm mut">${t('supportP')}</p>
    <div class="bar"><span class="pill ${supOn ? 'ok' : ''}">${supOn ? t('supportOnUntil', { d: until }) : t('supportOff')}</span></div>
    ${supOn ? `<button class="btn danger wide" data-act="setSupport" data-v="0">${t('stopSupport')}</button>` : `<button class="btn wide" data-act="setSupport" data-v="1">${t('allowSupport')}</button>`}</div>` : ''}
  <div class="card"><h3>${t('account')}</h3><p class="mut" style="margin:0">${esc(S.profile?.full_name || '')}<br>${esc(S.user?.email || '')}</p>
    ${S.member?.role === 'staff' ? `<p class="sm mut">${t('staffOf', { c: esc(c.name) })}</p>` : ''}
    <button class="btn ghost danger wide" data-act="logout">${t('logout')}</button></div>
  </div></div>`;
}

const setP = (k, v) => { prefs[k] = v; savePrefs(); applyTheme(); S.render(); };
ACT.setLang = el => setP('lang', el.dataset.v);
ACT.setMode = el => setP('mode', el.dataset.v);
ACT.setTheme = el => setP('theme', +el.dataset.v);
ACT.setBnf = el => setP('bnf', +el.dataset.v);
ACT.setEnf = el => setP('enf', +el.dataset.v);
ACT.setPicker = el => setP('picker', el.dataset.v);

ACT.saveCentre = async el => {
  const name = val('cName').trim(); if (name.length < 2) return toast(t('fillAll'));
  busy(el, true);
  const { data, error } = await S.sb.from('centres').update({ name, phone: val('cPhone').trim() || null, address: val('cAddr').trim() || null }).eq('id', S.centre.id).select().single();
  busy(el, false);
  if (error) return toast(errText(error, t));
  S.centre = data; toast(t('saved')); S.render();
};
INP.logoFile = async el => {
  const f = el.files && el.files[0]; if (!f) return;
  try {
    const blob = await resizeImage(f, 256), path = `${S.centre.id}/logo-${Date.now()}.png`;
    const up = await S.sb.storage.from('logos').upload(path, blob, { contentType: 'image/png', upsert: true }); if (up.error) throw up.error;
    const url = S.sb.storage.from('logos').getPublicUrl(path).data.publicUrl;
    const { data, error } = await S.sb.from('centres').update({ logo_url: url }).eq('id', S.centre.id).select().single(); if (error) throw error;
    S.centre = data; toast(t('saved')); S.render();
  } catch (e) { toast(errText(e, t)); }
};
ACT.copyLink = async () => { try { await navigator.clipboard.writeText(enrolUrl(S.centre.slug)); toast(t('copied')); } catch (e) { toast(enrolUrl(S.centre.slug)); } };
ACT.saveSlug = async el => {
  const v = val('slugIn').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(v)) return toast(t('errSlugInvalid'));
  busy(el, true);
  const { data, error } = await S.sb.rpc('change_slug', { c: S.centre.id, new_slug: v });
  busy(el, false);
  if (error) return toast(errText(error, t));
  S.centre.slug = data; toast(t('saved')); S.render();
};
ACT.setSupport = async el => {
  busy(el, true);
  const { data, error } = await S.sb.rpc('set_support', { c: S.centre.id, allow: el.dataset.v === '1' });
  busy(el, false);
  if (error) return toast(errText(error, t));
  S.centre.support_until = data; toast(t('saved')); S.render();
};
