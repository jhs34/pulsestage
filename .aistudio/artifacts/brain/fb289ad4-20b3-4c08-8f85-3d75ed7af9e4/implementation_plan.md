# PULSE STAGE — DJ 부스용 비주얼 & 조명 컨트롤러

교실 TV나 대형 스크린에 전체화면으로 띄워두고 키보드 단축키만으로 클럽 수준의 배경 비주얼과 페이드/스트로브 조명, 실시간 BPM 비트매칭을 직관적으로 제어할 수 있는 라이브 VJ 및 조명 컨트롤러 웹 애플리케이션입니다.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **확정된 핵심 설계 사항 (사용자 답변 반영)**
> - **Confirmed Decision 1 (1~8번 배경 비주얼 테마)**: 어두운 톤을 유지하면서 화이트 조명과의 대비를 극대화하는 **세트 A (클럽 & 레이저 조명 8종)**으로 구성합니다.
> - **Confirmed Decision 2 (화이트 페이드 & 스트로브 연출 모드)**: 단순 흰색 오버레이를 배제하고, **① 광학 블룸 & 스테이지 조명 번짐(Stage Bloom)** 모드와 **② 배경 그래픽 자체 백색 과발광(Geometry Overdrive)** 모드를 모두 구현하여 UI 및 단축키(`L`키)로 즉시 전환할 수 있게 합니다.
> - **Confirmed Decision 3 (비트매칭 피치벤드 및 싱크 조작)**: 마우스로 화면의 `-` / `+` 버튼을 홀드하는 동작과 키보드 단축키(`[`, `]` 또는 `←`, `→` 방향키 홀드)를 모두 지원합니다.

---

## 1. Overview & Core Concept

- **What It Does**: 키보드 숫자키(`0`~`9`), 알파벳 상단열(`Q`~`P`), `Space` 바, 그리고 BPM 컨트롤을 결합하여 음악의 빌드업·드롭·브레이크다운에 맞춰 즉각적인 시각 및 조명 효과를 연출하는 실시간 캔버스 스테이지 시스템입니다.
- **Target Audience / Persona**: 교실 파티, 학교 축제, 소규모 DJ 부스에서 별도의 DMX 조명 장비 없이 TV/프로젝터 화면 하나로 강렬한 파티 조명과 비주얼을 동시에 연출하려는 DJ 및 공연 진행자.
- **Key Value**:
  - **초저지연 키보드 퍼포먼스**: `Q`(100ms)부터 `P`(1000ms)까지 10단계로 세분화된 페이드 아웃 조명과 `Space` 홀드 스트로브로 곡의 리듬감을 손끝으로 연주 가능.
  - **정교한 DJ 비트매칭**: Rekordbox/CDJ 스타일의 탭 템포(Tap), 1박 싱크(Cue/Sync), 일시적 템포 가감속(Pitch Bend `-`/`+`)으로 실제 재생 중인 음원과 박자를 정확히 일치시킴.

---

## 2. User Experience & Visual Design

### 1~8번 다크 배경 비주얼 및 0/9번 테마 구성
흰색 페이드 및 스트로브 조명이 터질 때 눈부신 대비(Contrast)를 만들 수 있도록, 1~8번 테마의 기본 배경색은 깊은 칠흑색(`#050508` ~ `#0A0B10`)으로 유지됩니다.

