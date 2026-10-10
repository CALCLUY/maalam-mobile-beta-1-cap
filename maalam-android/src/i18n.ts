/**
 * Interface language (Arabic / French / English) for the phone UI.
 *
 * Only the interface changes: buttons, menus, sheets and the home screen.
 * The tutor keeps teaching in Darija, and the board content is untouched.
 *
 *  - t(key)         → strings written by this project.
 *  - tr(text)       → translates strings that come from the remote Maalam app.
 *  - A DOM translator rewrites the remote app's home screen and composer text
 *    in place (and restores the original when switching back to Arabic).
 */

export type Lang = "ar" | "fr" | "en";

export const LANGS: { id: Lang; name: string; short: string }[] = [
  { id: "ar", name: "العربية", short: "ع" },
  { id: "fr", name: "Français", short: "FR" },
  { id: "en", name: "English", short: "EN" },
];

import { storageGet, storageSet } from "./platform/storage";
import { trackOverlay, untrackOverlay } from "./platform/overlays";
import { withInsetFallback } from "./platform/inset-css";

const LANG_KEY = "maalam.phone.lang.v1";

function readSavedLang(): Lang {
  try {
    const value = storageGet(LANG_KEY);
    if (value === "ar" || value === "fr" || value === "en") return value;
  } catch {
    /* storage unavailable */
  }
  return "ar";
}

let current: Lang = readSavedLang();
const listeners = new Set<(lang: Lang) => void>();

export const getLang = (): Lang => current;
export const isRtl = (): boolean => current === "ar";
export const uiDir = (): "rtl" | "ltr" => (current === "ar" ? "rtl" : "ltr");
export const dateLocale = (): string => ({ ar: "ar-MA", fr: "fr-FR", en: "en-GB" })[current];

