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
`src/features/board/components/Piece.tsx` dynamically maps the piece type and color to the high-res PNG path (via `pieceImages.ts`) with optimized hardware-accelerated transforms.

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
├── components/
│   ├── ui/                        # Button, Card, Dialog, Input, ScrollArea
│   ├── common/
│   │   └── LoadingAnimation.tsx   # Standalone loading & status screen module
│   ├── hud/
│   │   └── MoveLog.tsx            # SAN move history panel
│   └── (board pieces live under features/board, below)
├── contexts/
│   ├── AuthContext.tsx            # The auth provider
│   ├── authContextDefinition.ts   # The context and its types
│   └── useAuth.ts                 # The hook that reads the context
├── features/                      # Screens, grouped by feature
│   ├── auth/LoginScreen.tsx
│   ├── board/components/
│   │   ├── BoardGrid.tsx          # 10x10 Matrix Board Renderer
│   │   ├── Piece.tsx              # 512px PNG piece renderer
│   │   └── pieceImages.ts         # The piece-code to sprite mapping
│   ├── lobby/LobbyScreen.tsx
│   ├── match/
│   │   ├── MatchScreen.tsx        # The main match view
│   │   └── components/
│   │       └── ClockDisplay.tsx   # JetBrains Mono countdown display
│   ├── result/ResultScreen.tsx
│   └── room/
│       ├── CreateRoomScreen.tsx
│       ├── JoinRoomScreen.tsx
│       └── WaitingRoomScreen.tsx
├── hooks/
│   ├── useGameSync.ts             # RTDB listener & move dispatcher
│   ├── useTimer.ts                # The synchronised clock
│   └── usePointerField.ts         # 3D pointer tilt
├── lib/
│   ├── audio.ts                   # Web Audio sound effects
│   └── firebase.ts
└── stores/
    ├── useGameStore.ts            # Time control selection
    └── useSettingsStore.ts        # Sound & animation settings
```

### Routes

| Route | Screen | Access |
| :--- | :--- | :--- |
| `/login` | `LoginScreen` | Signed out only |
| `/lobby` | `LobbyScreen` | Signed in |
| `/create-room` | `CreateRoomScreen` | Signed in |
| `/join-room` | `JoinRoomScreen` | Signed in |
| `/room/:roomId` | `WaitingRoomScreen` | Signed in |
| `/match/:roomId` | `MatchScreen` | Signed in |
| `/result` | `ResultScreen` | Signed in |

Both `/login` and the game routes redirect to each other when the auth state
does not match, so a signed-in player never sees the login screen and a
signed-out player never reaches the board.

---

## 6. Layout & Screen Flows

| Screen | Core Components | Key Features |
| :--- | :--- | :--- |
| **Login / Auth** | `Card`, `Button`, `LoadingAnimation` | Auth state verification & Google/Facebook login. |
| **Lobby** | `Card`, `Button` | Create or join a room by six-character code, plus the time control picker. |
| **Waiting Room** | `Card`, `Button` | Shows the room code and both players until the game starts. |
| **In-Game Match** | `BoardGrid`, `Piece` (PNG 512px), `ClockDisplay`, `MoveLog` | Real-time main match view. Responsive layouts auto-fold panels on mobile. |
| **Post-Match** | `Button`, `Badge` | The result read from the room, the final position, and a link back to the board. |

Phase 1 has no matchmaking queue and no preparation phase: both are Phase 2
features, and the lobby offers only the two room actions.

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