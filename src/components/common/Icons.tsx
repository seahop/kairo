// Global icon components using text characters to avoid WebKitGTK SVG rendering bugs

export const CloseIcon = ({ size = 16 }: { size?: number }) => (
  <span style={{ fontSize: `${size}px`, lineHeight: 1 }}>✕</span>
);

export const MinimizeIcon = ({ size = 18 }: { size?: number }) => (
  <span style={{ fontSize: `${size}px`, lineHeight: 1 }}>−</span>
);

export const MaximizeIcon = ({ size = 14 }: { size?: number }) => (
  <span style={{ fontSize: `${size}px`, lineHeight: 1 }}>◻</span>
);