export function onLangChange(listener: (lang: Lang) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ============================ own strings ============================ */

type Entry = { ar: string; fr: string; en: string };
const e = (ar: string, fr: string, en: string): Entry => ({ ar, fr, en });

const STRINGS = {
  close: e("سدّ", "Fermer", "Close"),
  toolsMenu: e("أدوات التحكم", "Outils", "Tools"),
  history: e("سجل المحادثات", "Historique des conversations", "Conversation history"),
  continueLesson: e("كمّل الشرح", "Continuer l'explication", "Continue the lesson"),
  eraseAndContinueFull: e("امسح السبورة وكمّل", "Effacer le tableau et continuer", "Erase the board and continue"),
  camera: e("تصوّر بالكاميرا", "Prendre une photo", "Take a photo"),
  upload: e("رفع صورة أو PDF", "Importer une image ou un PDF", "Upload an image or PDF"),
  chat: e("الدردشة", "Discussion", "Chat"),
  chatHide: e("خبّي الدردشة", "Masquer la discussion", "Hide chat"),
  settings: e("إعدادات التعلّم", "Réglages d'apprentissage", "Learning settings"),
  erase: e("مسح السبورة", "Effacer le tableau", "Erase board"),
  eraseContinue: e("امسح وكمّل", "Effacer et continuer", "Erase and continue"),
  language: e("اللغة", "Langue", "Language"),
  uiLanguage: e("لغة الواجهة", "Langue de l'interface", "Interface language"),
  langHint: e(
    "هادي كتبدّل لغة الواجهة غير، الأستاذ كيبقى كيهضر بالدارجة.",
    "Cela ne change que la langue de l'interface : le prof continue de parler en darija.",
    "This only changes the interface language — the tutor keeps speaking Darija.",
  ),
  closeChat: e("سدّ الدردشة", "Fermer la discussion", "Close chat"),
  hideQuestion: e("خبّي السؤال", "Masquer la question", "Hide question"),
  saveSettings: e("حفظ الإعدادات", "Enregistrer les réglages", "Save settings"),
  appSettings: e("إعدادات التطبيق", "Réglages de l'application", "App settings"),
  haptics: e("الاهتزاز", "Vibrations", "Haptics"),
  hapticsOn: e("مفعّل", "Activées", "On"),
  hapticsOff: e("مطفّى", "Désactivées", "Off"),
  liteMode: e("الوضع الخفيف", "Mode léger", "Lite mode"),
  liteAuto: e("تلقائي", "Auto", "Auto"),
  liteOn: e("ديما مفعّل", "Toujours activé", "Always on"),
  liteOff: e("مطفّى", "Désactivé", "Off"),
  clearData: e("مسح كل البيانات", "Effacer toutes les données", "Clear all data"),
  clearDataHint: e(
    "كيمسح المفتاح، السجل و الإعدادات من هاد التطبيق.",
    "Supprime la clé, l'historique et les réglages de cette application.",
    "Removes the key, history and settings from this app.",
  ),
  clearDataArm: e("اضغط مرة أخرى للتأكيد", "Touchez encore pour confirmer", "Tap again to confirm"),
  dataCleared: e("تمسحات كل البيانات.", "Toutes les données ont été effacées.", "All data cleared."),

  askQuiz: e("اختار الجواب", "Choisis la réponse", "Choose the answer"),
  askChat: e("دردشة مع Maalam", "Discussion avec Maalam", "Chat with Maalam"),
  askQuestion: e("سؤال الأستاذ — جاوب بوحيدك", "Question du prof — réponds ici", "Teacher's question — answer here"),
  phChat: e("كتب سؤالك لـ Maalam…", "Écris ta question à Maalam…", "Ask Maalam a question…"),
  phAnswer: e("كتب جوابك هني…", "Écris ta réponse ici…", "Type your answer here…"),
  send: e("صيفط", "Envoyer", "Send"),
  sendAnswer: e("صيفط الجواب", "Envoyer la réponse", "Send answer"),

  betaChip: e("BETA", "BÊTA", "BETA"),
  betaShort: e("نسخة تجريبية", "Version bêta", "Beta version"),
  betaNote: e(
    "BETA — Maalam باقي فمرحلة التجريب. ممكن تواجه شي أخطاء، والتحسينات كتجي بالتدريج.",
    "BÊTA — Maalam est encore en phase de test. Des erreurs peuvent survenir ; des améliorations arrivent régulièrement.",
    "BETA — Maalam is still in testing. You may run into bugs; improvements are on the way.",
  ),
  lastStep: e("الخطوة الأخيرة", "Dernière étape", "Last step"),
  docTitle: e(
    "Maalam Beta — معلّمك بالدارجة مع السبورة",
    "Maalam bêta — ton prof en darija, avec tableau",
    "Maalam beta — your Darija tutor with a blackboard",
  ),
  docDesc: e(
    "Maalam — معلّمك بالدارجة المغربية: يهضر معاك بالصوت، يكتب على السبورة، ويقرا الصور والـ PDF بما فيها المعادلات.",
    "Maalam : un prof qui te parle en darija marocaine, écrit au tableau et lit images et PDF, équations comprises.",
    "Maalam: a tutor that talks to you in Moroccan Darija, writes on a blackboard, and reads images and PDFs, equations included.",
  ),

  navHome: e("الرئيسية", "Accueil", "Home"),
  navFeatures: e("المميزات", "Atouts", "Features"),
  navHelp: e("المساعدة", "Aide", "Help"),
  navStart: e("ابدأ", "Démarrer", "Start"),
  navAria: e("تنقّل الصفحة الرئيسية", "Navigation de l'accueil", "Home navigation"),

  helpTitle: e("كيفاش نبدا؟", "Comment commencer ?", "How do I start?"),
  helpIntro: e(
    "Maalam أستاذ كيهضر معاك بالدارجة. ثلاث خطوات وتبدا:",
    "Maalam est un prof qui te parle en darija. Trois étapes et c'est parti :",
    "Maalam is a tutor that talks to you in Darija. Three steps and you're in:",
  ),
  helpStep1Title: e("جيب مفتاح Gemini", "Obtiens une clé Gemini", "Get a Gemini key"),
  helpStep1Text: e(
    "دخل لـ Google AI Studio وصاوب مفتاح API جديد.",
    "Va sur Google AI Studio et crée une nouvelle clé API.",
    "Open Google AI Studio and create a new API key.",
  ),
  helpStep2Title: e("لصقو فالخانة", "Colle-la dans le champ", "Paste it in the field"),
  helpStep2Text: e(
    "الصق المفتاح فخانة «مفتاح API»، من بعد كليكي على زر البداية.",
    "Colle la clé dans le champ « clé API », puis appuie sur le bouton de démarrage.",
    "Paste the key in the “API key” field, then tap the start button.",
  ),
  helpStep3Title: e("هضر مع الأستاذ", "Parle avec le prof", "Talk to the tutor"),
  helpStep3Text: e(
    "تكلّم بالدارجة، والأستاذ كيجاوبك بالصوت وكيكتب ليك على السبورة. تقدر تصيفط صورة ولا PDF.",
    "Parle en darija : le prof te répond à voix haute et écrit au tableau. Tu peux envoyer une photo ou un PDF.",
    "Speak in Darija; the tutor answers by voice and writes on the blackboard. You can send a photo or a PDF.",
  ),
  helpTipBefore: e(
    "فالسبورة، كل الأدوات (الدردشة، الإعدادات، الكاميرا) كتلقاهم فالزر",
    "Sur le tableau, tous les outils (discussion, réglages, caméra) sont dans le bouton",
    "On the board, all the tools (chat, settings, camera) are in the",
  ),
  helpTipAfter: e(
    "اللي على اليسار، وسجل المحادثات فالزر اللي فوقو.",
    "à gauche ; l'historique des conversations est dans le bouton juste au-dessus.",
    "button on the left; your conversation history is in the button just above it.",
  ),
  helpOpenStudio: e("ٱفتح Google AI Studio", "Ouvrir Google AI Studio", "Open Google AI Studio"),

  histNew: e("محادثة جديدة", "Nouvelle conversation", "New conversation"),
  histEmptyA: e("ما كاين حتى محادثة محفوظة.", "Aucune conversation enregistrée.", "No saved conversations."),
  histEmptyB: e(
    "المحادثات كتحفظ هنا أوتوماتيكيا.",
    "Les conversations sont enregistrées ici automatiquement.",
    "Conversations are saved here automatically.",
  ),
  histDelete: e("مسح المحادثة", "Supprimer la conversation", "Delete conversation"),
  histMessages: e("{n} رسائل", "{n} messages", "{n} messages"),
  histFallback: e("محادثة", "Conversation", "Conversation"),
  histBack: e("رجع للسجل", "Retour à l'historique", "Back to history"),
  histBoard: e("السبورة المحفوظة", "Tableau enregistré", "Saved board"),
  histDeleteThis: e("مسح هاد المحادثة", "Supprimer cette conversation", "Delete this conversation"),
  histContinue: e("كمّل هاد المحادثة", "Continuer cette conversation", "Continue this conversation"),

  resuming: e("كنكمّلو المحادثة…", "Reprise de la conversation…", "Resuming the conversation…"),
  resumeFailed: e(
    "ما قدرناش نكمّلو المحادثة. عاود جرّب.",
    "Impossible de reprendre la conversation. Réessaie.",
    "Couldn't resume the conversation. Please try again.",
  ),
  camShoot: e("صوّر", "Prendre la photo", "Take photo"),
  camClose: e("سدّ الكاميرا", "Fermer la caméra", "Close camera"),
  camFail: e(
    "ما قدرناش نحلّو الكاميرا فهاد المتصفح. تقدر تستعمل تطبيق الكاميرا ديال التليفون.",
    "Impossible d'ouvrir la caméra dans ce navigateur. Tu peux utiliser l'appareil photo du téléphone.",
    "The camera can't open in this browser. You can use your phone's camera app instead.",
  ),
  camUseApp: e("استعمل تطبيق الكاميرا", "Utiliser l'appareil photo", "Use the camera app"),
  uploadBusy: e("كنقراو الملف…", "Lecture du fichier…", "Reading the file…"),
  uploadDone: e("وصل الملف ✓", "Fichier envoyé ✓", "File uploaded ✓"),
  rotateTitle: e("قلّب التليفون بالعرض", "Tourne ton téléphone", "Turn your phone sideways"),
  rotateText: e(
    "هاد التطبيق كيخدم غير بالعرض. دوّر التليفون باش تكمّل الدرس.",
    "Cette application fonctionne uniquement en mode paysage. Tourne ton téléphone pour continuer le cours.",
    "This app only works in landscape. Turn your phone sideways to continue the lesson.",
  ),

  loadStyles: e("كنجيبو الستايل…", "Chargement des styles…", "Loading styles…"),
  loadTailwind: e("كنوجدو التصميم…", "Préparation du design…", "Preparing the design…"),
  loadModules: e("كنحمّلو Maalam من GitHub…", "Chargement de Maalam depuis GitHub…", "Loading Maalam from GitHub…"),
  loadRender: e("تقريبا واجد…", "Presque prêt…", "Almost ready…"),
  loadTagline: e("معلّمك بالدارجة", "Ton prof en darija", "Your Darija tutor"),
  loadHint: e(
    "أول مرة كتاخد شوية ديال الوقت.",
    "Le premier chargement prend quelques secondes.",
    "The first load takes a few seconds.",
  ),
  errTitle: e("Maalam ما قدرش يتحمّل", "Maalam n'a pas pu se charger", "Maalam couldn't load"),
  errText: e(
    "كيتحمّل التطبيق مباشرة من GitHub، وقع شي مشكل. تأكّد من الاتصال بالإنترنت وعاود جرّب.",
    "L'application se charge en direct depuis GitHub et quelque chose s'est mal passé. Vérifie ta connexion et réessaie.",
    "The app loads live from GitHub and something went wrong. Check your connection and try again.",
  ),
  errRetry: e("عاود جرّب", "Réessayer", "Try again"),
  errGithub: e("شوف على GitHub", "Voir sur GitHub", "View on GitHub"),
  errStackblitz: e("افتح فـ StackBlitz", "Ouvrir dans StackBlitz", "Open in StackBlitz"),
  errVercel: e("نشر على Vercel", "Déployer sur Vercel", "Deploy to Vercel"),
} as const satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, vars?: Record<string, string | number>): string {
  let text: string = STRINGS[key][current];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}

