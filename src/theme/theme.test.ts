import { theme, colors, typography, spacing, radii, shadows } from './index';

describe('theme design tokens', () => {
  it('exports valid color tokens with luxury grooming palette', () => {
    expect(colors.brand.primary).toBe('#D4AF37');
    expect(colors.canvas.background).toBe('#0D1117');
    expect(colors.canvas.surface).toBe('#161B22');
    expect(colors.text.primary).toBe('#F0F6FC');
    expect(colors.status.success).toBe('#2EA043');
    expect(colors.appointment.confirmed).toBe('#58A6FF');
  });

  it('exports consistent typography scale', () => {
    expect(typography.sizes.h1).toBeGreaterThan(typography.sizes.h2);
    expect(typography.sizes.h2).toBeGreaterThan(typography.sizes.body);
    expect(typography.sizes.body).toBeGreaterThan(typography.sizes.caption);
    expect(typography.weights.bold).toBe('700');
  });

  it('exports standard 4pt/8pt spacing scale', () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.sm).toBe(8);
    expect(spacing.base).toBe(16);
    expect(spacing.xl).toBe(24);
    expect(radii.base).toBe(12);
    expect(shadows.card).toBeDefined();
  });

  it('assembles complete theme object', () => {
    expect(theme.colors).toEqual(colors);
    expect(theme.typography).toEqual(typography);
    expect(theme.spacing).toEqual(spacing);
  });
});
