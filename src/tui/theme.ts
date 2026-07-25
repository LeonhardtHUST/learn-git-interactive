/**
 * OpenCode 默认暗色主题配色（取自 internal/tui/theme/opencode.go）。
 *
 * 用于统一 TUI 各组件的色调，避免各组件硬编码散落的十六进制值。
 */
export const OpenCodeTheme = {
  background: "#212121",
  backgroundPanel: "#252525",
  backgroundDarker: "#121212",
  selection: "#303030",

  text: "#e0e0e0",
  textMuted: "#6a6a6a",
  textEmphasized: "#e5c07b",

  primary: "#fab283", // 暖橙/金，主强调色
  secondary: "#5c9cf5", // 蓝
  accent: "#9d7cd8", // 紫

  success: "#7fd88f",
  error: "#e06c75",
  warning: "#f5a742",
  info: "#56b6c2",

  border: "#4b4c5c",
  borderFocused: "#fab283",
} as const;