/* ====================== remote app (Maalam) strings ====================== */

type Pair = { fr: string; en: string; ar?: string };
type RemoteEntry = [ar: string, pair: Pair];

const p = (ar: string, fr: string, en: string, arOverride?: string): RemoteEntry => [
  ar,
  arOverride === undefined ? { fr, en } : { fr, en, ar: arOverride },
];

const REMOTE: RemoteEntry[] = [
  /* ---- home screen ---- */
  p("معلّمك بالدارجة · صوت + سبورة", "Ton prof en darija · voix + tableau", "Your Darija tutor · voice + blackboard"),
  p("معلّم", "Prof", "Tutor"),
  p(
    "نفهمو الفكرة، نطبّقوها، ونرجعو ليها باش تبقى فالذاكرة.",
    "On comprend l'idée, on la pratique, puis on y revient pour qu'elle reste en mémoire.",
    "We understand the idea, practice it, then come back to it so it sticks.",
  ),
  p(
    "بالدارجة بالحروف العربية، المصطلحات العلمية بالفرنسية، والشرح بالصوت وعلى السبورة.",
    "En darija écrite en lettres arabes, avec les termes scientifiques en français, expliqué à voix haute et au tableau.",
    "In Darija written in Arabic letters, with scientific terms in French, explained by voice and on the blackboard.",
  ),
  p("يهضر معاك بالصوت وكيسمعك", "Te parle à voix haute et t'écoute", "Talks with you by voice and listens"),
  p(
    "سبورة كتكتب وكترسم وقت الشرح",
    "Un tableau qui écrit et dessine pendant l'explication",
    "A blackboard that writes and draws as it explains",
  ),
  p(
    "صوّر التمرين ولا لسق صورة / PDF",
    "Photographie l'exercice ou colle une image / un PDF",
    "Snap the exercise or paste an image / PDF",
  ),
  p(
    "أسئلة ذكية كتكشف الغلطات الشائعة",
    "Des questions intelligentes qui révèlent les erreurs courantes",
    "Smart questions that reveal common mistakes",
  ),
  p("بدا الدرس", "Commencer le cours", "Start the lesson"),
  p(
    "دخّل المفتاح ديالك وبدا دابا، بلا تسجيل.",
    "Saisis ta clé et commence maintenant, sans inscription.",
    "Enter your key and start now — no sign-up.",
  ),
  p("كنتّاصلو بـ maalam…", "Connexion à maalam…", "Connecting to maalam…"),
  p("بدا التعلّم", "Commencer à apprendre", "Start learning"),
  // The original page says the key is stored nowhere. It is now remembered on
  // this device (so the app can reopen ready to use), so the sentence is corrected
  // in every language, Arabic included.
  p(
    "المفتاح ديالك كيبقا فهاد الصفحة و ما كيتسجّل حتى بلاصة.",
    "Ta clé est enregistrée uniquement sur cet appareil et n'est envoyée qu'à Google.",
    "Your key is saved only on this device and is sent only to Google.",
    "المفتاح ديالك كيتحفظ غير فهاد التليفون، وما كيتصيفط لحتى جهة غير Google.",
  ),
  p("جيب API key", "Obtenir une clé API", "Get an API key"),
  p("خبّي المفتاح", "Masquer la clé", "Hide key"),
  p("ورّي المفتاح", "Afficher la clé", "Show key"),
  p("المعجم كيتحمّل من GitHub…", "Chargement du lexique depuis GitHub…", "Loading the lexicon from GitHub…"),
  p("المعجم: النسخة المدمجة.", "Lexique : version intégrée.", "Lexicon: built-in version."),
  p(
    "الجمل (≈49k) كيتحمّلو فالخلفية…",
    "Chargement des phrases (≈49k) en arrière-plan…",
    "Loading sentences (≈49k) in the background…",
  ),
  p(
    "الجمل: ما تحمّلوش، غانخدمو بالنسخة المدمجة.",
    "Phrases : non chargées, on utilise la version intégrée.",
    "Sentences: couldn't load, using the built-in version.",
  ),

  /* ---- composer / chat controls ---- */
  p("كتب سؤالك لـ Maalam…", "Écris ta question à Maalam…", "Ask Maalam a question…"),
  p("عاود الاتصال باش تكمّل…", "Reconnecte-toi pour continuer…", "Reconnect to continue…"),
  p("كتب سؤالك", "Écris ta question", "Type your question"),
  p("صيفط", "Envoyer", "Send"),
  p("كمّل الشرح", "Continuer l'explication", "Continue the lesson"),
  p("امسح السبورة وكمّل", "Effacer le tableau et continuer", "Erase the board and continue"),
  p(
    "تصوّر ولا رفع صورة أو PDF",
    "Prendre une photo ou importer une image ou un PDF",
    "Take a photo or upload an image or PDF",
  ),
  p(
    "Enter باش تصيفط، Shift + Enter لسطر جديد، «كمّل» باش يواصل الشرح من فين وقف. maalam يقدر يغلط، تأكّد من المعلومات المهمّة.",
    "Entrée pour envoyer, Maj + Entrée pour une nouvelle ligne, « Continuer » pour reprendre l'explication là où elle s'est arrêtée. maalam peut se tromper : vérifie les informations importantes.",
    "Enter to send, Shift + Enter for a new line, “Continue” to resume the explanation where it stopped. maalam can make mistakes — double-check important information.",
  ),
  p("ما فهمتش", "Je n'ai pas compris", "I don't get it"),
  p("مثال آخر", "Un autre exemple", "Another example"),
  p("لخّص", "Résume", "Summarize"),
  p("بغيت نجرّب...", "Je veux essayer…", "I want to try…"),
  p("عطيني تلميح", "Donne-moi un indice", "Give me a hint"),
  p("نجرب تمرين بوحدي", "Je tente un exercice seul", "I'll try an exercise on my own"),
  p("نراجع من الذاكرة", "Réviser de mémoire", "Review from memory"),
  p("نختم الدرس ونخطّط للمراجعة", "Terminer et planifier la révision", "Wrap up and plan the review"),
  p("تعلّم خطوة بخطوة", "Apprendre pas à pas", "Learn step by step"),
  p("جواب مباشر", "Réponse directe", "Direct answer"),
  p("شرح ليا الدرس كامل", "Explique-moi tout le cours", "Explain the whole lesson"),
  p("نحلّو التمارين معا", "Résolvons les exercices ensemble", "Solve the exercises together"),
  p("اختبرني", "Teste-moi", "Quiz me"),
  p("النقطة الجاية ⏭", "Point suivant ⏭", "Next point ⏭"),
  p("خطة الدرس", "Plan du cours", "Lesson plan"),
  p("اختار تمرين…", "Choisis un exercice…", "Pick an exercise…"),
  p("كنبداو جلسة جديدة…", "Démarrage d'une nouvelle session…", "Starting a new session…"),
  p("الجلسة تقطعات.", "La session s'est interrompue.", "The session was interrupted."),
  p("عاود الاتصال", "Se reconnecter", "Reconnect"),
  p("خبّي الرسالة", "Masquer le message", "Dismiss message"),

  /* ---- learning settings form ---- */
  p("كيفاش بغيتي نتعلّمو؟", "Comment veux-tu apprendre ?", "How do you want to learn?"),
  p("خطوة بخطوة", "Pas à pas", "Step by step"),
  p(
    "فكرة وحدة، مثال، وسؤال واحد. الأستاذ كيتسنى جوابك.",
    "Une idée, un exemple, une question. Le prof attend ta réponse.",
    "One idea, one example, one question. The tutor waits for your answer.",
  ),
  p(
    "الجواب مع شرح مختصر، بلا اختبار إجباري.",
    "La réponse avec une courte explication, sans test obligatoire.",
    "The answer with a short explanation, no mandatory quiz.",
  ),
  p("المستوى ديالي فهاد الموضوع", "Mon niveau sur ce sujet", "My level on this topic"),
  p("حدّد المستوى حسب الأجوبة ديالي", "Détermine mon niveau selon mes réponses", "Work out my level from my answers"),
  p("مبتدئ، نبداو من الأساسيات", "Débutant : on commence par les bases", "Beginner — start from the basics"),
  p("عندي الأساسيات، بغيت نطبّق", "J'ai les bases, je veux pratiquer", "I know the basics, I want to practice"),
  p("متقدّم، بغيت نتعمّق", "Avancé : je veux approfondir", "Advanced — I want to go deeper"),

  /* ---- header buttons (shown in the tools menu) ---- */
  p("شغّل الصوت", "Activer le son", "Unmute"),
  p("سكّت الصوت", "Couper le son", "Mute"),
  p("محادثة جديدة", "Nouvelle conversation", "New conversation"),
  p("بدّل المفتاح", "Changer la clé", "Change key"),
  p("حبس المراجع اللغوية ديال DODa", "Désactiver les références DODa", "Turn off DODa references"),
  p("شغّل المراجع اللغوية ديال DODa", "Activer les références DODa", "Turn on DODa references"),
];

