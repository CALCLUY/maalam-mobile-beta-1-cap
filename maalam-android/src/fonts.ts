/**
 * Bundled fonts — the APK contains no Google Fonts request.
 *
 * The web app asked fonts.googleapis.com for:
 *   Caveat 400;500;600;700, IBM Plex Sans Arabic 400;500;600;700,
 *   Kalam 400;700, Patrick Hand, Playpen Sans Arabic 400..800,
 *   Playpen Sans 400..800, Sora 500;600;700
 *
 * Here the same faces/weights come from @fontsource. Only the subsets the app
 * can actually show are bundled (unicode-range still applies at runtime, so the
 * WebView only decodes what the current language needs):
 *
 *   arabic  -> Arabic UI + Darija board text
 *   latin   -> French / English UI, Latin chalk handwriting (covers U+0000-00FF,
 *              i.e. every French accent)
 *   math    -> chalk maths symbols in the handwriting faces
 *   greek   -> greek letters on the board (Playpen Sans only)
 *
 * KaTeX's own 60 font files are bundled separately by the
 * `katex/dist/katex.min.css` import in src/darija/board/Board.tsx.
 */

/* Body / UI ---------------------------------------------------------------- */
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-500.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-600.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-700.css";
import "@fontsource/ibm-plex-sans-arabic/latin-400.css";
import "@fontsource/ibm-plex-sans-arabic/latin-500.css";
import "@fontsource/ibm-plex-sans-arabic/latin-600.css";
import "@fontsource/ibm-plex-sans-arabic/latin-700.css";

/* Headings / brand wordmark ------------------------------------------------ */
import "@fontsource/sora/latin-500.css";
import "@fontsource/sora/latin-600.css";
import "@fontsource/sora/latin-700.css";

/* Chalk handwriting, Arabic ------------------------------------------------ */
import "@fontsource/playpen-sans-arabic/arabic-400.css";
import "@fontsource/playpen-sans-arabic/arabic-500.css";
import "@fontsource/playpen-sans-arabic/arabic-600.css";
import "@fontsource/playpen-sans-arabic/arabic-700.css";
import "@fontsource/playpen-sans-arabic/arabic-800.css";
import "@fontsource/playpen-sans-arabic/latin-400.css";
import "@fontsource/playpen-sans-arabic/latin-500.css";
import "@fontsource/playpen-sans-arabic/latin-600.css";
import "@fontsource/playpen-sans-arabic/latin-700.css";
import "@fontsource/playpen-sans-arabic/latin-800.css";
import "@fontsource/playpen-sans-arabic/math-400.css";
import "@fontsource/playpen-sans-arabic/math-500.css";
import "@fontsource/playpen-sans-arabic/math-600.css";
import "@fontsource/playpen-sans-arabic/math-700.css";
import "@fontsource/playpen-sans-arabic/math-800.css";

/* Chalk handwriting, Latin ------------------------------------------------- */
import "@fontsource/playpen-sans/latin-400.css";
import "@fontsource/playpen-sans/latin-500.css";
import "@fontsource/playpen-sans/latin-600.css";
import "@fontsource/playpen-sans/latin-700.css";
import "@fontsource/playpen-sans/latin-800.css";
import "@fontsource/playpen-sans/math-400.css";
import "@fontsource/playpen-sans/math-500.css";
import "@fontsource/playpen-sans/math-600.css";
import "@fontsource/playpen-sans/math-700.css";
import "@fontsource/playpen-sans/math-800.css";
import "@fontsource/playpen-sans/greek-400.css";
import "@fontsource/playpen-sans/greek-500.css";
import "@fontsource/playpen-sans/greek-600.css";
import "@fontsource/playpen-sans/greek-700.css";
import "@fontsource/playpen-sans/greek-800.css";

/* Cursive accents ----------------------------------------------------------- */
import "@fontsource/caveat/latin-400.css";
import "@fontsource/caveat/latin-500.css";
import "@fontsource/caveat/latin-600.css";
import "@fontsource/caveat/latin-700.css";
import "@fontsource/kalam/latin-400.css";
import "@fontsource/kalam/latin-700.css";
import "@fontsource/patrick-hand/latin-400.css";
