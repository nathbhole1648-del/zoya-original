[app]

# (str) Title of your application
title = Zoya AI Voice Assistant

# (str) Package name
package.name = zoya

# (str) Package domain (needed for android/ios packaging)
package.domain = org.zoya.assistant

# (str) Source code where the main.py lives
source.dir = .

# (list) Source files to include (let empty to include all the files)
source.include_exts = py,png,jpg,kv,atlas,json,webmanifest,js,css,html,ts,tsx

# (list) List of inclusions using pattern matching
source.include_patterns = assets/*,public/*

# (str) Application versioning (method 1)
version = 1.0.0

# (list) Application requirements
# comma separated e.g. requirements = sqlite3,kivy
requirements = python3,kivy,requests

# (str) Supported orientation (one of landscape, sensorLandscape, portrait or all)
orientation = portrait

# (bool) Indicate if the application should be fullscreen or not
fullscreen = 1

# (list) Permissions
android.permissions = INTERNET,\
    RECORD_AUDIO,\
    CAMERA,\
    READ_CONTACTS,\
    WRITE_CONTACTS,\
    READ_CALENDAR,\
    WRITE_CALENDAR,\
    POST_NOTIFICATIONS,\
    ACCESS_FINE_LOCATION,\
    ACCESS_COARSE_LOCATION,\
    BLUETOOTH,\
    BLUETOOTH_CONNECT,\
    READ_MEDIA_IMAGES,\
    READ_MEDIA_VIDEO,\
    READ_MEDIA_AUDIO,\
    FOREGROUND_SERVICE,\
    WAKE_LOCK,\
    VIBRATE

# (int) Target Android API, should be as high as possible.
android.api = 34

# (int) Minimum API your APK / AAB will support.
android.minapi = 26

# (str) Android NDK version to use
android.ndk = 25b

# (bool) If True, then skip trying to update the Android sdk
# This can be useful to avoid excess Internet downloads or save time
# when an update is due and you just want to test/build your package
android.skip_update = False

# (bool) If True, then automatically accept SDK license
# agreements. This is intended for automation only. If set to False,
# the default, you will be shown the license when first running
# buildozer.
android.accept_sdk_license = True

# (str) The Android arch to build for, choices: armeabi-v7a, arm64-v8a, x86, x86_64
android.archs = arm64-v8a, armeabi-v7a

# (str) Icon of the application
icon.filename = %(source.dir)s/public/icon-512.png

# (str) Presplash of the application
presplash.filename = %(source.dir)s/public/icon-512.png

[buildozer]

# (int) Log level (0 = error only, 1 = info, 2 = debug (with command output))
log_level = 2

# (int) Display warning if buildozer is run as root (0 = False, 1 = True)
warn_on_root = 1