type PatternFn = (match: RegExpExecArray, lang: "fr" | "en") => string;
/** Patterns are written against the normalized text (no diacritics, no tatweel). */
const PATTERNS: [RegExp, PatternFn][] = [
  [
    /^المعجم: (.+) مدخل بالحروف العربية \((.+) ملفات\)\.$/,
    (m, l) =>
      l === "fr"
        ? `Lexique : ${m[1]} entrées en lettres arabes (${m[2]} fichiers).`
        : `Lexicon: ${m[1]} entries in Arabic letters (${m[2]} files).`,
  ],
  [
    /^الجمل: (.+) جملة مراجعة جاهزة لل retrieval\.$/,
    (m, l) =>
      l === "fr"
        ? `Phrases : ${m[1]} phrases révisées prêtes pour la recherche.`
        : `Sentences: ${m[1]} reviewed sentences ready for retrieval.`,
  ],
];

/** Removes diacritics/tatweel and unifies alef forms so matching survives spelling variants. */
function norm(value: string): string {
  return value
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\s+/g, " ")
    .trim();
}

const EXACT = new Map<string, Pair>();
const SUBSTR: [string, Pair][] = [];
for (const [ar, pair] of REMOTE) {
  const key = norm(ar);
  EXACT.set(key, pair);
  if (key.length >= 14) SUBSTR.push([key, pair]);
}
SUBSTR.sort((a, b) => b[0].length - a[0].length);

