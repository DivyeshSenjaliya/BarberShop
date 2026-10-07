export const Platform = {
  OS: 'ios' as const,
  select: <T>(obj: { ios?: T; android?: T; default?: T }): T => obj.ios ?? obj.default as T,
};

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
};

export const Dimensions = {
  get: (_dim: string) => ({ width: 375, height: 812 }),
};
