package com.calcluy.maalam;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Two tiny native helpers that would otherwise need an npm dependency:
 *
 *  - openAppSettings(): jumps to this app's system settings page, used by the
 *    "microphone denied" message so the user can grant the permission.
 *  - requestMicrophone(): pre-flight RECORD_AUDIO so a permanently-denied
 *    state can be detected before the lesson tries to capture audio.
 *
 * The actual mic capture still goes through the WebView's getUserMedia and
 * Capacitor's BridgeWebChromeClient; this plugin only adds the UX around it.
 */
@CapacitorPlugin(
    name = "MaalamNative",
    permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone") }
)
public class MaalamNativePlugin extends Plugin {

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Unable to open app settings", e);
        }
    }

    @PluginMethod
    public void requestMicrophone(PluginCall call) {
        if (hasPermission(Manifest.permission.RECORD_AUDIO)) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestAllPermissions(call, "microphoneResult");
    }

    @PermissionCallback("microphone")
    private void microphoneResult(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasPermission(Manifest.permission.RECORD_AUDIO));
        call.resolve(ret);
    }
}