/** Translates a string that comes from the remote app. Unknown text is returned unchanged. */
export function tr(text: string, target: Lang = current): string {
  if (!text) return text;
  const lead = /^\s*/.exec(text)?.[0] ?? "";
  const trail = /\s*$/.exec(text)?.[0] ?? "";
  const core = text.slice(lead.length, text.length - trail.length);
  if (!core) return text;
  const key = norm(core);

  const hit = EXACT.get(key);
  if (hit) {
    const value = target === "ar" ? hit.ar : hit[target];
    return value === undefined ? text : lead + value + trail;
  }

  if (target !== "ar") {
    for (const [pattern, build] of PATTERNS) {
      const match = pattern.exec(key);
      if (match) return lead + build(match, target) + trail;
    }
  }

  if (key.length >= 14) {
    let out = key;
    let changed = false;
    for (const [phrase, pair] of SUBSTR) {
      const value = target === "ar" ? pair.ar : pair[target];
      if (value === undefined || !out.includes(phrase)) continue;
      out = out.split(phrase).join(value);
      changed = true;
    }
    if (changed) return lead + out + trail;
  }
  return text;
}

/* ============================ DOM translator ============================ */

// Only the remote app's home screen and composer are rewritten. The header,
// the board and the chat transcript are never touched, because other code
// reads their labels and the transcript is the tutor's own content.
const ROOTS = ".setup-screen, .composer-area";
const ATTRS = ["placeholder", "aria-label", "title"] as const;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA"]);

