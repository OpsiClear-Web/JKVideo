import { useSettingsStore } from '../store/settingsStore';

export type ThemeColors = {
  bg: string;           // 页面/列表背景
  card: string;         // 卡片/section 背景
  text: string;         // 主文字
  textSub: string;      // 次要文字
  border: string;       // 分割线
  inputBg: string;      // 输入框背景
  sheetBg: string;      // 底部弹出面板背景
  modalBg: string;      // 弹窗/面板背景
  modalText: string;    // 弹窗主文字
  modalTextSub: string; // 弹窗次要文字
  modalBorder: string;  // 弹窗分割线
  placeholder: string;  // 占位背景（图片加载中）
  iconDefault: string;  // 默认图标色
  danger: string;       // 危险操作色
};

const light: ThemeColors = {
  bg: '#f4f4f4',
  card: '#fff',
  text: '#212121',
  textSub: '#999',
  border: '#eee',
  inputBg: '#f0f0f0',
  sheetBg: '#fff',
  modalBg: '#fff',
  modalText: '#212121',
  modalTextSub: '#555',
  modalBorder: '#eee',
  placeholder: '#ddd',
  iconDefault: '#999',
  danger: '#ff4757',
};

// Dark palette aligned to the gsav-hosting web app (diveo design parity):
// deep-black bg, near-black cards, silver-ish text, thin neutral borders.
const dark: ThemeColors = {
  bg: '#0b0b0b',
  card: '#171717',
  text: '#ededed',
  textSub: '#a2a2a2',
  border: '#2f2f2f',
  inputBg: '#242424',
  sheetBg: '#171717',
  modalBg: '#171717',
  modalText: '#ededed',
  modalTextSub: '#a2a2a2',
  modalBorder: '#2f2f2f',
  placeholder: '#222222',
  iconDefault: '#a2a2a2',
  danger: '#ff6b81',
};

export function useTheme(): ThemeColors {
  const darkMode = useSettingsStore(s => s.darkMode);
  return darkMode ? dark : light;
}