| 단축키 | 테마 명칭 | 시각적 연출 및 BPM 반응 특징 |
| :---: | :--- | :--- |
| **`0`** | **Blackout (암전)** | 완전한 검은색 화면 (`#000000`). 단, 암전 상태에서도 `Q`~`P` 화이트 페이드와 `Space` 스트로브 조명은 정상 작동하여 칠흑 속 조명 연출 가능 |
| **`1`** | **Deep Sub-Bass Waves (심연의 사인파)** | 어두운 남색/청록색의 다중 사인파 곡선들이 유영하며 비트 타격 시 파형의 진폭과 중심 광량이 튀어 오름 |
| **`2`** | **Perspective Laser Grid (레이저 그리드 터널)** | 어두운 자홍/보라색 3D 원근 와이어프레임 터널이 전진하며 박자마다 그리드 교차점과 수평선이 맥동 |
| **`3`** | **Club Laser Array (방사형 레이저 빔)** | 상단 및 중앙에서 뻗어 나오는 샤프한 에메랄드/시안 레이저 빔들이 대기 중 연무(Haze) 효과를 가르며 비트에 맞춰 각도 전환 |
| **`4`** | **Dark EQ Pillars (이퀄라이저 모노리스)** | 묵직한 대칭형 수직 스펙트럼 기둥들이 은은한 반사광과 함께 BPM 비트 및 주파수 시뮬레이션에 맞춰 역동적으로 솟구침 |
| **`5`** | **Obsidian Star Warp (스타필드 워프)** | 칠흑 같은 우주 공간을 가로지르는 입자들이 중심에서 사방으로 뻗어 나가며 비트마다 순간적인 워프 가속 발생 |
| **`6`** | **Concentric Pulse Rings (사이버네틱 링)** | 화면 중앙에서 확산되는 어두운 앰버/블루 동심원 고리들이 박자에 맞춰 공명하며 기하학적 파문을 형성 |
| **`7`** | **Dark Nebula Smoke (플라즈마 네뷸라)** | 짙은 심해색과 바이올렛 오라클 안개가 유영하다가 비트 타격 순간 중심부 에너지가 일렁이며 확산 |
| **`8`** | **Wireframe Polyhedra (기하학 와이어프레임)** | 어두운 공간 속 다중 3D 정다면체(Icosahedron/Octahedron) 와이어프레임이 회전하며 비트마다 스케일과 회전축이 변화 |
| **`9`** | **Full Whiteout (화이트아웃)** | 강렬한 하이라이트 연출을 위한 전체 화이트 화면 (`#FFFFFF`) |

### 화이트 페이드(`Q`~`P`) & 스트로브(`Space`) 조명 엔진
단순히 흰색 사각형(`rgba(255,255,255,alpha)`)을 덮어씌우는 평면적인 방식을 지양하고, 사용자가 실시간으로 전환 가능한 **2가지 입체 조명 연출 모드**를 제공합니다:
1. **Stage Bloom (광학 블룸 & 조명 번짐 모드)**:
   - `globalCompositeOperation = 'lighter'`(가산 혼합)를 활용하여 화면 중앙의 강렬한 코어 광원, 가장자리 렌즈 비네트 번짐, 십자형 아나모픽 플레어(Anamorphic Flare), 그리고 현재 그려지고 있는 배경 캔버스 요소들의 밝기 증폭이 동시에 일어납니다.
2. **Geometry Overdrive (배경 그래픽 백색 과발광 모드)**:
   - 조명 트리거 시 배경 비주얼의 선 두께(Line Width), 입자 크기, 네온 글로우(`shadowBlur`)가 순간적으로 증폭되며 기존 어두운 컬러에서 순백색(Pure White) 고휘도 에너지로 하얗게 불타오르듯 발광합니다.
- **Q~P 지속시간 매핑**:
  - `Q`(100ms), `W`(200ms), `E`(300ms), `R`(400ms), `T`(500ms), `Y`(600ms), `U`(700ms), `I`(800ms), `O`(900ms), `P`(1000ms).
  - 키를 누르는 즉시 최대 광량(100%)으로 점등된 후, 지수 감쇠 곡선(Exponential Decay)을 따라 부드럽고 자연스럽게 어두워집니다.
