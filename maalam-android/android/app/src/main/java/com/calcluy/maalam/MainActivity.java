package com.calcluy.maalam;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // App-specific plugins must be registered before the bridge loads.
        // (The npm plugins are registered automatically by the generated
        // capacitor.build.gradle; only in-app plugins need this line.)
        registerPlugin(MaalamNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
