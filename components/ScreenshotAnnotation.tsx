import React, { useState, useCallback } from "react";
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  Pressable,
  Dimensions,
} from "react-native";

export type AnnotationDot = {
  id: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
};

type ScreenshotAnnotationProps = {
  screenshotUri: string;
  dots: AnnotationDot[];
  onDotsChange: (dots: AnnotationDot[]) => void;
  onRemove: () => void;
};

export function ScreenshotAnnotation({
  screenshotUri,
  dots,
  onDotsChange,
  onRemove,
}: ScreenshotAnnotationProps) {
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });

  const handlePress = useCallback(
    (event: { nativeEvent: { locationX: number; locationY: number } }) => {
      if (imageLayout.width === 0 || imageLayout.height === 0) return;

      const { locationX, locationY } = event.nativeEvent;

      // Convert to percentage coordinates
      const xPercent = (locationX / imageLayout.width) * 100;
      const yPercent = (locationY / imageLayout.height) * 100;

      const newDot: AnnotationDot = {
        id: `dot-${Date.now()}`,
        x: xPercent,
        y: yPercent,
      };

      onDotsChange([...dots, newDot]);
    },
    [imageLayout, dots, onDotsChange]
  );

  const handleRemoveDot = useCallback(
    (dotId: string) => {
      onDotsChange(dots.filter((d) => d.id !== dotId));
    },
    [dots, onDotsChange]
  );

  const handleImageLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number; height: number } } }) => {
      setImageLayout({
        width: event.nativeEvent.layout.width,
        height: event.nativeEvent.layout.height,
      });
    },
    []
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Tap to add highlight</Text>
        <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
          <Text style={styles.removeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Pressable onPress={handlePress} style={styles.imageContainer}>
        <Image
          source={{ uri: screenshotUri }}
          style={styles.screenshot}
          resizeMode="contain"
          onLayout={handleImageLayout}
        />

        {/* Render dots */}
        {dots.map((dot) => (
          <TouchableOpacity
            key={dot.id}
            style={[
              styles.dot,
              {
                left: `${dot.x}%`,
                top: `${dot.y}%`,
              },
            ]}
            onPress={() => handleRemoveDot(dot.id)}
            activeOpacity={0.8}
          >
            <View style={styles.dotInner} />
          </TouchableOpacity>
        ))}
      </Pressable>

      {dots.length > 0 && (
        <Text style={styles.hint}>Tap a dot to remove it</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#eee",
  },
  headerText: {
    fontSize: 12,
    color: "#666",
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  removeButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  imageContainer: {
    position: "relative",
    maxHeight: 200,
  },
  screenshot: {
    width: "100%",
    height: 180,
  },
  dot: {
    position: "absolute",
    width: 32,
    height: 32,
    marginLeft: -16,
    marginTop: -16,
    justifyContent: "center",
    alignItems: "center",
  },
  dotInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#EF4444",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  hint: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    paddingVertical: 4,
  },
});