- **스페이스바 점멸 스트로브**:
  - 화이트 페이드보다 최대 피크 밝기를 약간 낮춘 세련된 광량(약 70~75% 피크 강도)으로 동작하여 눈의 피로를 줄이면서 긴박한 스트로브 효과를 연출합니다.
  - `Space` 바를 누르고 있는 동안에만 설정된 주기(기본값 10Hz, 슬라이더 및 단축키로 4Hz~20Hz 조절 가능)로 점멸하며, 손을 떼는 즉시 0ms 지연으로 멈춥니다.

### Visual Identity & HUD Layout
- **Aesthetic Direction**: 전문 DJ 하드웨어(Pioneer CDJ / Rekordbox / Resolume Arena)에서 영감을 얻은 **Tactical Dark Booth Console** 테마.
- **Color Palette**:
  - 캔버스 바탕: `#050508` (Obsidian Black)
  - HUD 표면: `rgba(12, 14, 20, 0.72)` + `backdrop-filter: blur(12px)` + 미세한 헤어라인 보더 `rgba(255, 255, 255, 0.08)`
  - 포인트 컬러: 비트 싱크 에메랄드(`#10B981`), 피치벤드 앰버(`#F59E0B`), 액티브 테마 시안(`#06B6D4`)
- **Typography**:
  - 디스플레이/헤더: `Outfit` / `Plus Jakarta Sans`
  - BPM 수치, 밀리초(`100ms`~`1000ms`), 주파수(`Hz`) 등 모든 수치 데이터: `JetBrains Mono` (`tabular-nums` 적용으로 숫자 변화 시 레이아웃 흔들림 완벽 방지)
- **최소화된 플로팅 HUD & 마우스 오버 세부 설정**:
  - 평상시에는 화면 하단 중앙에 얇고 절제된 **Compact Dock**만 반투명하게 표시되어 비주얼 시야를 가리지 않습니다.
  - 컨트롤 독에 **마우스를 올릴 때(Hover)**에만 세부 설정 서랍(스트로브 속도 Hz 슬라이더, 조명 모드 Stage Bloom / Geometry Overdrive 스위치, Q~P 키별 지속시간 인디케이터, 전체 단축키 가이드)이 부드럽게 펼쳐집니다.
  - **`H` 키(Hide UI)**를 누르면 하단 독과 상단 상태 표시줄이 완전히 사라져 순수한 100% 전체화면 비주얼/조명 캔버스만 남으며, 전체화면 전환(`F` 키)도 함께 지원합니다.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: HTML5 2D/WebGL 하이브리드 고성능 프로시저럴 캔버스 엔진**
  - *Chosen Approach*: `requestAnimationFrame` 기반의 60fps/120fps 고주사율 Canvas 렌더링 엔진에 가산 혼합(Additive Blending)과 파티클/기하학 수학 모델을 결합합니다.
  - *Why*: 8가지 서로 다른 테마를 숫자키 `1`~`8`로 누르는 즉시 프레임 드랍이나 로딩 지연(0ms) 없이 즉각 전환할 수 있으며, `Geometry Overdrive` 모드에서 조명 강도 변수(`fadeIntensity`, `strobeIntensity`)를 각 비주얼 렌더러의 선 굵기·색상·발광 파라미터에 직접 주입할 수 있습니다.
- **Decision 2: 고정밀 BPM 위상 축적기(Phase Accumulator) & 일시적 피치벤드**
  - *Chosen Approach*: 단순 `setInterval` 대신 프레임 간 경과 시간(`deltaTime`)을 기준으로 위상(`beatPhase: 0.0 -> 1.0`)을 연속 적분하는 클럭 엔진을 구현합니다.
  - *Why*: `-` 또는 `+` 버튼(혹은 `[` / `]` 키)을 누르고 있는 동안 기본 BPM(예: `128.0 BPM`)은 보존한 채 유효 BPM(`effectiveBpm = baseBpm + bendOffset`)만 실시간으로 가감속하여 음악의 킥 드럼과 비주얼 박자 위상을 미세하게 앞당기거나 늦출 수 있습니다.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Application Shell (App.tsx)                        │
