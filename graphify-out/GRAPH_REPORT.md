# Graph Report - Chess Game  (2026-11-16)

## Corpus Check
- Corpus is ~34,618 words - fits in a single context window. You may not need a graph.

## Summary
- 470 nodes · 932 edges · 35 communities (19 shown, 16 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Auth & Firebase Backend
- Testing & Validation
- Testing & Validation
- Auth & Firebase Backend
- Auth & Firebase Backend
- Chess Engine & Moves
- Chess Engine & Moves
- UI Components
- UI Components
- Frontend Tooling & Assets
- Auth & Firebase Backend
- Auth & Firebase Backend
- Testing & Validation
- Auth & Firebase Backend
- Testing & Validation
- Chess Engine & Moves
- Frontend Tooling & Assets
- Frontend Tooling & Assets
- Match Flow & Screens
- Core App Structure
- UI Components
- Core App Structure
- Core App Structure
- Core App Structure
- Core App Structure
- Core App Structure
- Core App Structure
- Core App Structure
- Core App Structure
- Core App Structure
- Core App Structure
- Core App Structure
- Core App Structure
- Core App Structure
- Core App Structure

## God Nodes (most connected - your core abstractions)
1. `RoomService` - 26 edges
2. `react` - 25 edges
3. `StandardEngine` - 24 edges
4. `useAuth()` - 18 edges
5. `compilerOptions` - 18 edges
6. `BoardGrid10x10` - 17 edges
7. `MatchScreen()` - 17 edges
8. `compilerOptions` - 15 edges
9. `lucide-react` - 13 edges
10. `Button()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Vite HTML entrypoint` --conceptually_related_to--> `React logo asset`  [INFERRED]
  Chess-Game/index.html → Chess-Game/src/assets/react.svg
- `Vite HTML entrypoint` --conceptually_related_to--> `Vite logo asset`  [INFERRED]
  Chess-Game/index.html → Chess-Game/src/assets/vite.svg
- `512px PNG piece assets` --references--> `Black bishop sprite`  [EXTRACTED]
  Chess-Game/docs/chess_game_ui_design_document.md → Chess-Game/public/assets/pieces/black/bishop.png
- `512px PNG piece assets` --references--> `White king sprite`  [EXTRACTED]
  Chess-Game/docs/chess_game_ui_design_document.md → Chess-Game/public/assets/pieces/white/king.png
- `Vite HTML entrypoint` --references--> `Purple lightning favicon`  [EXTRACTED]
  Chess-Game/index.html → Chess-Game/public/favicon.svg

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 1 client validation and synchronized play** — chess_system_architecture_standardengine, chess_system_architecture_usegamesync, chess_system_architecture_firebase_rtdb, chess_system_architecture_security_rules [EXTRACTED 1.00]
- **White and black standard piece sprite set** — chess_asset_black_bishop, chess_asset_black_king, chess_asset_black_knight, chess_asset_black_pawn, chess_asset_black_queen, chess_asset_black_rook, chess_asset_white_bishop, chess_asset_white_king, chess_asset_white_knight, chess_asset_white_pawn, chess_asset_white_queen, chess_asset_white_rook [EXTRACTED 1.00]
- **Phase 1 architecture and governance corpus** — chess_phase_roadmap_phase1, chess_plan_architecture_decisions, chess_agent_rules_doc_driven_development, chess_system_architecture_ichessengine, chess_ui_design_routes [EXTRACTED 1.00]

## Communities (35 total, 16 thin omitted)

### Community 0 - "Auth & Firebase Backend"
Cohesion: 0.08
Nodes (41): App(), AppRoutes(), AuthRoute(), LoadingScreen(), ProtectedRoute(), Button(), ButtonProps, Card() (+33 more)

### Community 1 - "Testing & Validation"
Cohesion: 0.07
Nodes (25): Color, GameOutcome, IChessEngine, MoveResult, PromotionPiece, StandardEngine, STARTING_FEN, chessBoardToGrid() (+17 more)

### Community 2 - "Testing & Validation"
Cohesion: 0.07
Nodes (39): buildPosition(), ChessStateExtras, CODE_BY_ROLE, decodePiece(), deriveInitialCastlingRights(), GridBoard, gridToChessBoard(), PieceCode (+31 more)

### Community 3 - "Auth & Firebase Backend"
Cohesion: 0.09
Nodes (29): LoadingAnimation(), LoadingAnimationProps, SIZES, MoveLog, MoveLogProps, gridToAlgebraic(), GridCoord, BoardGrid (+21 more)

### Community 4 - "Auth & Firebase Backend"
Cohesion: 0.12
Nodes (16): MoveRequest, GameActions, GameSnapshot, rtdb, DEFAULT_TIME_CONTROL, generateRoomCode(), RoomPlayerIdentity, RoomService (+8 more)

### Community 5 - "Chess Engine & Moves"
Cohesion: 0.08
Nodes (28): CARD_COLORS, CardTile, CardTileProps, CardTray(), CardTrayProps, BoardState, ButtonProps, Card (+20 more)

### Community 6 - "Chess Engine & Moves"
Cohesion: 0.14
Nodes (18): chunk(), COLOURS, crc32(), CRC_TABLE, dilate(), drawBishop(), drawKing(), drawKnight() (+10 more)

### Community 7 - "UI Components"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 8 - "UI Components"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 9 - "Frontend Tooling & Assets"
Cohesion: 0.17
Nodes (15): devDependencies, eslint@^10.10.0, @eslint/js@^10.0.1, eslint-plugin-react-hooks@^7.1.1, eslint-plugin-react-refresh@^0.5.6, globals@^17.12.0, @types/node@^24.13.3, typescript-eslint@^8.69.0 (+7 more)

### Community 10 - "Auth & Firebase Backend"
Cohesion: 0.13
Nodes (15): Doc-driven development governance, Black bishop sprite, White king sprite, 10x10 GridBoard with central 8x8, Serverless client-first chess application, Phase 1 implementation roadmap, Completed architecture decisions, Firebase Realtime Database sync (+7 more)

### Community 11 - "Auth & Firebase Backend"
Cohesion: 0.23
Nodes (12): FirebaseAuthError, AuthContext, AuthContextType, SavedDeck, UserProfile, app, auth, db (+4 more)

### Community 12 - "Testing & Validation"
Cohesion: 0.15
Nodes (12): @types/react@^19.2.18, @types/react-dom@^19.2.7, typescript@~6.0.2, vitest@^5.1.0, name, private, type, version (+4 more)

### Community 13 - "Auth & Firebase Backend"
Cohesion: 0.15
Nodes (13): dependencies, chessops@^0.15.1, firebase@^13.0.0, lucide-react@^1.55.0, react@^19.2.8, react-dom@^19.2.8, react-router-dom@^7.18.4, tailwindcss@^4.3.3 (+5 more)

### Community 14 - "Testing & Validation"
Cohesion: 0.20
Nodes (10): scripts, build, deploy, dev, emulators, generate:pieces, lint, preview (+2 more)

### Community 15 - "Chess Engine & Moves"
Cohesion: 0.33
Nodes (6): PieceComponent(), PieceProps, PieceCode, PieceColor, pieceImage(), PieceKind

### Community 16 - "Frontend Tooling & Assets"
Cohesion: 0.29
Nodes (6): @tailwindcss/vite@^4.3.3, vite@^8.3.0, @vitejs/plugin-react@^6.1.1, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 17 - "Frontend Tooling & Assets"
Cohesion: 0.50
Nodes (4): Purple lightning favicon, React logo asset, Vite logo asset, Vite HTML entrypoint

### Community 18 - "Match Flow & Screens"
Cohesion: 0.67
Nodes (3): ClockDisplay(), ClockDisplayProps, formatTime()

## Knowledge Gaps
- **26 isolated node(s):** `10x10 GridBoard with central 8x8`, `IChessEngine abstraction`, `Dark precision UI theme`, `LoadingAnimation module`, `Authentication and game routes` (+21 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 190 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Auth & Firebase Backend` to `Auth & Firebase Backend`, `Auth & Firebase Backend`, `Chess Engine & Moves`, `Auth & Firebase Backend`, `Testing & Validation`, `Auth & Firebase Backend`, `Chess Engine & Moves`, `Match Flow & Screens`?**
  _High betweenness centrality (0.177) - this node is a cross-community bridge._
- **What connects `10x10 GridBoard with central 8x8`, `IChessEngine abstraction`, `Dark precision UI theme` to the rest of the system?**
  _26 weakly-connected nodes found - possible missing edges._
- **Should `Auth & Firebase Backend` be split into smaller, more focused modules?**
  _Cohesion score 0.08346134152585766 - nodes in this community are weakly interconnected._
- **Why does `StandardEngine` connect `Testing & Validation` to `Testing & Validation`, `Auth & Firebase Backend`, `Auth & Firebase Backend`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Should `Testing & Validation` be split into smaller, more focused modules?**
  _Cohesion score 0.06892655367231638 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Auth & Firebase Backend` to `Chess Engine & Moves`, `Auth & Firebase Backend`, `Testing & Validation`, `Auth & Firebase Backend`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Should `Testing & Validation` be split into smaller, more focused modules?**
  _Cohesion score 0.0726950354609929 - nodes in this community are weakly interconnected._