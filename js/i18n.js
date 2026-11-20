// Language (Bangla / English), numbers, dates, times. Preferences stay on this device.
import { parseD } from './dates.js';

export const prefs = Object.assign(
  { lang: 'bn', theme: 0, bnf: 0, enf: 0, mode: 'auto', picker: 'app' },
  (() => { try { return JSON.parse(localStorage.getItem('sm_prefs') || '{}'); } catch (e) { return {}; } })()
);
export const savePrefs = () => { try { localStorage.setItem('sm_prefs', JSON.stringify(prefs)); } catch (e) {} };
export const isBn = () => prefs.lang === 'bn';
const L = () => (isBn() ? 1 : 0);

const T = {
  appName: ['Student Management', 'কোচিং ব্যবস্থাপনা'], tagline: ['Attendance, fees, exams — all in one place', 'হাজিরা, বেতন, পরীক্ষা — এক জায়গায়'],
  // navigation
  home: ['Home', 'হোম'], attend: ['Attendance', 'হাজিরা'], fees: ['Fees', 'বেতন'], students: ['Students', 'শিক্ষার্থী'], exams: ['Exams', 'পরীক্ষা'],
  requests: ['Admission requests', 'ভর্তির আবেদন'], batches: ['Batches & fees', 'ব্যাচ ও ফি'], staff: ['Staff', 'স্টাফ'], settings: ['Settings', 'সেটিংস'], more: ['More', 'আরও'], addNew: ['Add new', 'নতুন যোগ'],
  staffWord: ['Staff', 'স্টাফ'], batchesWord: ['Batches', 'ব্যাচ'], todayWord: ['Today', 'আজ'], back: ['Back', 'ফিরে যান'],
  // auth
  login: ['Log in', 'লগইন'], signup: ['Register', 'রেজিস্টার'], email: ['Email', 'ইমেইল'], password: ['Password', 'পাসওয়ার্ড'],
  forgot: ['Forgot password?', 'পাসওয়ার্ড ভুলে গেছেন?'], sendReset: ['Send reset link', 'রিসেট লিংক পাঠান'], resetSent: ['Check your email for the reset link', 'রিসেট লিংকের জন্য ইমেইল দেখুন'],
  newPassword: ['New password', 'নতুন পাসওয়ার্ড'], setPassword: ['Save new password', 'নতুন পাসওয়ার্ড সংরক্ষণ'],
  regCentre: ['Register a coaching centre', 'কোচিং সেন্টার রেজিস্টার'], regStaff: ['I was added as staff', 'আমাকে স্টাফ হিসেবে যোগ করা হয়েছে'],
  yourName: ['Your name', 'আপনার নাম'], centreName: ['Coaching centre name', 'কোচিং সেন্টারের নাম'], centrePhone: ['Centre phone', 'সেন্টারের ফোন'], pwHint: ['at least 8 characters', 'কমপক্ষে ৮ অক্ষর'],
  checkEmail: ['Almost done! Open the email we sent, tap the confirm link, then log in.', 'প্রায় শেষ! আমাদের পাঠানো ইমেইলের লিংকে চাপ দিয়ে নিশ্চিত করুন, তারপর লগইন করুন।'],
  logout: ['Log out', 'লগআউট'], notConfigured: ['Setup needed: add your Supabase URL and key in js/config.js', 'সেটআপ বাকি: js/config.js ফাইলে Supabase URL ও key দিন'],
  pendingT: ['Waiting for approval', 'অনুমোদনের অপেক্ষায়'], pendingP: ['Your centre is registered. You can start as soon as it is approved. Meanwhile you can add your logo.', 'আপনার সেন্টার রেজিস্টার হয়েছে। অনুমোদন পেলেই শুরু করতে পারবেন। এর মধ্যে লোগো যোগ করে রাখুন।'],
  suspendedT: ['Account paused', 'অ্যাকাউন্ট বন্ধ আছে'], suspendedP: ['This account is paused. Please contact the app admin or the coaching owner.', 'এই অ্যাকাউন্ট বন্ধ রাখা হয়েছে। অ্যাপ অ্যাডমিন বা কোচিং মালিকের সাথে যোগাযোগ করুন।'],
  noCentreT: ['Not linked to a centre', 'কোনো সেন্টারের সাথে যুক্ত নন'], noCentreP: ['Ask the coaching owner to add your email as staff, then log in again.', 'কোচিং মালিককে আপনার ইমেইল স্টাফ হিসেবে যোগ করতে বলুন, তারপর আবার লগইন করুন।'],
  checkAgain: ['Check again', 'আবার দেখুন'],
  // super admin
  superTitle: ['All coaching centres', 'সব কোচিং সেন্টার'], pending: ['Pending', 'অপেক্ষমাণ'], active: ['Active', 'সক্রিয়'], suspended: ['Paused', 'বন্ধ'],
  approve: ['Approve', 'অনুমোদন'], suspend: ['Pause', 'বন্ধ করুন'], reactivate: ['Reactivate', 'আবার চালু'], owner: ['Owner', 'মালিক'], registered: ['Registered', 'রেজিস্টার'],
  supportOpen: ['Support open until', 'সাপোর্ট খোলা'], openData: ['View data (read-only)', 'ডেটা দেখুন (শুধু দেখা)'], supportBanner: ['Support view — read-only', 'সাপোর্ট ভিউ — শুধু দেখা যাবে'], exit: ['Exit', 'বের হন'],
  confirmSuspend: ['Pause this centre? They will not be able to use the app.', 'এই সেন্টার বন্ধ করবেন? তারা অ্যাপ ব্যবহার করতে পারবে না।'],
  // home
  gm: ['Good morning', 'শুভ সকাল'], ga: ['Good afternoon', 'শুভ দুপুর'], ge: ['Good evening', 'শুভ সন্ধ্যা'],
  nClassesToday: ['{n} classes today', 'আজ {n}টি ক্লাস'], nFeesPending: ['{n} fees pending', '{n} জনের বেতন বাকি'],
  monthGoal: ['Collected this month', 'এ মাসে আদায়'], target: ['Target', 'লক্ষ্য'], stillLeft: ['{x} still to collect', 'আরও {x} আদায় বাকি'],
  qAttend: ['Take attendance', 'হাজিরা নিন'], qPay: ['Collect fee', 'টাকা জমা নিন'], qStudent: ['New student', 'নতুন শিক্ষার্থী'],
  todaySched: ["Today's classes", 'আজকের ক্লাস'], noClassToday: ['No class today', 'আজ কোনো ক্লাস নেই'], dueList: ['Fees pending', 'বেতন বাকি'], allClear: ['Everyone has paid. Great!', 'সবাই বেতন দিয়েছে। দারুণ!'],
  collect: ['Collect', 'জমা নিন'], startHere: ['Start here: create your first batch', 'এখান থেকে শুরু করুন: প্রথম ব্যাচ তৈরি করুন'],
  // guardian link
  shareTitle: ['Guardian link', 'অভিভাবকের লিংক'], shareHint: ['A private page where the student and guardian can see attendance, fees and exam results. No login needed.', 'একটি ব্যক্তিগত পেজ, যেখানে শিক্ষার্থী ও অভিভাবক হাজিরা, বেতন ও পরীক্ষার ফল দেখতে পারবে। লগইন লাগবে না।'],
  createLink: ['Create link', 'লিংক তৈরি করুন'], shareWa: ['Send on WhatsApp', 'হোয়াটসঅ্যাপে পাঠান'], preview: ['Preview', 'দেখুন'], resetLink: ['Reset link', 'লিংক বদলান'],
  confirmResetLink: ['The old link will stop working. Make a new one?', 'পুরোনো লিংক আর কাজ করবে না। নতুন লিংক বানাবেন?'], linkReset: ['New link made. Send it again.', 'নতুন লিংক তৈরি হয়েছে। আবার পাঠান।'], linkCreated: ['Link ready', 'লিংক তৈরি হয়েছে'],
  msgShare: ['{c}: See {n}\'s attendance, fees and exam results here: {u}', '{c}: {n}-এর হাজিরা, বেতন ও পরীক্ষার ফলাফল এই লিংকে দেখুন: {u}'],
  // fees
  paid: ['Paid', 'পরিশোধিত'], due: ['Due', 'বাকি'], dueSoon: ['Due soon', 'শীঘ্রই'], daysLate: ['days late', 'দিন দেরি'], dueToday: ['due today', 'আজ দেয়ার দিন'],
  paidUntil: ['Paid until', 'পরিশোধিত'], nextDue: ['Next', 'পরবর্তী'], plan: ['Payment plan', 'পেমেন্ট পদ্ধতি'], monthly: ['Monthly', 'মাসিক'], fullCourse: ['Full course', 'পুরো কোর্স'],
  perMonth: ['/month', '/মাস'], cash: ['Cash', 'নগদ'], collected: ['Collected', 'আদায়'], nPayments: ['{n} payments', '{n}টি পেমেন্ট'], byBatch: ['By batch', 'ব্যাচ অনুযায়ী'],
  payHistory: ['Payments', 'পেমেন্টসমূহ'], noPay: ['No payments', 'কোনো পেমেন্ট নেই'], feeSchedule: ['Fee schedule', 'বেতনের হিসাব'], covers: ['For', 'যে সময়ের'], advance: ['Advance', 'অগ্রিম'],
  whoPays: ['Who is paying?', 'কে টাকা দিচ্ছে?'], months: ['How many months?', 'কত মাসের?'], amount: ['Amount', 'টাকা'], date: ['Date', 'তারিখ'], change: ['Change', 'বদলান'],
  receive: ['Receive', 'জমা নিন'], received: ['received!', 'জমা হয়েছে!'], sendReceipt: ['Send receipt on WhatsApp', 'হোয়াটসঅ্যাপে রসিদ পাঠান'], done: ['Done', 'ঠিক আছে'], undo: ['Undo', 'ফিরিয়ে নিন'],
  undone: ['Payment removed', 'পেমেন্ট মুছে ফেলা হয়েছে'], needAmount: ['Enter the amount', 'টাকার পরিমাণ দিন'], remind: ['Remind', 'মনে করান'], payment: ['Payment', 'পেমেন্ট'],
  msgRemind: ['Assalamu Alaikum. Reminder from {c}: {n}\'s fee of {x} ({p}) is due. Thank you.', 'আসসালামু আলাইকুম। {c} থেকে জানানো হচ্ছে: {n}-এর {p} এর বেতন {x} বাকি আছে। অনুগ্রহ করে পরিশোধ করুন। ধন্যবাদ।'],
  msgReceipt: ['{c}: Received {x} cash for {n} on {d}, for {p}. Thank you.', '{c}: {d} তারিখে {n}-এর {p} এর জন্য {x} নগদ গ্রহণ করা হয়েছে। ধন্যবাদ।'],
  msgAbsent: ['{c}: {n} was absent from {s} class on {d}.', '{c}: {n} আজ ({d}) {s} ক্লাসে অনুপস্থিত ছিল।'],
  editPayment: ['Correct payment', 'পেমেন্ট সংশোধন'], editPaymentHint: ['Fix a wrong amount, date or student. Dues update automatically.', 'ভুল টাকা, তারিখ বা শিক্ষার্থী ঠিক করুন। বকেয়া নিজে থেকেই আপডেট হবে।'],
  deletePayment: ['Delete payment', 'পেমেন্ট মুছুন'], confirmDelPayment: ['Delete this payment of {x} ({d})?', '{d} তারিখের {x} পেমেন্টটি মুছবেন?'], student: ['Student', 'শিক্ষার্থী'],
  // attendance
  present: ['Present', 'উপস্থিত'], absent: ['Absent', 'অনুপস্থিত'], classHeld: ['Class held', 'ক্লাস হয়েছে'], notTaken: ['Attendance not taken yet', 'হাজিরা এখনো নেওয়া হয়নি'],
  startClass: ['Class happened — start attendance', 'ক্লাস হয়েছে — হাজিরা শুরু করুন'], tapHint: ['Everyone starts present. Tap the absent ones.', 'সবাই উপস্থিত ধরা আছে। শুধু অনুপস্থিতদের চাপ দিন।'],
  autoSaved: ['Saves by itself', 'নিজে থেকেই সেভ হয়'], allPresent: ['All present', 'সবাই উপস্থিত'], noClass: ['No class this day', 'এই দিন ক্লাস হয়নি'],
  confirmNoClass: ['Remove this class and its attendance?', 'এই ক্লাস ও তার হাজিরা মুছবেন?'], takeN: ['{n} students take this subject', '{n} জন এই বিষয় পড়ে'],
  notify: ['Tell guardian', 'অভিভাবককে জানান'], absentees: ['Absent', 'অনুপস্থিত'], takenBy: ['Taken by {x}', 'নিয়েছেন {x}'], nowTapAbsent: ['Now tap the absent ones', 'এবার অনুপস্থিতদের চাপ দিন'],
  // students
  search: ['Search name or phone', 'নাম বা ফোন লিখুন'], all: ['All', 'সব'], feeDue: ['Fee due', 'বেতন বাকি'], left: ['Left', 'ছেড়ে গেছে'],
  name: ['Student name', 'শিক্ষার্থীর নাম'], phone: ['Student phone', 'শিক্ষার্থীর ফোন'], whatsapp: ['WhatsApp number or username', 'হোয়াটসঅ্যাপ নম্বর বা ইউজারনেম'],
  guardianName: ['Guardian name', 'অভিভাবকের নাম'], guardianPhone: ['Guardian phone', 'অভিভাবকের ফোন'], school: ['School / college', 'স্কুল / কলেজ'],
  batch: ['Batch', 'ব্যাচ'], chooseSubjects: ['Subjects this student takes', 'যে বিষয়গুলো পড়বে'], fee: ['Fee (৳)', 'ফি (৳)'], feeFromTable: ['From fee table: {x}', 'ফি তালিকা থেকে: {x}'], useThis: ['Use this', 'এটা নিন'],
  admit: ['Admission date', 'ভর্তির তারিখ'], note: ['Note', 'নোট'], optional: ['optional', 'ঐচ্ছিক'], attendance: ['Attendance', 'উপস্থিতি'], avgMarks: ['Avg marks', 'গড় নম্বর'], call: ['Call', 'কল'],
  needStudent: ['Add name, a valid phone (01XXXXXXXXX) and at least one subject', 'নাম, সঠিক ফোন (01XXXXXXXXX) ও অন্তত একটি বিষয় দিন'], badGuardian: ['Guardian phone is not valid', 'অভিভাবকের ফোন সঠিক নয়'],
  noBatches: ['Create a batch first', 'আগে একটি ব্যাচ তৈরি করুন'], noSubjects: ['This batch has no subjects yet', 'এই ব্যাচে এখনো কোনো বিষয় নেই'], noStudents: ['No students yet', 'এখনো কোনো শিক্ষার্থী নেই'],
  markLeft: ['Mark as left', 'ছেড়ে গেছে চিহ্ন দিন'], markActive: ['Mark as active again', 'আবার সক্রিয় করুন'], delStudent: ['Delete student', 'শিক্ষার্থী মুছুন'],
  confirmDelStudent: ['Delete this student and all their records? This cannot be undone.', 'এই শিক্ষার্থী ও তার সব তথ্য মুছবেন? এটা আর ফেরানো যাবে না।'],
  // exams
  newExam: ['New exam', 'নতুন পরীক্ষা'], editExam: ['Edit exam', 'পরীক্ষা সম্পাদনা'], examType: ['Exam type', 'পরীক্ষার ধরন'], subject: ['Subject', 'বিষয়'], topic: ['Topic / chapter', 'টপিক / অধ্যায়'],
  mcq: ['MCQ', 'MCQ'], written: ['Written', 'লিখিত'], fullMarks: ['Full marks', 'পূর্ণ নম্বর'], passMark: ['Pass mark', 'পাস নম্বর'], passHint: ['Leave empty = BD rule (33%)', 'খালি রাখলে = BD নিয়ম (৩৩%)'],
  gradeRule: ['Grade: BD SSC/HSC scale (A+ 80%+ … F below 33%). Failing any part = F.', 'গ্রেড: BD SSC/HSC নিয়ম (A+ ৮০%+ … F ৩৩%-এর নিচে)। যেকোনো অংশে ফেল = F।'],
  rank: ['Rank', 'মেধাক্রম'], avg: ['Average', 'গড়'], highest: ['Highest', 'সর্বোচ্চ'], passed: ['Passed', 'পাস'], results: ['Results', 'ফলাফল'], failPart: ['Failed a part', 'একটি অংশে ফেল'],
  enterMarks: ['Enter marks', 'নম্বর দিন'], enterHint: ['Type a mark, press Enter for the next', 'নম্বর লিখে Enter চাপলে পরেরটায় যাবে'], saveMarks: ['Save marks', 'নম্বর সংরক্ষণ'], ab: ['Absent', 'অনুপ.'],
  marks: ['Marks', 'নম্বর'], noExam: ['No exams yet', 'এখনো কোনো পরীক্ষা নেই'], noMarksYet: ['No marks yet', 'এখনো নম্বর দেওয়া হয়নি'], noTypes: ['Add exam types in the batch settings', 'ব্যাচ সম্পাদনায় পরীক্ষার ধরন যোগ করুন'],
  needPart: ['Choose a subject, and turn on MCQ or Written with full marks', 'বিষয় বেছে নিন এবং MCQ বা লিখিত চালু করে পূর্ণ নম্বর দিন'],
  delExam: ['Delete exam', 'পরীক্ষা মুছুন'], confirmDelExam: ['Delete this exam and all its marks?', 'এই পরীক্ষা ও এর সব নম্বর মুছবেন?'],
  // requests
  newReq: ['New', 'নতুন'], contacted: ['Contacted', 'যোগাযোগ হয়েছে'], closed: ['Closed', 'শেষ'], admitted: ['Admitted', 'ভর্তি হয়েছে'], notAdmitted: ['Not admitted', 'ভর্তি হয়নি'],
  markContacted: ['Contacted', 'যোগাযোগ হয়েছে'], makeStudent: ['Make student', 'শিক্ষার্থী বানান'], reject: ['Reject', 'বাতিল'], noReq: ['No requests', 'কোনো আবেদন নেই'],
  confirmReject: ['Reject this request?', 'এই আবেদন বাতিল করবেন?'], openProfile: ['Open profile', 'প্রোফাইল দেখুন'], openPage: ['Open admission page', 'ভর্তির পেজ দেখুন'],
  justNow: ['just now', 'এইমাত্র'], hoursAgo: ['{n} h ago', '{n} ঘণ্টা আগে'],
  // batches
  newBatch: ['New batch', 'নতুন ব্যাচ'], editBatch: ['Edit batch', 'ব্যাচ সম্পাদনা'], batchName: ['Batch name', 'ব্যাচের নাম'], label: ['Label (e.g. HSC 28)', 'লেবেল (যেমন HSC 28)'],
  start: ['Course start', 'কোর্স শুরু'], end: ['Course end', 'কোর্স শেষ'], badDates: ['Course end must be after the start', 'কোর্স শেষের তারিখ শুরুর পরে হতে হবে'],
  subjects: ['Subjects', 'বিষয়'], subjectName: ['Subject name', 'বিষয়ের নাম'], addSubject: ['Add subject', 'বিষয় যোগ'], classDays: ['Class days', 'ক্লাসের দিন'], classTime: ['Class time', 'ক্লাসের সময়'],
  noTime: ['No time set', 'সময় দেওয়া নেই'], seatFull: ['Seat full', 'সিট পূর্ণ'], seatFullSwitch: ['Seat full (shows on admission page)', 'সিট পূর্ণ (ভর্তির পেজে দেখাবে)'], batchFull: ['Batch full', 'ব্যাচ পূর্ণ'],
  fullCourseOn: ['Offer full course payment', 'পুরো কোর্স পেমেন্ট চালু'], feeTable: ['Fee by number of subjects', 'বিষয় সংখ্যা অনুযায়ী ফি'], nSubj: ['{n} subject(s)', '{n}টি বিষয়'],
  examTypes: ['Exam types', 'পরীক্ষার ধরন'], addTypeHint: ['Add a type, e.g. Chapter-wise', 'ধরন লিখুন, যেমন অধ্যায়ভিত্তিক'], defType: ['Chapter-wise', 'অধ্যায়ভিত্তিক'],
  enrolPage: ['Admission page', 'ভর্তির পেজ'], showOnPage: ['Show this batch on the admission page', 'এই ব্যাচ ভর্তির পেজে দেখাও'], pageNote: ['Note for students', 'শিক্ষার্থীদের জন্য নোট'],
  pageNoteHint: ['e.g. Admission open until December', 'যেমন: ডিসেম্বর পর্যন্ত ভর্তি চলবে'], onPage: ['On admission page', 'ভর্তির পেজে আছে'], hiddenPage: ['Hidden from admission page', 'ভর্তির পেজে লুকানো'],
  batchesHint: ['Everything here also builds your admission page: show/hide each batch, mark subjects "seat full".', 'এখানকার তথ্য দিয়েই ভর্তির পেজ তৈরি হয়: প্রতিটি ব্যাচ দেখান/লুকান, বিষয়ে "সিট পূর্ণ" দিন।'],
  delBatch: ['Delete batch', 'ব্যাচ মুছুন'], confirmDelBatch: ['Delete this batch? This cannot be undone.', 'এই ব্যাচ মুছবেন? এটা আর ফেরানো যাবে না।'],
  confirmDelSubj: ['Removing a subject also removes it from students and its classes. Continue?', 'বিষয় মুছলে শিক্ষার্থী ও ক্লাস থেকেও মুছে যাবে। চালিয়ে যাবেন?'],
  needBatch: ['Add batch name and at least one subject', 'ব্যাচের নাম ও অন্তত একটি বিষয় দিন'], studentsN: ['{n} students', '{n} জন'],
  // pickers
  pickDate: ['Pick a date', 'তারিখ বাছুন'], todayBtn: ['Today', 'আজ'], clear: ['Clear', 'মুছুন'], setTime: ['Set time', 'সময় দিন'], hour: ['Hour', 'ঘণ্টা'], minute: ['Minute', 'মিনিট'], ok: ['OK', 'ঠিক আছে'],
  // staff
  addStaff: ['Add staff', 'স্টাফ যোগ'], editStaff: ['Edit staff', 'স্টাফ সম্পাদনা'], staffName: ['Staff name', 'স্টাফের নাম'],
  staffHint: ['Staff log in with their own email and see only what you tick, only for their batches. Fees stay hidden unless you allow them.', 'স্টাফরা নিজের ইমেইলে লগইন করবে এবং শুধু আপনার টিক দেওয়া কাজ, নিজের ব্যাচের জন্য দেখবে। অনুমতি না দিলে বেতন দেখবে না।'],
  whatCan: ['What can they do?', 'কী কী করতে পারবে?'], whichBatches: ['Which batches?', 'কোন ব্যাচ?'], pAttendance: ['Attendance', 'হাজিরা'], pExams: ['Exams & marks', 'পরীক্ষা ও নম্বর'],
  pPayments: ['Fees & payments', 'বেতন ও পেমেন্ট'], pStudents: ['Add/edit students & requests', 'শিক্ষার্থী ও আবেদন যোগ/সম্পাদনা'], invited: ['Invited — waiting to sign up', 'আমন্ত্রিত — সাইন আপের অপেক্ষায়'],
  paused: ['Paused', 'বন্ধ'], noPerms: ['No permissions', 'কোনো অনুমতি নেই'], noStaff: ['No staff yet', 'এখনো কোনো স্টাফ নেই'], badEmail: ['Enter a valid email', 'সঠিক ইমেইল দিন'], needBatchPick: ['Choose at least one batch', 'অন্তত একটি ব্যাচ বাছুন'],
  staffInvited: ['Invited. They can now register with this email.', 'আমন্ত্রণ দেওয়া হয়েছে। এই ইমেইল দিয়ে রেজিস্টার করলেই যুক্ত হবে।'], staffLinked: ['Added. They can log in now.', 'যুক্ত হয়েছে। এখন লগইন করতে পারবে।'],
  pauseLogin: ['Pause this login', 'এই লগইন বন্ধ করুন'], resumeLogin: ['Turn login back on', 'লগইন আবার চালু'], removeStaff: ['Remove staff', 'স্টাফ সরান'], confirmRemoveStaff: ['Remove this staff member?', 'এই স্টাফকে সরাবেন?'],
  staffOf: ['Staff of {c}', '{c}-এর স্টাফ'],
  // settings
  appearance: ['Appearance', 'দেখতে কেমন'], deviceOnly: ['Saved on this phone/computer only', 'শুধু এই ফোন/কম্পিউটারে সংরক্ষিত'], language: ['Language', 'ভাষা'], modeL: ['Light / Dark', 'লাইট / ডার্ক'],
  auto: ['Auto', 'অটো'], light: ['Light', 'লাইট'], dark: ['Dark', 'ডার্ক'], themeColour: ['Theme colour', 'থিম রং'], bnFont: ['Bangla font', 'বাংলা ফন্ট'], enFont: ['English font', 'ইংরেজি ফন্ট'],
  pickerL: ['Date & time picker', 'তারিখ ও সময় বাছাই'], pickerApp: ['In-app', 'অ্যাপের নিজস্ব'], pickerPhone: ["Phone's own", 'ফোনের নিজস্ব'],
  pickerHint: ['If dates or times do not save on this phone, use "In-app".', 'এই ফোনে তারিখ/সময় সেভ না হলে "অ্যাপের নিজস্ব" ব্যবহার করুন।'],
  centreProfile: ['Centre profile', 'সেন্টারের তথ্য'], address: ['Address', 'ঠিকানা'], uploadLogo: ['Upload logo', 'লোগো আপলোড'],
  enrolLink: ['Admission link', 'ভর্তির লিংক'], enrolLinkP: ['Share this link. Students see your batches and send an admission request. You can change the last part.', 'এই লিংক শেয়ার করুন। শিক্ষার্থীরা আপনার ব্যাচ দেখে ভর্তির আবেদন পাঠাবে। শেষের অংশটা বদলাতে পারবেন।'],
  pageFromBatches: ['What the page shows comes from', 'পেজে কী দেখাবে তা ঠিক হয়'], copy: ['Copy', 'কপি'], copied: ['Copied', 'কপি হয়েছে'], changeLink: ['Save link', 'লিংক সংরক্ষণ'], slugHint: ['Small English letters, numbers and -', 'ছোট ইংরেজি অক্ষর, সংখ্যা ও -'],
  support: ['Support access', 'সাপোর্ট অ্যাক্সেস'], supportP: ['Lets the app admin view (not change) your data for 3 days to help you. Turns off by itself.', 'সাহায্যের জন্য অ্যাপ অ্যাডমিনকে ৩ দিন আপনার ডেটা দেখতে (বদলাতে নয়) দেয়। নিজে থেকেই বন্ধ হয়ে যায়।'],
  allowSupport: ['Allow for 3 days', '৩ দিনের জন্য দিন'], stopSupport: ['Stop now', 'এখনই বন্ধ'], supportOff: ['Off', 'বন্ধ'], supportOnUntil: ['On until {d}', '{d} পর্যন্ত চালু'],
  account: ['Account', 'অ্যাকাউন্ট'],
  // common
  save: ['Save', 'সংরক্ষণ'], saved: ['Saved', 'সংরক্ষিত হয়েছে'], cancel: ['Cancel', 'বাতিল'], edit: ['Edit', 'সম্পাদনা'], del: ['Delete', 'মুছুন'], loading: ['Loading…', 'লোড হচ্ছে…'], none: ['Nothing here', 'কিছু নেই'],
  fillAll: ['Please fill the required fields', 'আবশ্যক ঘরগুলো পূরণ করুন'],
  // errors
  errLogin: ['Wrong email or password', 'ইমেইল বা পাসওয়ার্ড ভুল'], errConfirm: ['Please confirm your email first', 'আগে ইমেইল নিশ্চিত করুন'], errExists: ['This email is already registered', 'এই ইমেইল আগেই রেজিস্টার করা'],
  errPassword: ['Password is too short', 'পাসওয়ার্ড খুব ছোট'], errSlugTaken: ['This link name is taken', 'এই লিংক নাম আগেই নেওয়া'], errSlugInvalid: ['Use 3–40 small letters, numbers or -', '৩–৪০টি ছোট অক্ষর, সংখ্যা বা - দিন'],
  errDenied: ['You do not have permission for this', 'এটা করার অনুমতি নেই'], errBatchHasStudents: ['This batch has students. Move or delete them first.', 'এই ব্যাচে শিক্ষার্থী আছে। আগে তাদের সরান বা মুছুন।'],
  errInUse: ['This is still in use', 'এটা এখনো ব্যবহার হচ্ছে'], errNetwork: ['No internet connection', 'ইন্টারনেট সংযোগ নেই'], errRate: ['Too many tries. Wait a bit.', 'অনেকবার চেষ্টা হয়েছে। একটু অপেক্ষা করুন।'],
  errGeneric: ['Something went wrong', 'কিছু একটা সমস্যা হয়েছে'],
};
export const t = (k, v) => { let s = (T[k] || [k, k])[L()]; if (v) for (const x in v) s = s.split('{' + x + '}').join(v[x]); return s; };

