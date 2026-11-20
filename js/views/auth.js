// Login, registration, password reset and status screens (pending / paused / not linked)
import { S } from '../store.js';
import { t, prefs, savePrefs } from '../i18n.js';
import { ACT, esc, toast, busy, $, svg, resizeImage } from '../ui.js';
import { errText, configured } from '../db.js';

const shell = inner => `<div class="authwrap"><div class="authtop"><button class="hb" data-act="toggleLang">${prefs.lang === 'bn' ? 'EN' : 'বাং'}</button></div>
  <div class="authcard"><div class="brand"><div class="logo big">${prefs.lang === 'bn' ? 'ক' : 'S'}</div><h1>${t('appName')}</h1><p class="mut">${t('tagline')}</p></div>${inner}</div></div>`;

export function authView() {
  if (!configured()) return shell(`<div class="info bad">${t('notConfigured')}</div>`);
  const m = S.recovery ? 'recover' : S.ui.authMode;
  if (m === 'sent') return shell(`<div class="info good" style="font-size:16px">📧 ${t('checkEmail')}</div><button class="btn wide" data-act="authMode" data-m="login">${t('login')}</button>`);
  if (m === 'forgot') return shell(`<form data-form="doForgot"><label>${t('email')}<input name="email" type="email" autocomplete="email" required></label>
    <button class="btn pri wide huge" type="submit">${t('sendReset')}</button></form><button class="btn ghost wide" data-act="authMode" data-m="login">← ${t('login')}</button>`);
  if (m === 'recover') return shell(`<form data-form="doRecover"><label>${t('newPassword')}<input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
    <button class="btn pri wide huge" type="submit">${t('setPassword')}</button></form>`);
  const tabs = `<div class="tabs two"><button class="${m === 'login' ? 'on' : ''}" data-act="authMode" data-m="login">${t('login')}</button><button class="${m !== 'login' ? 'on' : ''}" data-act="authMode" data-m="signup">${t('signup')}</button></div>`;
  if (m === 'login') return shell(tabs + `<form data-form="doLogin"><label>${t('email')}<input name="email" type="email" autocomplete="email" required></label>
    <label>${t('password')}<input name="password" type="password" autocomplete="current-password" required></label>
    <button class="btn pri wide huge" type="submit">${t('login')}</button></form><button class="btn ghost wide" data-act="authMode" data-m="forgot">${t('forgot')}</button>`);
  const staff = m === 'staff';
  return shell(tabs + `<div class="chips wrap"><button class="chip ${!staff ? 'on' : ''}" data-act="authMode" data-m="signup">🏫 ${t('regCentre')}</button><button class="chip ${staff ? 'on' : ''}" data-act="authMode" data-m="staff">👤 ${t('regStaff')}</button></div>
    <form data-form="doSignup" data-staff="${staff ? 1 : 0}">
    <label>${t('yourName')}<input name="full_name" required autocomplete="name"></label>
    ${staff ? '' : `<label>${t('centreName')}<input name="centre_name" required></label><label>${t('centrePhone')}<input name="phone" type="tel" inputmode="tel" placeholder="01XXXXXXXXX"></label>`}
    <label>${t('email')}<input name="email" type="email" autocomplete="email" required></label>
    <label>${t('password')} <span class="mut sm">(${t('pwHint')})</span><input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
    <button class="btn pri wide huge" type="submit">${t('signup')}</button></form>`);
}

export function statusView(kind) {
  const c = S.centre;
  const logo = c?.logo_url ? `<img class="clogo" src="${esc(c.logo_url)}" alt="">` : '';
  const body = {
    pending: `<div class="e">⏳</div><h2>${t('pendingT')}</h2><p class="mut">${t('pendingP')}</p>${logo}<h3>${esc(c?.name || '')}</h3>
      <label class="btn wide" style="margin-top:8px">${svg('user')} ${t('uploadLogo')}<input type="file" accept="image/png,image/jpeg,image/webp" data-inp="logoFile" hidden></label>`,
    suspended: `<div class="e">⏸️</div><h2>${t('suspendedT')}</h2><p class="mut">${t('suspendedP')}</p><h3>${esc(c?.name || '')}</h3>`,
    none: `<div class="e">🔗</div><h2>${t('noCentreT')}</h2><p class="mut">${t('noCentreP')}</p><p class="sm mut">${esc(S.user?.email || '')}</p>`
  }[kind];
  return `<div class="authwrap"><div class="authtop"><button class="hb" data-act="toggleLang">${prefs.lang === 'bn' ? 'EN' : 'বাং'}</button></div><div class="authcard center">${body}
    <button class="btn pri wide" data-act="reload">↻ ${t('checkAgain')}</button><button class="btn ghost wide" data-act="logout">${t('logout')}</button></div></div>`;
}

const formData = f => Object.fromEntries(new FormData(f).entries());

ACT.authMode = el => { S.ui.authMode = el.dataset.m; S.render(); };
ACT.toggleLang = () => { prefs.lang = prefs.lang === 'bn' ? 'en' : 'bn'; savePrefs(); S.render(); };
ACT.logout = async () => { await S.sb.auth.signOut(); S.reset(); };
ACT.reload = () => S.reload();

ACT.doLogin = async (f) => {
  const d = formData(f), b = f.querySelector('[type=submit]'); busy(b, true);
  const { error } = await S.sb.auth.signInWithPassword({ email: d.email.trim(), password: d.password });
  busy(b, false); if (error) toast(errText(error, t));
};
ACT.doSignup = async (f) => {
  const d = formData(f), staff = f.dataset.staff === '1', b = f.querySelector('[type=submit]');
  if (!d.full_name?.trim() || (!staff && !d.centre_name?.trim())) return toast(t('fillAll'));
  busy(b, true);
  const meta = staff ? { full_name: d.full_name.trim(), signup_type: 'staff' }
                     : { full_name: d.full_name.trim(), signup_type: 'owner', centre_name: d.centre_name.trim(), phone: (d.phone || '').trim() };
  const { data, error } = await S.sb.auth.signUp({ email: d.email.trim(), password: d.password,
    options: { data: meta, emailRedirectTo: location.origin + location.pathname } });
  busy(b, false);
  if (error) return toast(errText(error, t));
  if (!data.session) { S.ui.authMode = 'sent'; S.render(); }
};
ACT.doForgot = async (f) => {
  const d = formData(f), b = f.querySelector('[type=submit]'); busy(b, true);
  const { error } = await S.sb.auth.resetPasswordForEmail(d.email.trim(), { redirectTo: location.origin + location.pathname });
  busy(b, false); toast(error ? errText(error, t) : t('resetSent'));
};
ACT.doRecover = async (f) => {
  const d = formData(f), b = f.querySelector('[type=submit]'); busy(b, true);
  const { error } = await S.sb.auth.updateUser({ password: d.password });
  busy(b, false);
  if (error) return toast(errText(error, t));
  S.recovery = false; toast(t('saved')); S.reload();
};
