# Chess Game - Technical UI/UX Design & Frontend Architecture

## 1. Design Overview & Philosophy

The application features a dark-mode-first, high-precision desktop and mobile interface centered around the dynamic board. It integrates standard chess mechanics with extensible card/ability HUD overlays for Phase 2.

### Design Principles

* **Board as the Focal Point:** All secondary elements (HUD, card tray, clock, move history) resize or fold around the central matrix.
* **Component-Driven System:** Built using `shadcn/ui` (Radix UI + Tailwind CSS) with custom-built engine connectors for board grid rendering.
* **Asset Scalability (PNG 512px):** To support customized pieces (such as future variant pieces, stealth indicators, or promo variations), pieces are loaded as high-resolution **512x512 PNG assets** (separated by color: White and Black).
* **Isolated Animation System:** Complex UI state changes and loading screens (matchmaking pulse, preparation timers, board loading) are encapsulated in standalone TSX animation components (e.g., `LoadingAnimation.tsx`).

---

## 2. Color Tokens & Theme System

The UI uses a dark, low-contrast background palette to ensure high-visibility card color badges and piece assets.

```css
@theme {
  --color-bg: #0B0D10;
  --color-surface: #12161B;
  --color-surface-raised: #1A1F26;
  --color-line: #262C35;
  --color-text: #E6E9EE;
  --color-text-muted: #8B94A1;

  /* Board Palette */
  --color-square-light: #3A4250;
  --color-square-dark: #232A34;
  --color-square-highlight: rgba(76, 141, 246, 0.3);
  --color-square-move: rgba(255, 255, 255, 0.2);
  --color-danger: #E5484D;

  /* Phase 2 Card Color Hierarchy */
  --color-card-gold: #E5B53B;
  --color-card-silver: #AEB6C2;
  --color-card-green: #3FB97A;
  --color-card-blue: #4C8DF6;
  --color-card-bronze: #B87333;
  --color-card-purple: #9A6BFF;

  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --radius-lg: 12px;
  --radius-md: 8px;
}
```

---

## 3. Piece Asset Management & Customization Architecture

To allow seamless addition of custom pieces (e.g., *Shadow Horseman*, *Pylon*, *Fortress*) without modifying SVG code, all piece images are referenced from structured 512px PNG assets.

### Asset Folder Convention
```
public/assets/pieces/
├── white/
│   ├── pawn.png       # 512x512 PNG
│   ├── knight.png
│   ├── bishop.png
│   ├── rook.png
│   ├── queen.png
│   ├── king.png
│   └── [custom_pieces] # Phase 2 Custom pieces (e.g., necromancer.png)
└── black/
    ├── pawn.png       # 512x512 PNG
    ├── knight.png
    ├── bishop.png
    ├── rook.png
    ├── queen.png
    ├── king.png
    └── [custom_pieces]
```

### Piece Renderer Component Schema
`src/components/board/Piece.tsx` dynamically maps the piece type and color to the high-res PNG path with optimized hardware-accelerated transforms.

---

## 4. Standalone Loading & Animation Modules

All loader animations, matchmaking pulses, and transition screens are maintained in dedicated TSX components for modularity and easy styling.

### Dedicated Loading Component Structure
`src/components/common/LoadingAnimation.tsx`

```tsx
import React from 'react';

interface LoadingAnimationProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'matchmaking' | 'board-init' | 'spinner';
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  message = "Loading match data...",
  size = 'md',
  variant = 'matchmaking'
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24'
  };

  if (variant === 'matchmaking') {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-4">
        <div className="relative flex items-center justify-center">
          <div className={`${sizeClasses[size]} rounded-full border-2 border-line border-t-card-blue animate-spin`} />
          <div className="absolute w-1/2 h-1/2 bg-card-blue/20 rounded-full animate-ping" />
        </div>
        {message && (
          <p className="text-sm font-mono text-text-muted animate-pulse">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4">
      <div className="w-6 h-6 border-2 border-line border-t-text rounded-full animate-spin" />
    </div>
  );
};
```

---

## 5. UI Component Hierarchy & Routing

```
src/
├── app/
│   ├── App.tsx
│   └── Router.tsx
├── components/
│   ├── ui/                    # shadcn/ui components (Button, Dialog, Tooltip, Tabs)
│   ├── common/
│   │   ├── Header.tsx
│   │   └── LoadingAnimation.tsx # Standalone loading & status screen module
│   ├── board/
│   │   ├── Board.tsx          # 10x10 Matrix Board Renderer
│   │   ├── Square.tsx         # Interactive target square
│   │   ├── Piece.tsx          # 512px PNG piece renderer
│   │   └── BoardOverlay.tsx   # Skill targets / freeze indicators
│   ├── cards/                 # Prepared Phase 2 UI Dock
│   │   ├── CardTray.tsx
│   │   ├── CardTile.tsx
│   │   └── DeckBuilder.tsx
│   ├── hud/
│   │   ├── ClockDisplay.tsx   # JetBrains Mono countdown timers
│   │   ├── MoveLog.tsx        # History log scroll panel
│   │   └── PlayerProfile.tsx
│   └── modals/
│       ├── PrepPhaseModal.tsx # Pre-game 20s preparation dialog
│       └── GameOverModal.tsx  # Post-match summary dialog
└── stores/
    ├── useMatchStore.ts       # Board & card active UI states
    └── useSettingsStore.ts    # Sound & animation settings
```

---

## 6. Layout & Screen Flows

| Screen | Core Components | Key Features |
| :--- | :--- | :--- |
| **Login / Auth** | `Card`, `Button`, `LoadingAnimation` | Auth state verification & Google login. |
| **Lobby** | `Tabs`, `Select`, `Button` | Mode selection (Classic 1v1 vs Card Mode). |
| **Matchmaking** | `LoadingAnimation` (variant="matchmaking") | Searching indicator with queue timers. |
| **Preparation** | `PrepPhaseModal`, `Progress` | Pre-match setup (20s countdown lock). |
| **In-Game Match** | `Board`, `Piece` (PNG 512px), `ClockDisplay`, `CardTray` | Real-time main match view. Responsive layouts auto-fold panels on mobile. |
| **Post-Match** | `GameOverModal`, `Button` | Game end statistics, rating changes, and quick replay trigger. |

---

## 7. Interactive Physics & Sound Feedback Systems

### Pointer Field Effect (`usePointerField`)
* Pieces slightly tilt towards the cursor based on distance calculations (`transform: rotateX(...) rotateY(...)`).
* Render updates write directly to DOM `ref` instances inside an `animationFrame` loop to maintain 60 FPS performance.
* Automatically disabled when `prefers-reduced-motion` is detected or on touch devices.

### Audio Response System (`lib/audio.ts`)
* Uses low-latency audio sprites.
* Plays specific effects for move, capture, check, castle, and card activation events.
* Master volume sliders and sound toggles are preserved in `useSettingsStore`.