type Rec = { orig: string; applied: string };
const textState = new WeakMap<Text, Rec>();
const attrState = new WeakMap<Element, Partial<Record<(typeof ATTRS)[number], Rec>>>();

function processText(node: Text): void {
  const now = node.nodeValue ?? "";
  let rec = textState.get(node);
  // Text the app wrote itself replaces what we remembered.
  if (!rec || rec.applied !== now) {
    rec = { orig: now, applied: now };
    textState.set(node, rec);
  }
  const next = tr(rec.orig);
  if (next !== now) node.nodeValue = next;
  rec.applied = next;
}

function processAttributes(element: Element): void {
  for (const name of ATTRS) {
    const now = element.getAttribute(name);
    if (now === null) continue;
    let states = attrState.get(element);
    if (!states) {
      states = {};
      attrState.set(element, states);
    }
    let rec = states[name];
    if (!rec || rec.applied !== now) {
      rec = { orig: now, applied: now };
      states[name] = rec;
    }
    const next = tr(rec.orig);
    if (next !== now) element.setAttribute(name, next);
    rec.applied = next;
  }
}

function translateAll(): void {
  document.querySelectorAll<HTMLElement>(ROOTS).forEach((root) => {
    if (root.classList.contains("setup-screen") && root.getAttribute("dir") !== uiDir()) {
      root.setAttribute("dir", uiDir());
    }
    processAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.nodeType === Node.ELEMENT_NODE && SKIP_TAGS.has((node as Element).tagName)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) processText(node as Text);
      else processAttributes(node as Element);
    }
  });
}

