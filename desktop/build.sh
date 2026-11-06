#!/bin/zsh
# Builds "Floating Office.app" into ~/Applications. Needs Xcode Command Line Tools (swiftc).
set -e
here="${0:A:h}"
app="$HOME/Applications/Floating Office.app"
rm -rf "$app"
mkdir -p "$app/Contents/MacOS"
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Floating Office</string>
  <key>CFBundleDisplayName</key><string>Floating Office</string>
  <key>CFBundleIdentifier</key><string>local.myoffice.floating</string>
  <key>CFBundleExecutable</key><string>FloatingOffice</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>LSUIElement</key><true/>
  <key>NSAppTransportSecurity</key>
  <dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict>
</plist>
PLIST
swiftc -O -o "$app/Contents/MacOS/FloatingOffice" "$here/FloatingOffice.swift" -framework Cocoa -framework WebKit
codesign --force -s - "$app" >/dev/null 2>&1 || true
echo "Built: $app"