│   Global Keyboard Listener (0-9, Q-P, Space, [ ], ← →, T, S, L, H, F)   │
└───────────────┬─────────────────────────────────────────┬───────────────┘
                │                                         │
                ▼                                         ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────┐
│   Stage Visual & Lighting Engine      │ │   Minimalist Floating HUD     │
│   (Full-Viewport Canvas 100vw/100vh)  │ │   (Auto-Collapse / H to Hide) │
├───────────────────────────────────────┤ ├───────────────────────────────┤
│ • Master Clock & Beat Phase (0..1)    │ │ • Compact Status Strip        │
│ • Theme Renderers (0: Blackout,       │ │   - Active Theme (0-9)        │
│   1-8: Dark Club Visuals, 9: White)   │ │   - Active BPM & Beat LED     │
│ • Lighting State Machine:             │ │   - Active Fade/Strobe Meter  │
│   - QWERTY Fade Envelope (100~1000ms) │ │ • Hover-Expandable Drawer:    │
│   - Space Hold Strobe Oscillator      │ │   - BPM Input, Tap, Sync/Cue  │
│ • Dual Lighting Compositor:           │ │   - Pitch Bend (- / + Hold)   │
│   - Mode A: Stage Bloom & Lens Flare  │ │   - Auto BPM / Manual Toggle  │
│   - Mode B: Geometry White Overdrive  │ │   - Strobe Speed & Light Mode │
└───────────────────────────────────────┘ └───────────────────────────────┘
```

### Interactive Component & State Mapping

1. **배경 테마 상태 (`activeTheme: 0..9`)**:
   - 키보드 `0`~`9` 입력 또는 HUD 테마 버튼 클릭 시 즉시 전환.
   - `1`~`8`번 선택 시 각 테마 고유 파라미터와 어두운 베이스 팔레트 로드.
2. **QWERTY 페이드 조명 상태 (`fadeState`)**:
   - 키 매핑: `Q`(100ms), `W`(200ms), `E`(300ms), `R`(400ms), `T`(500ms), `Y`(600ms), `U`(700ms), `I`(800ms), `O`(900ms), `P`(1000ms).
   - 키 다운(`keydown`, `e.repeat` 무시) 시 `triggerTime = performance.now()`, `duration = mappedMs` 기록 후 매 프레임 남은 시간 비율에 비례해 비선형 감쇠 곡선 계산.
3. **스페이스바 스트로브 상태 (`strobeActive`, `strobeRateHz`)**:
   - `Space` 키 `keydown` 시 활성화, `keyup` 또는 창 포커스 해제(`blur`) 시 즉시 비활성화.
   - 활성화 중에는 `strobeRateHz`(기본 10Hz) 주기의 구형파/삼각파 변조를 통해 피크 밝기 0.72 수준으로 날카롭게 점멸.
4. **BPM & 비트매칭 클럭 (`baseBpm`, `pitchBend`, `autoMode`)**:
   - 직접 숫자 입력(60~200 BPM), `TAP` 버튼(최근 4~8회 탭 간격 평균 계산), `SYNC/CUE` 버튼(현재 비트 위상을 즉시 `0.0` 정박으로 리셋).
   - 피치벤드 `-`(`[` 또는 `←` 키 홀드, 마우스 `onPointerDown`~`onPointerUp`) 동안 `-4%` (또는 `-5 BPM`) 감속, `+`(`]` 또는 `→` 키 홀드) 동안 `+4%` (또는 `+5 BPM`) 가속 후 손을 떼면 즉시 `baseBpm` 복귀.
   - `Auto(BPM)` 모드일 때는 계산된 비트 펄스(`beatPulse`)가 1~8번 배경 애니메이션의 크기·속도·밝기를 자동으로 타격하며, `Off(수동)` 모드일 때는 배경이 일정한 기본 속도로만 흐르고 사용자의 조명 조작에만 반응.
