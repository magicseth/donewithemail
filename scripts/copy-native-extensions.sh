#!/bin/bash
# Copy NotificationServiceExtension files to ios folder after prebuild

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

SOURCE_DIR="$PROJECT_DIR/native/NotificationServiceExtension"
DEST_DIR="$PROJECT_DIR/ios/NotificationServiceExtension"

if [ -d "$PROJECT_DIR/ios" ]; then
  echo "Copying NotificationServiceExtension files..."
  mkdir -p "$DEST_DIR"
  cp "$SOURCE_DIR/NotificationService.swift" "$DEST_DIR/"
  cp "$SOURCE_DIR/Info.plist" "$DEST_DIR/"
  echo "Done!"
else
  echo "iOS folder not found. Run 'npx expo prebuild' first."
fi
