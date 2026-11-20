// Public admission page: enroll.html?c=<link-name>
// Shows the centre's batches (only those switched on), subjects with "seat full", fees; then a short request form.
import { getClient, configured } from './db.js';
import { prefs, savePrefs, isBn, num, tk, subjSched } from './i18n.js';
import { $, esc, toast, normPhone, validPhone, applyTheme, sheet, closeSheet, head } from './ui.js';

const TX = {
  title: ['Online admission', 'অনলাইন ভর্তি'], welcome: ['Admission is open. See the courses, then send your request.', 'ভর্তি চলছে। কোর্সগুলো দেখে আবেদন পাঠান।'],
  details: ['Course details', 'কোর্সের বিস্তারিত'], detailsSub: ['Batches, subjects, class time and fees', 'ব্যাচ, বিষয়, ক্লাসের সময় ও ফি'],
  formT: ['Admission request', 'ভর্তির আবেদন'], formSub: ['We will call you to confirm admission.', 'ভর্তি নিশ্চিত করতে আমরা আপনাকে ফোন করব।'], req: ['marks required fields', 'চিহ্নিত ঘর আবশ্যক'],
  name: ['Student name', 'শিক্ষার্থীর নাম'], phone: ['Student phone', 'শিক্ষার্থীর ফোন'], wa: ['WhatsApp number or username', 'হোয়াটসঅ্যাপ নম্বর বা ইউজারনেম'], waHint: ['If different from the phone above', 'উপরের ফোন থেকে আলাদা হলে লিখুন'],
  school: ['School / college name', 'স্কুল / কলেজের নাম'], gphone: ['Guardian phone number', 'অভিভাবকের ফোন নম্বর'],
  want: ['Which batch and which subjects do you want?', 'কোন ব্যাচ, কোন কোন বিষয়ে পড়তে চান?'], wantEx: ['e.g. Prime Batch (HSC 28) — Physics + Higher Math', 'যেমন: প্রাইম ব্যাচ (HSC 28) — ফিজিক্স + হায়ার ম্যাথ'],
  wantHint: ['Write in your own words.', 'নিজের মতো করে লিখুন।'], see: ['See course details', 'কোর্সের বিস্তারিত দেখুন'],
  send: ['Send admission request', 'ভর্তির আবেদন পাঠান'], sentT: ['Request sent!', 'আবেদন পাঠানো হয়েছে!'], sentP: ['Thank you. The centre will call you soon to confirm. Fees are paid in cash at the centre.', 'ধন্যবাদ। সেন্টার শীঘ্রই ফোন করে ভর্তি নিশ্চিত করবে। ফি সেন্টারে নগদ দিতে হবে।'],
  another: ['Send another request', 'আরেকটি আবেদন পাঠান'], callC: ['Call the centre', 'সেন্টারে কল করুন'],
  subjects: ['Subjects & class time', 'বিষয় ও ক্লাসের সময়'], fees: ['Fees', 'ফি'], nSub: ['Subjects', 'বিষয়'], monthly: ['Monthly', 'মাসিক'], full: ['Full course', 'পুরো কোর্স'], nS: ['{n} subject(s)', '{n}টি বিষয়'],
  seatFull: ['Seat full', 'সিট পূর্ণ'], batchFull: ['Batch full', 'ব্যাচ পূর্ণ'], apply: ['Apply now', 'এখনই আবেদন করুন'], noCourses: ['Course list will be published soon.', 'কোর্স তালিকা শীঘ্রই প্রকাশ করা হবে।'],
  needName: ['Write the student name', 'শিক্ষার্থীর নাম লিখুন'], badPhone: ['Write a valid phone number (01XXXXXXXXX)', 'সঠিক ফোন নম্বর লিখুন (01XXXXXXXXX)'], needG: ['Write the guardian phone number', 'অভিভাবকের ফোন নম্বর লিখুন'],
  notFound: ['This admission link is not valid.', 'এই ভর্তির লিংকটি সঠিক নয়।'], inactive: ['Online admission is not open right now.', 'এখন অনলাইন ভর্তি বন্ধ আছে।'],
  rate: ['Too many requests from this number today. Please call the centre.', 'আজ এই নম্বর থেকে অনেক আবেদন হয়েছে। সেন্টারে ফোন করুন।'], err: ['Could not send. Check internet and try again.', 'পাঠানো যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।'],
  loading: ['Loading…', 'লোড হচ্ছে…'], setup: ['Setup needed: add Supabase URL and key in js/config.js', 'সেটআপ বাকি: js/config.js ফাইলে Supabase URL ও key দিন']
};
const tx = (k, v) => { let s = TX[k][isBn() ? 1 : 0]; if (v) for (const x in v) s = s.split('{' + x + '}').join(v[x]); return s; };
let slug = new URLSearchParams(location.search).get('c') || '', page = null, sent = null, sb = null, error = null;

