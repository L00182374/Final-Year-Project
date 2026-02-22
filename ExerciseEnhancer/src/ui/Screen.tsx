// src/ui/Screen.tsx
import React from "react";
import { View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  edges?: ("top" | "bottom" | "left" | "right")[];
};

/**
 * Screen wrapper:
 * - applies safe area top + bottom
 * - sets default background
 * - provides consistent padding
 */
export default function Screen(props: Props) {
  const { children, style, contentStyle, edges } = props;

  return (
    <SafeAreaView
      style={[
        {
          flex: 1,
          backgroundColor: "#0b0b0f",
        },
        style,
      ]}
      edges={edges ?? ["top", "bottom"]}
    >
      <View
        style={[
          {
            flex: 1,
            paddingHorizontal: 16,
            paddingVertical: 12,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