function installRemoteTranslator(): void {
  // If Arabic is active, the app's native text is already in Arabic — no translation work needed.
  if (current === "ar") return;

  let queued = false;
  let lastTranslateTime = 0;
  const observer = new MutationObserver((records) => {
    if (queued || current === "ar") return;
    let relevant = false;
    for (const record of records) {
      const target = record.target.nodeType === Node.ELEMENT_NODE ? (record.target as Element) : record.target.parentElement;
      if (target?.closest(ROOTS)) {
        relevant = true;
        break;
      }
      if (record.type === "childList") {
        for (const added of Array.from(record.addedNodes)) {
          if (added.nodeType !== Node.ELEMENT_NODE) continue;
          const element = added as Element;
          if (element.matches(ROOTS) || element.querySelector(ROOTS)) {
            relevant = true;
            break;
          }
        }
        if (relevant) break;
      }
    }
    if (!relevant) return;
    queued = true;
    const now = performance.now();
    const delay = Math.max(0, 160 - (now - lastTranslateTime));
    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        queued = false;
        lastTranslateTime = performance.now();
        translateAll();
      });
    }, delay);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  });
  translateAll();
}

/* ============================ applying a language ============================ */

const I18N_CSS = `
/* Left-to-right languages: flip only this project's own components. */
html[data-ui-dir="ltr"] .maalam-sheet-backdrop,
html[data-ui-dir="ltr"] .maalam-ask,
html[data-ui-dir="ltr"] .maalam-home-nav,
html[data-ui-dir="ltr"] .maalam-toast {
  direction: ltr;
}

html[data-ui-dir="ltr"] .maalam-hist-back svg {
  transform: none;
}

.maalam-lang-hint {
  margin: 0 0 0.85rem;
  color: #93a09b;
  font-size: 0.8rem;
  line-height: 1.8;
}
`;

