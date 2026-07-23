---
name: Obsidian Gold
colors:
  surface: '#121414'
  surface-dim: '#121414'
  surface-bright: '#38393a'
  surface-container-lowest: '#0d0e0f'
  surface-container-low: '#1a1c1c'
  surface-container: '#1e2020'
  surface-container-high: '#292a2a'
  surface-container-highest: '#343535'
  on-surface: '#e3e2e2'
  on-surface-variant: '#d3c5ac'
  inverse-surface: '#e3e2e2'
  inverse-on-surface: '#2f3131'
  outline: '#9b8f79'
  outline-variant: '#4f4633'
  surface-tint: '#f7be1d'
  primary: '#ffd165'
  on-primary: '#3f2e00'
  primary-container: '#eab308'
  on-primary-container: '#604700'
  inverse-primary: '#785a00'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b5b4'
  tertiary: '#d9d7d6'
  on-tertiary: '#303030'
  tertiary-container: '#bdbbbb'
  on-tertiary-container: '#4b4b4b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdf9a'
  primary-fixed-dim: '#f7be1d'
  on-primary-fixed: '#251a00'
  on-primary-fixed-variant: '#5a4300'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#e4e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#474746'
  background: '#121414'
  on-background: '#e3e2e2'
  surface-variant: '#343535'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  container-max: 1280px
---

## Brand & Style
This design system embodies the exclusivity of high-net-worth wealth management. The brand personality is authoritative, precise, and uncompromisingly premium. It targets an executive audience that values discretion, speed, and clarity over decorative flair.

The design style is **Modern Minimalist with a focus on Tonal Depth**. By utilizing a deep obsidian foundation paired with luminous gold accents, the UI evokes a sense of "digital craftsmanship." Every element is intentionally placed to reduce cognitive load, using high contrast to guide the eye toward critical financial data and calls to action. The aesthetic is sharp and architectural, avoiding unnecessary ornamentation in favor of structural integrity.

## Colors
The palette is rooted in a pure Obsidian black (#0a0a0a) to ensure maximum depth and contrast. The primary Gold (#eab308) is used surgically—reserved for high-priority actions, active states, and critical branding moments—to maintain its perceived value.

- **Primary (Gold):** Used for primary buttons, active navigation markers, and focus states.
- **Surface Tiers:** Secondary (#1a1a1a) and Tertiary (#262626) are used to define containers and interactive cards against the deep background.
- **Semantic Muting:** Success and Error colors are desaturated to integrate into the dark theme without "vibrating" against the gold accents, maintaining a calm, executive atmosphere.
- **Typography:** Pure white (#ffffff) is reserved for headers; secondary information uses Neutral (#a3a3a3) to establish hierarchy.

## Typography
The system utilizes Inter exclusively to achieve a systematic, utilitarian elegance. The hierarchy relies heavily on weight and letter spacing rather than font variety.

- **Scale:** Large display sizes use tight tracking (-0.02em) to feel cohesive and impactful.
- **Labels:** Small labels use uppercase styling with increased letter spacing (0.05em) to mimic the look of premium watch faces and luxury automotive interfaces.
- **Clarity:** For financial figures, tabular lining figures should be enabled to ensure numbers align perfectly in lists and tables.

## Layout & Spacing
The layout follows a strict 12-column fixed grid on desktop, shifting to a fluid single-column layout on mobile. Spacing is generous to prevent the dark interface from feeling cramped.

- **Rhythm:** An 8px base grid is used for component internal spacing, while a 4px "micro-grid" is used for fine-tuning alignments between icons and text.
- **Negative Space:** Use "aggressive" whitespace around key financial summaries to project confidence. Content should never feel crowded against the edges of the screen; maintain a minimum 48px margin on high-resolution displays.

## Elevation & Depth
In this dark, high-contrast environment, traditional shadows are replaced by **Tonal Layering** and **Subtle Outlines**.

- **Surface Levels:** Elevation is communicated by lightening the background color. Level 0 is #0a0a0a; Level 1 (Cards/Modals) is #1a1a1a.
- **Ghost Borders:** Elements are defined by 1px solid borders in #262626. This creates a "razor-sharp" architectural feel.
- **Golden Accents:** Use a 1px top-border in the primary gold color to indicate "active" or "featured" cards.
- **No Blurs:** Avoid glassmorphism or soft shadows. The UI should feel solid, opaque, and structural.

## Shapes
This design system uses **Rounded (Option 2)** geometry to soften the high-contrast "Obsidian" aesthetic just enough to feel modern without losing its executive edge.

- **Base Radius:** 0.5rem (8px) for standard buttons and input fields.
- **Large Radius:** 1rem (16px) for main content containers and dashboards.
- **Consistency:** Maintain strict corner radius synchronicity—if a container has a 16px radius, the nested elements should use 8px to create a balanced "nested" appearance.

## Components
- **Buttons:** Primary buttons are solid Gold (#eab308) with black text. Secondary buttons use a #1a1a1a background with a 1px gold border and gold text.
- **Input Fields:** Use a dark fill (#1a1a1a) with a 1px border (#262626). On focus, the border transitions to Gold. Labels should be small, uppercase, and placed above the field.
- **Cards:** Cards should have no shadow. Use a 1px border (#262626) to separate them from the background. For premium "Elite" features, use a subtle gold linear gradient (top-to-bottom, low opacity) as a border.
- **Chips:** Small, rectangular with 4px radius. Use neutral backgrounds (#262626) with white text for status, and muted semantic colors for success/danger.
- **Data Tables:** Remove all vertical lines. Use thin 1px horizontal dividers in #1a1a1a. Header rows should use the `label-md` typographic style for a professional, spreadsheet-refined look.
- **Progress Indicators:** Use thin, 2px gold lines. Avoid thick or bubbly loading states.