function courseHtml(b) {
  return `<div class="course ${b.all_full ? 'isfull' : ''}"><h3>${esc(b.name)} ${b.label ? `<span class="pill ac">${esc(b.label)}</span>` : ''} ${b.all_full ? `<span class="pill due">${tx('batchFull')}</span>` : ''}</h3>
    ${b.note ? `<div class="note">📝 ${esc(b.note)}</div>` : ''}
    <div class="sec">📚 ${tx('subjects')}</div>${b.subjects.map(s => `<div class="subjrow ${s.full ? 'full' : ''}"><b>${esc(s.name)}</b><span>${subjSched(s) || ''}</span>${s.full ? `<span class="pill due">${tx('seatFull')}</span>` : ''}</div>`).join('')}
    ${b.fees.length ? `<div class="sec">৳ ${tx('fees')}</div><table class="fees"><thead><tr><th>${tx('nSub')}</th><th>${tx('monthly')}</th>${b.full_course_on ? `<th>${tx('full')}</th>` : ''}</tr></thead>
    <tbody>${b.fees.map(f => `<tr><td>${tx('nS', { n: num(f.n) })}</td><td>${f.monthly != null ? tk(f.monthly) : '—'}</td>${b.full_course_on ? `<td>${f.full != null ? tk(f.full) : '—'}</td>` : ''}</tr>`).join('')}</tbody></table>` : ''}</div>`;
}
function render() {
  applyTheme(); document.title = (page?.name ? page.name + ' · ' : '') + tx('title');
  const top = `<div class="top2"><span class="sm mut">🔒 ${tx('title')}</span><button class="hb" data-a="lang">${isBn() ? 'EN' : 'বাং'}</button></div>`;
  if (error || !page) { $('#root').innerHTML = `<main class="pub">${top}<div class="card center"><div class="e">${error ? '🔗' : '⏳'}</div><p>${error ? tx(error) : tx('loading')}</p></div></main>`; return; }
  const p = page;
  const hero = `<div class="hero pubhero">${p.logo_url ? `<img class="clogo big" src="${esc(p.logo_url)}" alt="">` : `<div class="logo big">${esc(p.name[0])}</div>`}<h1>${esc(p.name)}</h1>
    <div class="mut sm">${p.address ? '📍 ' + esc(p.address) : ''}${p.address && p.phone ? ' · ' : ''}${p.phone ? '📞 ' + num(esc(p.phone)) : ''}</div><p class="mut" style="margin:8px 0 0">${tx('welcome')}</p>
    <button class="btn white wide huge" data-a="details">📋 ${tx('details')}</button><div class="sm mut" style="margin-top:6px">${tx('detailsSub')}</div></div>`;
  const body = sent
    ? `<div class="card done"><div class="bigcheck">✓</div><h2>${tx('sentT')}</h2><p class="mut">${tx('sentP')}</p>
       <div class="slip"><div><span>${tx('name')}</span><b>${esc(sent.name)}</b></div><div><span>${tx('phone')}</span><b>${num(sent.phone)}</b></div>${sent.wa ? `<div><span>WhatsApp</span><b>${esc(sent.wa)}</b></div>` : ''}
       ${sent.school ? `<div><span>${tx('school')}</span><b>${esc(sent.school)}</b></div>` : ''}<div><span>${tx('gphone')}</span><b>${num(sent.gphone)}</b></div>${sent.msg ? `<p>📝 ${esc(sent.msg)}</p>` : ''}</div>
       ${p.phone ? `<a class="btn wide" href="tel:${esc(p.phone)}">📞 ${tx('callC')}</a>` : ''}<button class="btn ghost wide" data-a="again">${tx('another')}</button></div>`
    : `<form class="card" id="form" novalidate><h2 style="margin:0">${tx('formT')}</h2><p class="mut sm" style="margin:0">${tx('formSub')}</p><p class="sm mut" style="margin:4px 0 0"><span class="req">*</span> ${tx('req')}</p>
       <label>${tx('name')} <span class="req">*</span><input id="fName" autocomplete="name" maxlength="80"></label>
       <label>${tx('phone')} <span class="req">*</span><input id="fPhone" type="tel" inputmode="tel" placeholder="01XXXXXXXXX" autocomplete="tel"></label>
       <label>${tx('wa')}<input id="fWa" placeholder="01XXXXXXXXX / @username" autocapitalize="off" maxlength="60"></label><div class="sm mut">${tx('waHint')}</div>
       <label>${tx('school')}<input id="fSchool" maxlength="120"></label>
       <label>${tx('gphone')} <span class="req">*</span><input id="fGPhone" type="tel" inputmode="tel" placeholder="01XXXXXXXXX"></label>
       <label>${tx('want')}<textarea id="fMsg" rows="4" maxlength="1000" placeholder="${tx('wantEx')}"></textarea></label>
       <div class="sm mut">${tx('wantHint')} <button type="button" class="linkbtn" data-a="details">${tx('see')} →</button></div>
       <input id="fTrap" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
       <button class="btn pri wide huge" type="submit">📨 ${tx('send')}</button></form>`;
  $('#root').innerHTML = `<main class="pub">${top}${hero}${body}</main>`;
}
function details() {
  sheet(head(tx('details')) + (page.batches.length ? page.batches.map(courseHtml).join('') : `<p class="mut">${tx('noCourses')}</p>`) + `<button class="btn pri wide huge" data-a="apply">✍️ ${tx('apply')}</button>`);
}
document.addEventListener('click', e => {
  if (e.target.id === 'sheet') return closeSheet();
  const a = e.target.closest('[data-a],[data-act=closeSheet]'); if (!a) return;
  const k = a.dataset.a || 'close'; e.preventDefault();
  if (k === 'close') closeSheet();
  if (k === 'lang') { prefs.lang = isBn() ? 'en' : 'bn'; savePrefs(); render(); if (!$('#sheet').hidden) details(); }
  if (k === 'details') details();
  if (k === 'apply') { closeSheet(); const f = $('#fName'); if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => f.focus(), 300); } }
  if (k === 'again') { sent = null; render(); scrollTo(0, 0); }
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const v = id => ($('#' + id)?.value || '').trim(), bad = (id, m) => { const el = $('#' + id); el.classList.add('err'); el.focus(); toast(m); };
  $$err();
  if (v('fName').length < 2) return bad('fName', tx('needName'));
  if (!validPhone(v('fPhone'))) return bad('fPhone', tx('badPhone'));
  if (!v('fGPhone')) return bad('fGPhone', tx('needG'));
  if (!validPhone(v('fGPhone'))) return bad('fGPhone', tx('badPhone'));
  const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
  const args = { p_slug: page.slug, p_name: v('fName'), p_phone: v('fPhone'), p_whatsapp: v('fWa') || null, p_school: v('fSchool') || null, p_guardian_phone: v('fGPhone'), p_message: v('fMsg') || null, p_trap: v('fTrap') || null };
  const { error: err } = await sb.rpc('submit_enrolment', args);
  btn.disabled = false;
  if (err) return toast(String(err.message).includes('rate_limited') ? tx('rate') : String(err.message).includes('phone') ? tx('badPhone') : tx('err'));
  sent = { name: args.p_name, phone: normPhone(args.p_phone), wa: args.p_whatsapp, school: args.p_school, gphone: normPhone(args.p_guardian_phone), msg: args.p_message };
  render(); scrollTo({ top: 0, behavior: 'smooth' });
});
function $$err() { document.querySelectorAll('.err').forEach(x => x.classList.remove('err')); }

(async () => {
  render();
  if (!configured()) { error = 'setup'; return render(); }
  if (!slug) { error = 'notFound'; return render(); }
  sb = await getClient();
  const { data, error: err } = await sb.rpc('get_public_page', { p_slug: slug });
  if (err) { error = 'err'; return render(); }
  if (data.redirect) { slug = data.redirect; history.replaceState(null, '', '?c=' + slug); const r = await sb.rpc('get_public_page', { p_slug: slug }); page = r.data; }
  else if (data.error) error = data.error === 'inactive' ? 'inactive' : 'notFound';
  else page = data;
  render();
})();