function addI18nStyles(): void {
  if (document.getElementById("maalam-i18n-styles")) return;
  const style = document.createElement("style");
  style.id = "maalam-i18n-styles";
  style.textContent = withInsetFallback(I18N_CSS);
  document.head.appendChild(style);
}

/** Pseudo-element text (BETA chip / note, section labels) comes from CSS variables. */
function applyLang(): void {
  const root = document.documentElement;
  root.dataset.uiLang = current;
  root.dataset.uiDir = uiDir();
  const setText = (name: string, value: string) => root.style.setProperty(name, JSON.stringify(value));
  setText("--maalam-beta-chip", t("betaChip"));
  setText("--maalam-beta-note", t("betaNote"));
  setText("--maalam-t-laststep", t("lastStep"));
  document.title = t("docTitle");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t("docDesc"));
}

export function setLang(next: Lang): void {
  if (next === current) return;
  current = next;
  storageSet(LANG_KEY, next);
  applyLang();
  translateAll();
  if (current !== "ar") {
    installRemoteTranslator();
  }
  Array.from(listeners).forEach((listener) => listener(next));
}

let initialized = false;

export function initI18n(): void {
  if (initialized) return;
  initialized = true;
  addI18nStyles();
  applyLang();
  installRemoteTranslator();
}

/* ============================ language sheet ============================ */

const ICO_CLOSE = '<path d="M18 6 6 18M6 6l12 12"/>';
const ICO_CHECK = '<path d="M20 6 9 17l-5-5"/>';

function svg(paths: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

/** Bottom sheet to pick the interface language. It re-renders itself when the language changes. */
export function openLanguageSheet(onClosed: () => void): () => void {
  const backdrop = document.createElement("div");
  backdrop.className = "maalam-sheet-backdrop";
  const sheet = document.createElement("section");
  sheet.className = "maalam-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "maalam-lang-title");
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);

  let closed = false;
  let off: (() => void) | null = null;

  const close = () => {
    if (closed) return;
    closed = true;
    untrackOverlay(close);
    off?.();
    document.removeEventListener("keydown", onKey);
    backdrop.classList.remove("is-in");
    window.setTimeout(() => backdrop.remove(), 260);
    onClosed();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };
  trackOverlay("language", close);

  const render = () => {
    sheet.dir = uiDir();
    sheet.innerHTML = `
      <header class="maalam-sheet__head">
        <h2 class="maalam-sheet__title" id="maalam-lang-title">${t("language")}</h2>
        <button class="maalam-sheet__close" type="button" aria-label="${t("close")}">${svg(ICO_CLOSE)}</button>
      </header>
      <div class="maalam-sheet__body" style="padding-bottom: calc(1.4rem + env(safe-area-inset-bottom))">
        <p class="maalam-lang-hint">${t("langHint")}</p>
        <div class="maalam-sheet__options" role="radiogroup" aria-label="${t("language")}">
          ${LANGS.map(
            (lang) => `
            <button type="button" class="maalam-opt" role="radio" aria-checked="${lang.id === current}" data-lang="${lang.id}">
              <span class="maalam-opt__box">${svg(ICO_CHECK)}</span>
              <span class="maalam-opt__text"><strong dir="auto">${lang.name}</strong></span>
            </button>`,
          ).join("")}
        </div>
      </div>`;
    sheet.querySelector(".maalam-sheet__close")?.addEventListener("click", close);
    sheet.querySelectorAll<HTMLButtonElement>("button[data-lang]").forEach((button) => {
      button.addEventListener("click", () => setLang(button.dataset.lang as Lang));
    });
  };

  render();
  off = onLangChange(render);
  document.addEventListener("keydown", onKey);
  backdrop.addEventListener("pointerdown", (event) => {
    if (event.target === backdrop) close();
  });
  window.requestAnimationFrame(() => backdrop.classList.add("is-in"));

  return close;
}
