# ---------------------------------------------------------------------------
# Maalam Android — R8 / ProGuard rules
#
# The app is a WebView shell: all interesting code runs as JavaScript inside
# assets/public. What R8 must NOT touch is the bridge between the two worlds:
#
#   * Capacitor core (bridge, plugins, JS export reflection)
#   * every plugin class, discovered by reflection from capacitor.plugins.json
#   * our own MaalamNativePlugin
#
# Without these keeps, R8 happily strips @PluginMethod handlers and the app
# boots to "plugin not implemented" errors on a minified release build.
# ---------------------------------------------------------------------------

# Keep stack-trace line numbers so crash reports from the field are readable.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod

# --- Capacitor core -------------------------------------------------------
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @interface com.getcapacitor.annotation.** { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public <methods>;
}
# The bridge talks to JS through these interfaces.
-keepclassmembers class com.getcapacitor.bridge.** { *; }

# --- Plugins (npm + in-app) ------------------------------------------------
-keep class com.capacitorjs.plugins.** { *; }
-keep class com.getcapacitor.plugins.** { *; }
-keep class com.capacitorjs.plugins.app.** { *; }
-keep class com.aparajita.capacitor.securestorage.** { *; }
-keep class com.calcluy.maalam.MaalamNativePlugin { *; }

# Plugin discovery file is read as JSON at runtime; the classes named in it
# must survive with their exact names.
-keep class * extends com.getcapacitor.Plugin

# --- AndroidX / support ----------------------------------------------------
-keep class androidx.core.splashscreen.** { *; }
-dontwarn androidx.**
-dontwarn kotlin.**
-dontwarn kotlinx.**

# --- Apache / misc transitive warnings -------------------------------------
-dontwarn org.apache.**
-dontwarn org.json.**
-dontwarn java.awt.**
