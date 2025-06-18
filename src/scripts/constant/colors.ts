interface ColorHex {
  hex: string;
  hexNum: number;
}

export const colors = {
  black: { hex: "#000000", hexNum: 0x000000 },
  white: { hex: "#FFFFFF", hexNum: 0xffffff },
  red: { hex: "#FF0000", hexNum: 0xff0000 },
  green: { hex: "#008000", hexNum: 0x008000 },
  blue: { hex: "#0000FF", hexNum: 0x0000ff },
  yellow: { hex: "#FFFF00", hexNum: 0xffff00 },
  cyan: { hex: "#00FFFF", hexNum: 0x00ffff },
  magenta: { hex: "#FF00FF", hexNum: 0xff00ff },
  orange: { hex: "#FFA500", hexNum: 0xffa500 },
  purple: { hex: "#800080", hexNum: 0x800080 },
  pink: { hex: "#FFC0CB", hexNum: 0xffc0cb },
  brown: { hex: "#A52A2A", hexNum: 0xa52a2a },
  gray: { hex: "#808080", hexNum: 0x808080 },
  lightGray: { hex: "#D3D3D3", hexNum: 0xd3d3d3 },
  darkGray: { hex: "#A9A9A9", hexNum: 0xa9a9a9 },
  lime: { hex: "#00FF00", hexNum: 0x00ff00 },
  navy: { hex: "#000080", hexNum: 0x000080 },
  teal: { hex: "#008080", hexNum: 0x008080 },
  olive: { hex: "#808000", hexNum: 0x808000 },
  maroon: { hex: "#800000", hexNum: 0x800000 },
  gold: { hex: "#FFD700", hexNum: 0xffd700 },
  salmon: { hex: "#FA8072", hexNum: 0xfa8072 },
  turquoise: { hex: "#40E0D0", hexNum: 0x40e0d0 },
  violet: { hex: "#EE82EE", hexNum: 0xee82ee },
  indigo: { hex: "#4B0082", hexNum: 0x4b0082 },
  coral: { hex: "#FF7F50", hexNum: 0xff7f50 },
  chocolate: { hex: "#D2691E", hexNum: 0xd2691e },
  crimson: { hex: "#DC143C", hexNum: 0xdc143c },
  darkBlue: { hex: "#00008B", hexNum: 0x00008b },
  forestGreen: { hex: "#228B22", hexNum: 0x228b22 },
  lightPink: { hex: "#FFB6C1", hexNum: 0xffb6c1 },
  midnightBlue: { hex: "#191970", hexNum: 0x191970 },
  plum: { hex: "#DDA0DD", hexNum: 0xdda0dd },
  sienna: { hex: "#A0522D", hexNum: 0xa0522d },
  slateGray: { hex: "#708090", hexNum: 0x708090 },
  springGreen: { hex: "#00FF7F", hexNum: 0x00ff7f },
} as const;

export type ColorName = keyof typeof colors;

export type Colors = {
  [K in ColorName]: ColorHex;
};