const BN = '০১২৩৪৫৬৭৮৯';
export const num = x => (isBn() ? String(x).replace(/\d/g, d => BN[d]) : String(x));
export const tk = n => '৳' + num(Math.round(Number(n) || 0).toLocaleString('en-IN'));
const MON = [['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], ['জানু','ফেব্রু','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টে','অক্টো','নভে','ডিসে']];
const MONF_ = [['January','February','March','April','May','June','July','August','September','October','November','December'], ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর']];
const DAY = [['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], ['রবি','সোম','মঙ্গল','বুধ','বৃহস্পতি','শুক্র','শনি']];
const DSHORT = [['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], ['রবি','সোম','মঙ্গল','বুধ','বৃহঃ','শুক্র','শনি']];
const DMINI = [['Su','Mo','Tu','We','Th','Fr','Sa'], ['র','সো','ম','বু','বৃ','শু','শ']];
export const WEEK = [6, 0, 1, 2, 3, 4, 5];                       // Bangladesh week starts Saturday
export const MONF = () => MONF_[L()];
export const DAY_MINI = () => DMINI[L()];
export const dayName = d => DAY[L()][d];
export const dayShort = d => DSHORT[L()][d];
export const dayLong = ds => DAY[L()][parseD(ds).getDay()] + (isBn() ? 'বার' : '');
export const fd = s => { if (!s) return '—'; const d = parseD(s); return num(d.getDate()) + ' ' + MON[L()][d.getMonth()] + (d.getFullYear() === new Date().getFullYear() ? '' : ' ' + num(d.getFullYear())); };
export const fdFull = s => { if (!s) return '—'; const d = parseD(s); return num(d.getDate()) + ' ' + MONF_[L()][d.getMonth()] + ' ' + num(d.getFullYear()); };
const pad = n => String(n).padStart(2, '0');
// "15:30" → "বিকাল ৩:৩০" / "3:30 PM"
export const ftime = hm => {
  if (!hm) return '';
  const [h, m] = hm.slice(0, 5).split(':').map(Number);
  if (!isBn()) return (h % 12 || 12) + ':' + pad(m) + ' ' + (h < 12 ? 'AM' : 'PM');
  const p = h < 5 ? 'রাত' : h < 6 ? 'ভোর' : h < 12 ? 'সকাল' : h < 15 ? 'দুপুর' : h < 18 ? 'বিকাল' : h < 20 ? 'সন্ধ্যা' : 'রাত';
  return p + ' ' + num((h % 12 || 12) + ':' + pad(m));
};
const joinList = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + (isBn() ? ' ও ' : ' & ') + a[a.length - 1]);
export const daysText = days => joinList(WEEK.filter(x => (days || []).includes(x)).map(dayName)) + (isBn() && (days || []).length ? 'বার' : '');
export const subjSched = s => [daysText(s.days), ftime(s.start_time || s.time)].filter(Boolean).join(' · ');
