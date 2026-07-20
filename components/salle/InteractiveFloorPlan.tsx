"use client";

import Link from "next/link";
import { RotateCw } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

export type FloorTableStatus = "free" | "occupied";

export type FloorTable = {
  id: string;
  label: string;
  capacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  status: FloorTableStatus;
};

export type FloorFixtureKind = "wall" | "bar" | "counter" | "pillar" | "door";

export type FloorFixture = {
  id: string;
  kind: FloorFixtureKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
};

type DragTarget =
  | { type: "table"; id: string; pointerOffsetX: number; pointerOffsetY: number }
  | { type: "fixture"; id: string; pointerOffsetX: number; pointerOffsetY: number };

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type ResizeTarget = {
  type: "table" | "fixture";
  id: string;
  handle: ResizeHandle;
  elementRotation: 0 | 90 | 180 | 270;
  origin: { x: number; y: number; width: number; height: number };
  anchorCanvas: { x: number; y: number };
  anchorFraction: { fx: number; fy: number };
};

type ActiveSelection =
  | { type: "table"; id: string }
  | { type: "fixture"; id: string }
  | null;

export type FloorPlanMode = "plan-editor" | "salle" | "kitchen-temp";

export type FloorPlanTableStatusState = "pending" | "recorded" | "draft";

type InteractiveFloorPlanProps = {
  mode?: FloorPlanMode;
  initialTables?: FloorTable[];
  initialFixtures?: FloorFixture[];
  onLayoutChange?: (layout: { tables: FloorTable[]; fixtures: FloorFixture[] }) => void;
  onTableCreate?: (table: FloorTable) => Promise<FloorTable | void> | FloorTable | void;
  onTableUpdate?: (table: FloorTable) => void;
  onTableDelete?: (id: string, remainingTables: FloorTable[]) => void;
  availableTablesToPlace?: FloorTable[];
  onPlaceExistingTable?: (table: FloorTable) => void;
  hasServiceOverrides?: boolean;
  onResetServiceLayout?: () => void;
  onTableClick?: (table: FloorTable) => void;
  /** Tables libres déjà configurées ce service — clic direct = modale. */
  activatedTableIds?: string[];
  onTableActivate?: (tableId: string) => void;
  planCopy?: {
    title: string;
    description: React.ReactNode;
    canvasLabel?: string;
    placeItemLabel?: string;
  };
  hideCapacity?: boolean;
  hideHeader?: boolean;
  itemKind?: "table" | "equipment";
  tableStatusMap?: Record<string, { state: FloorPlanTableStatusState; temperature?: number }>;
};

const DEFAULT_TABLE_WIDTH = 12;
const DEFAULT_TABLE_HEIGHT = 12;
const MIN_TABLE_WIDTH = 6;
const MIN_TABLE_HEIGHT = 6;
const MAX_TABLE_WIDTH = 40;
const MAX_TABLE_HEIGHT = 40;
const MIN_FIXTURE_WIDTH = 2;
const MIN_FIXTURE_HEIGHT = 1.5;
const MAX_FIXTURE_WIDTH = 96;
const MAX_FIXTURE_HEIGHT = 96;
const MIN_CAPACITY = 2;
const CREATE_TABLE_TIMEOUT_MS = 8000;

const FIXTURE_PRESETS: Record<
  FloorFixtureKind,
  { label: string; width: number; height: number; buttonLabel: string }
> = {
  wall: { label: "Mur", width: 28, height: 3, buttonLabel: "Mur" },
  bar: { label: "Bar", width: 22, height: 10, buttonLabel: "Bar" },
  counter: { label: "Comptoir", width: 16, height: 6, buttonLabel: "Comptoir" },
  pillar: { label: "Pilier", width: 5, height: 5, buttonLabel: "Pilier" },
  door: { label: "Porte", width: 10, height: 3, buttonLabel: "Porte" },
};

const defaultTables: FloorTable[] = [
  {
    id: "table-1",
    label: "T.1",
    capacity: 4,
    x: 44,
    y: 44,
    width: DEFAULT_TABLE_WIDTH,
    height: DEFAULT_TABLE_HEIGHT,
    rotation: 0,
    status: "free",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function canvasRotateVector(relX: number, relY: number, rotationDeg: number) {
  const rad = (rotationDeg * Math.PI) / 180;
  return {
    x: relX * Math.cos(rad) + relY * Math.sin(rad),
    y: -relX * Math.sin(rad) + relY * Math.cos(rad),
  };
}

function pointerToElementLocal(
  pointerX: number,
  pointerY: number,
  box: { x: number; y: number; width: number; height: number },
  rotationDeg: 0 | 90 | 180 | 270
) {
  if (rotationDeg === 0) {
    return { x: pointerX - box.x, y: pointerY - box.y };
  }

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const rad = (-rotationDeg * Math.PI) / 180;
  const dx = pointerX - centerX;
  const dy = pointerY - centerY;
  const localCenterOffsetX = dx * Math.cos(rad) - dy * Math.sin(rad);
  const localCenterOffsetY = dx * Math.sin(rad) + dy * Math.cos(rad);

  return {
    x: localCenterOffsetX + box.width / 2,
    y: localCenterOffsetY + box.height / 2,
  };
}

function localPointToCanvas(
  localX: number,
  localY: number,
  box: { x: number; y: number; width: number; height: number },
  rotationDeg: 0 | 90 | 180 | 270
) {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const relX = localX - box.width / 2;
  const relY = localY - box.height / 2;
  const rotated = canvasRotateVector(relX, relY, rotationDeg);
  return { x: centerX + rotated.x, y: centerY + rotated.y };
}

function solveBoxFromAnchor(
  anchorFraction: { fx: number; fy: number },
  anchorCanvas: { x: number; y: number },
  width: number,
  height: number,
  rotationDeg: 0 | 90 | 180 | 270
) {
  const anchorLocalX = anchorFraction.fx * width;
  const anchorLocalY = anchorFraction.fy * height;
  const relX = anchorLocalX - width / 2;
  const relY = anchorLocalY - height / 2;
  const rotated = canvasRotateVector(relX, relY, rotationDeg);
  const centerX = anchorCanvas.x - rotated.x;
  const centerY = anchorCanvas.y - rotated.y;

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

function getAnchorFractionForHandle(handle: ResizeHandle) {
  switch (handle) {
    case "e":
      return { fx: 0, fy: 0.5 };
    case "w":
      return { fx: 1, fy: 0.5 };
    case "s":
      return { fx: 0.5, fy: 0 };
    case "n":
      return { fx: 0.5, fy: 1 };
    case "ne":
      return { fx: 0, fy: 1 };
    case "nw":
      return { fx: 1, fy: 1 };
    case "se":
      return { fx: 0, fy: 0 };
    case "sw":
      return { fx: 1, fy: 0 };
    default:
      return { fx: 0.5, fy: 0.5 };
  }
}

function computeResizedBounds(
  handle: ResizeHandle,
  origin: { x: number; y: number; width: number; height: number },
  pointerX: number,
  pointerY: number,
  minWidth: number,
  minHeight: number,
  maxWidth: number,
  maxHeight: number,
  rotation: 0 | 90 | 180 | 270,
  anchorCanvas: { x: number; y: number },
  anchorFraction: { fx: number; fy: number }
) {
  const { x: localX, y: localY } = pointerToElementLocal(pointerX, pointerY, origin, rotation);

  let newWidth = origin.width;
  let newHeight = origin.height;

  if (handle.includes("e")) {
    newWidth = clamp(localX, minWidth, maxWidth);
  }
  if (handle.includes("w")) {
    newWidth = clamp(origin.width - localX, minWidth, maxWidth);
  }
  if (handle.includes("s")) {
    newHeight = clamp(localY, minHeight, maxHeight);
  }
  if (handle.includes("n")) {
    newHeight = clamp(origin.height - localY, minHeight, maxHeight);
  }

  let box = solveBoxFromAnchor(anchorFraction, anchorCanvas, newWidth, newHeight, rotation);

  if (box.x < 0) {
    box.width += box.x;
    box.x = 0;
  }
  if (box.y < 0) {
    box.height += box.y;
    box.y = 0;
  }
  if (box.x + box.width > 100) {
    box.width = 100 - box.x;
  }
  if (box.y + box.height > 100) {
    box.height = 100 - box.y;
  }

  box.width = clamp(box.width, minWidth, maxWidth);
  box.height = clamp(box.height, minHeight, maxHeight);

  return solveBoxFromAnchor(anchorFraction, anchorCanvas, box.width, box.height, rotation);
}

function computeResizedBoundsAxisAligned(
  handle: ResizeHandle,
  origin: { x: number; y: number; width: number; height: number },
  pointerX: number,
  pointerY: number,
  minWidth: number,
  minHeight: number,
  maxWidth: number,
  maxHeight: number,
  anchorCanvas: { x: number; y: number },
  anchorFraction: { fx: number; fy: number }
) {
  return computeResizedBounds(
    handle,
    origin,
    pointerX,
    pointerY,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    0,
    anchorCanvas,
    anchorFraction
  );
}

const RESIZE_EDGE_HITBOX: Record<ResizeHandle, string> = {
  n: "left-1 right-1 top-0 h-2 -translate-y-1/2 cursor-ns-resize",
  s: "left-1 right-1 bottom-0 h-2 translate-y-1/2 cursor-ns-resize",
  e: "right-0 top-1 bottom-1 w-2 translate-x-1/2 cursor-ew-resize",
  w: "left-0 top-1 bottom-1 w-2 -translate-x-1/2 cursor-ew-resize",
  ne: "right-0 top-0 h-4 w-4 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  nw: "left-0 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  se: "right-0 bottom-0 h-4 w-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  sw: "left-0 bottom-0 h-4 w-4 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
};

const RESIZE_CORNER_DOT: Record<ResizeHandle, string> = {
  n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
  s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2",
  e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2",
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2",
};

function ElementResizeHandles({
  isActive,
  onResizePointerDown,
  variant = "plan",
}: {
  isActive: boolean;
  onResizePointerDown: (event: React.PointerEvent<HTMLDivElement>, handle: ResizeHandle) => void;
  variant?: "plan" | "salle";
}) {
  if (!isActive) return null;

  const dotClass =
    variant === "salle"
      ? "border-white bg-copper-600"
      : "border-white bg-indigo-500";

  const handles: ResizeHandle[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

  return (
    <>
      {handles.map((handle) => (
        <div
          key={handle}
          role="presentation"
          onPointerDown={(event) => onResizePointerDown(event, handle)}
          className={`absolute z-40 touch-none ${RESIZE_EDGE_HITBOX[handle]}`}
        >
          <span
            className={`absolute block h-2.5 w-2.5 rounded-full border-2 shadow-sm ${dotClass} ${RESIZE_CORNER_DOT[handle]}`}
          />
        </div>
      ))}
    </>
  );
}

/** Place une barre d'outils près d'une table sans la faire sortir du canvas. */
function getFloatingToolbarPlacement(layout: {
  x: number;
  y: number;
  width: number;
  height: number;
}): CSSProperties {
  const centerX = layout.x + layout.width / 2;
  const bottomEdge = layout.y + layout.height;
  const topEdge = layout.y;
  const toolbarHalfWidthPct = 16;
  const clampedCenterX = clamp(centerX, toolbarHalfWidthPct, 100 - toolbarHalfWidthPct);

  const placeAbove = bottomEdge > 70;
  const placeBelow = topEdge < 18 && bottomEdge <= 70;

  if (placeAbove) {
    return {
      left: `${clampedCenterX}%`,
      bottom: "100%",
      marginBottom: "0.5rem",
      transform: "translateX(-50%)",
    };
  }

  if (placeBelow) {
    return {
      left: `${clampedCenterX}%`,
      top: "100%",
      marginTop: "0.5rem",
      transform: "translateX(-50%)",
    };
  }

  return {
    left: `${clampedCenterX}%`,
    top: "100%",
    marginTop: "0.5rem",
    transform: "translateX(-50%)",
  };
}

function nextRotation(current: 0 | 90 | 180 | 270): 0 | 90 | 180 | 270 {
  return ((current + 90) % 360) as 0 | 90 | 180 | 270;
}

type RotatedElement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
};

function isSidewaysRotation(rotation: 0 | 90 | 180 | 270) {
  return rotation === 90 || rotation === 270;
}

/** width/height = dimensions logiques ; x/y + layout = boîte axis-alignée affichée. */
function getLayoutBounds(item: RotatedElement) {
  return {
    x: item.x,
    y: item.y,
    width: isSidewaysRotation(item.rotation) ? item.height : item.width,
    height: isSidewaysRotation(item.rotation) ? item.width : item.height,
  };
}

function layoutBoundsToElement(
  bounds: { x: number; y: number; width: number; height: number },
  rotation: 0 | 90 | 180 | 270
): Pick<RotatedElement, "x" | "y" | "width" | "height"> {
  return {
    x: bounds.x,
    y: bounds.y,
    width: isSidewaysRotation(rotation) ? bounds.height : bounds.width,
    height: isSidewaysRotation(rotation) ? bounds.width : bounds.height,
  };
}

function rotateFloorElement<T extends RotatedElement>(item: T): T {
  const layout = getLayoutBounds(item);
  const centerX = layout.x + layout.width / 2;
  const centerY = layout.y + layout.height / 2;
  const newRotation = nextRotation(item.rotation);
  const newLayoutWidth = isSidewaysRotation(newRotation) ? item.height : item.width;
  const newLayoutHeight = isSidewaysRotation(newRotation) ? item.width : item.height;

  return {
    ...item,
    rotation: newRotation,
    x: centerX - newLayoutWidth / 2,
    y: centerY - newLayoutHeight / 2,
  };
}

function rotatedContentStyle(item: RotatedElement): CSSProperties {
  const layout = getLayoutBounds(item);
  return {
    width: `${(item.width / layout.width) * 100}%`,
    height: `${(item.height / layout.height) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
  };
}

function createTable(index: number): FloorTable {
  return {
    id: `table-${Date.now()}-${index}`,
    label: `T.${index}`,
    capacity: 2,
    x: 50 - DEFAULT_TABLE_WIDTH / 2,
    y: 50 - DEFAULT_TABLE_HEIGHT / 2,
    width: DEFAULT_TABLE_WIDTH,
    height: DEFAULT_TABLE_HEIGHT,
    rotation: 0,
    status: "free",
  };
}

function createFixture(kind: FloorFixtureKind, index: number): FloorFixture {
  const preset = FIXTURE_PRESETS[kind];
  return {
    id: `fixture-${Date.now()}-${index}`,
    kind,
    label: preset.label,
    x: 50 - preset.width / 2,
    y: 50 - preset.height / 2,
    width: preset.width,
    height: preset.height,
    rotation: 0,
  };
}

function fixtureStyles(kind: FloorFixtureKind): string {
  switch (kind) {
    case "wall":
      return "border-slate-700 bg-slate-700 text-white";
    case "bar":
      return "border-amber-800 bg-amber-700 text-amber-50";
    case "counter":
      return "border-stone-500 bg-stone-400 text-stone-900";
    case "pillar":
      return "border-slate-500 bg-slate-400 text-slate-900";
    case "door":
      return "border-sky-600 bg-sky-100 text-sky-900";
    default:
      return "border-slate-400 bg-slate-300 text-slate-900";
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("La création de la table prend trop de temps. Vérifiez la connexion puis réessayez."));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export function InteractiveFloorPlan({
  mode = "salle",
  initialTables = defaultTables,
  initialFixtures = [],
  onLayoutChange,
  onTableCreate,
  onTableUpdate,
  onTableDelete,
  availableTablesToPlace = [],
  onPlaceExistingTable,
  hasServiceOverrides = false,
  onResetServiceLayout,
  onTableClick,
  activatedTableIds = [],
  onTableActivate,
  planCopy,
  hideCapacity = false,
  hideHeader = false,
  itemKind = "table",
  tableStatusMap,
}: InteractiveFloorPlanProps) {
  const isPlanEditor = mode === "plan-editor";
  const isKitchenTemp = mode === "kitchen-temp";
  const fixturesEditable = isPlanEditor;
  const tablesEditable = !isKitchenTemp;
  const showLiveTableStatus = !isPlanEditor || isKitchenTemp;
  const activatedTableIdSet = new Set(activatedTableIds);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const tablesRef = useRef<FloorTable[]>(initialTables);
  const fixturesRef = useRef<FloorFixture[]>(initialFixtures);
  const dragMovedRef = useRef(false);
  const [tables, setTables] = useState<FloorTable[]>(initialTables);
  const [fixtures, setFixtures] = useState<FloorFixture[]>(initialFixtures);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [resizeTarget, setResizeTarget] = useState<ResizeTarget | null>(null);
  const [activeSelection, setActiveSelection] = useState<ActiveSelection>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [isCreatingTable, setIsCreatingTable] = useState(false);

  useEffect(() => {
    setTables(initialTables);
    tablesRef.current = initialTables;
  }, [initialTables]);

  useEffect(() => {
    setFixtures(initialFixtures);
    fixturesRef.current = initialFixtures;
  }, [initialFixtures]);

  function notifyLayoutChange(nextTables: FloorTable[], nextFixtures: FloorFixture[]) {
    tablesRef.current = nextTables;
    fixturesRef.current = nextFixtures;
    onLayoutChange?.({ tables: nextTables, fixtures: nextFixtures });
  }

  function commitTables(nextTables: FloorTable[]) {
    setTables(nextTables);
    notifyLayoutChange(nextTables, fixturesRef.current);
  }

  function commitFixtures(nextFixtures: FloorFixture[]) {
    setFixtures(nextFixtures);
    notifyLayoutChange(tablesRef.current, nextFixtures);
  }

  function commitTableUpdate(nextTable: FloorTable) {
    const nextTables = tablesRef.current.map((table) =>
      table.id === nextTable.id ? nextTable : table
    );
    setTables(nextTables);
    notifyLayoutChange(nextTables, fixturesRef.current);
    onTableUpdate?.(nextTable);
  }

  function commitFixtureUpdate(nextFixture: FloorFixture) {
    const nextFixtures = fixturesRef.current.map((fixture) =>
      fixture.id === nextFixture.id ? nextFixture : fixture
    );
    setFixtures(nextFixtures);
    notifyLayoutChange(tablesRef.current, nextFixtures);
  }

  async function handleAddTable() {
    const optimisticTable = createTable(tables.length + 1);
    setCreationError(null);
    setIsCreatingTable(true);
    const nextTables = [...tablesRef.current, optimisticTable];
    setTables(nextTables);
    tablesRef.current = nextTables;
    setActiveSelection({ type: "table", id: optimisticTable.id });

    try {
      const createdTable =
        (await withTimeout(Promise.resolve(onTableCreate?.(optimisticTable)), CREATE_TABLE_TIMEOUT_MS)) ??
        optimisticTable;
      const syncedTables = nextTables.map((table) =>
        table.id === optimisticTable.id ? createdTable : table
      );
      setTables(syncedTables);
      tablesRef.current = syncedTables;
      setActiveSelection({ type: "table", id: createdTable.id });
      notifyLayoutChange(syncedTables, fixturesRef.current);
      onTableUpdate?.(createdTable);
    } catch (error) {
      const rolledBack = tablesRef.current.filter((table) => table.id !== optimisticTable.id);
      setTables(rolledBack);
      tablesRef.current = rolledBack;
      setActiveSelection(null);
      notifyLayoutChange(rolledBack, fixturesRef.current);
      setCreationError(error instanceof Error ? error.message : "Impossible de créer la table.");
    } finally {
      setIsCreatingTable(false);
    }
  }

  function handleAddFixture(kind: FloorFixtureKind) {
    const nextFixture = createFixture(kind, fixtures.length + 1);
    const nextFixtures = [...fixturesRef.current, nextFixture];
    commitFixtures(nextFixtures);
    setActiveSelection({ type: "fixture", id: nextFixture.id });
  }

  function handleDeleteTable(id: string) {
    const nextTables = tablesRef.current.filter((table) => table.id !== id);
    commitTables(nextTables);
    setActiveSelection((current) =>
      current?.type === "table" && current.id === id ? null : current
    );
    onTableDelete?.(id, nextTables);
  }

  function handleDeleteFixture(id: string) {
    const nextFixtures = fixturesRef.current.filter((fixture) => fixture.id !== id);
    commitFixtures(nextFixtures);
    setActiveSelection((current) =>
      current?.type === "fixture" && current.id === id ? null : current
    );
  }

  function handleChangeCapacity(table: FloorTable, delta: number) {
    commitTableUpdate({
      ...table,
      capacity: Math.max(MIN_CAPACITY, table.capacity + delta),
    });
  }

  function handleResizePointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    type: "table" | "fixture",
    id: string,
    handle: ResizeHandle
  ) {
    if (type === "fixture" && !fixturesEditable) return;
    if (type === "table" && !tablesEditable && !isKitchenTemp) return;

    event.stopPropagation();
    event.preventDefault();

    const item =
      type === "table"
        ? tablesRef.current.find((table) => table.id === id)
        : fixturesRef.current.find((fixture) => fixture.id === id);
    if (!item) return;

    const layout = getLayoutBounds(item);
    const origin = layout;
    const anchorFraction = getAnchorFractionForHandle(handle);
    const anchorLocal = {
      x: anchorFraction.fx * layout.width,
      y: anchorFraction.fy * layout.height,
    };
    const anchorCanvas = {
      x: origin.x + anchorLocal.x,
      y: origin.y + anchorLocal.y,
    };

    setActiveSelection({ type, id });
    setResizeTarget({
      type,
      id,
      handle,
      elementRotation: item.rotation,
      origin,
      anchorCanvas,
      anchorFraction,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleOpenTableForService(table: FloorTable) {
    setActiveSelection(null);
    onTableActivate?.(table.id);
    onTableClick?.(table);
  }

  function isTableServiceReady(table: FloorTable) {
    if (isKitchenTemp) return true;
    return table.status === "occupied" || activatedTableIdSet.has(table.id);
  }

  function handleRotateTable(table: FloorTable) {
    commitTableUpdate(rotateFloorElement(table));
  }

  function handleRotateFixture(fixture: FloorFixture) {
    commitFixtureUpdate(rotateFloorElement(fixture));
  }

  function handlePointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
    type: "table" | "fixture",
    id: string
  ) {
    if (type === "fixture" && !fixturesEditable) return;
    if (type === "table" && !tablesEditable) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;

    if (type === "table") {
      const table = tablesRef.current.find((item) => item.id === id);
      if (!table) return;
      setActiveSelection({ type: "table", id: table.id });
      dragMovedRef.current = false;
      dragStartRef.current = { x: pointerX, y: pointerY };
      setDragTarget({
        type: "table",
        id: table.id,
        pointerOffsetX: pointerX - table.x,
        pointerOffsetY: pointerY - table.y,
      });
    } else {
      const fixture = fixturesRef.current.find((item) => item.id === id);
      if (!fixture) return;
      setActiveSelection({ type: "fixture", id: fixture.id });
      dragMovedRef.current = false;
      dragStartRef.current = { x: pointerX, y: pointerY };
      setDragTarget({
        type: "fixture",
        id: fixture.id,
        pointerOffsetX: pointerX - fixture.x,
        pointerOffsetY: pointerY - fixture.y,
      });
    }

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;

    if (resizeTarget) {
      if (resizeTarget.type === "fixture" && !fixturesEditable) return;
      if (resizeTarget.type === "table" && !tablesEditable && !isKitchenTemp) return;

      const minWidth =
        resizeTarget.type === "table" ? MIN_TABLE_WIDTH : MIN_FIXTURE_WIDTH;
      const minHeight =
        resizeTarget.type === "table" ? MIN_TABLE_HEIGHT : MIN_FIXTURE_HEIGHT;
      const maxWidth =
        resizeTarget.type === "table" ? MAX_TABLE_WIDTH : MAX_FIXTURE_WIDTH;
      const maxHeight =
        resizeTarget.type === "table" ? MAX_TABLE_HEIGHT : MAX_FIXTURE_HEIGHT;
      const minLayoutWidth = isSidewaysRotation(resizeTarget.elementRotation)
        ? minHeight
        : minWidth;
      const minLayoutHeight = isSidewaysRotation(resizeTarget.elementRotation)
        ? minWidth
        : minHeight;
      const maxLayoutWidth = isSidewaysRotation(resizeTarget.elementRotation)
        ? maxHeight
        : maxWidth;
      const maxLayoutHeight = isSidewaysRotation(resizeTarget.elementRotation)
        ? maxWidth
        : maxHeight;

      const layoutBounds = computeResizedBoundsAxisAligned(
        resizeTarget.handle,
        resizeTarget.origin,
        pointerX,
        pointerY,
        minLayoutWidth,
        minLayoutHeight,
        maxLayoutWidth,
        maxLayoutHeight,
        resizeTarget.anchorCanvas,
        resizeTarget.anchorFraction
      );
      const bounds = layoutBoundsToElement(layoutBounds, resizeTarget.elementRotation);

      if (resizeTarget.type === "table") {
        const nextTables = tablesRef.current.map((table) =>
          table.id === resizeTarget.id ? { ...table, ...bounds } : table
        );
        setTables(nextTables);
        tablesRef.current = nextTables;
      } else {
        const nextFixtures = fixturesRef.current.map((fixture) =>
          fixture.id === resizeTarget.id ? { ...fixture, ...bounds } : fixture
        );
        setFixtures(nextFixtures);
        fixturesRef.current = nextFixtures;
      }
      return;
    }

    if (!dragTarget) return;
    if (dragTarget.type === "fixture" && !fixturesEditable) return;
    if (dragTarget.type === "table" && !tablesEditable && !isKitchenTemp) return;

    const dragStart = dragStartRef.current;
    if (dragStart && Math.hypot(pointerX - dragStart.x, pointerY - dragStart.y) > 0.6) {
      dragMovedRef.current = true;
    }

    if (dragTarget.type === "table") {
      const nextTables = tablesRef.current.map((table) => {
        if (table.id !== dragTarget.id) return table;
        const layout = getLayoutBounds(table);
        return {
          ...table,
          x: clamp(pointerX - dragTarget.pointerOffsetX, 0, 100 - layout.width),
          y: clamp(pointerY - dragTarget.pointerOffsetY, 0, 100 - layout.height),
        };
      });
      setTables(nextTables);
      tablesRef.current = nextTables;
    } else {
      const nextFixtures = fixturesRef.current.map((fixture) => {
        if (fixture.id !== dragTarget.id) return fixture;
        const layout = getLayoutBounds(fixture);
        return {
          ...fixture,
          x: clamp(pointerX - dragTarget.pointerOffsetX, 0, 100 - layout.width),
          y: clamp(pointerY - dragTarget.pointerOffsetY, 0, 100 - layout.height),
        };
      });
      setFixtures(nextFixtures);
      fixturesRef.current = nextFixtures;
    }
  }

  function handlePointerUp() {
    if (resizeTarget) {
      notifyLayoutChange(tablesRef.current, fixturesRef.current);
      if (resizeTarget.type === "table") {
        const updatedTable = tablesRef.current.find((table) => table.id === resizeTarget.id);
        if (updatedTable) onTableUpdate?.(updatedTable);
      }
      setResizeTarget(null);
      return;
    }

    if (!dragTarget) return;

    const clickedTable =
      dragTarget.type === "table" &&
      !dragMovedRef.current &&
      (showLiveTableStatus || isKitchenTemp) &&
      onTableClick
        ? tablesRef.current.find((table) => table.id === dragTarget.id)
        : null;

    dragStartRef.current = null;

    notifyLayoutChange(tablesRef.current, fixturesRef.current);
    if (dragTarget.type === "table") {
      const updatedTable = tablesRef.current.find((table) => table.id === dragTarget.id);
      if (updatedTable) onTableUpdate?.(updatedTable);
    }
    setDragTarget(null);

    if (clickedTable) {
      if (isTableServiceReady(clickedTable)) {
        setActiveSelection(null);
        onTableClick?.(clickedTable);
      } else {
        setActiveSelection({ type: "table", id: clickedTable.id });
      }
      return;
    }
  }

  const headerTitle =
    planCopy?.title ?? (isPlanEditor ? "Configurer le plan de salle" : isKitchenTemp ? "Plan cuisine" : "Plan de salle");
  const placeItemLabel = planCopy?.placeItemLabel ?? "Placer sur le plan";
  const canvasLabel = planCopy?.canvasLabel ?? "Plan de salle dynamique";
  const itemNoun = itemKind === "equipment" ? "équipement" : "table";

  return (
    <div className="space-y-4">
      {!hideHeader ? (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{headerTitle}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {planCopy?.description ?? (
              isPlanEditor ? (
                <>
                  Dessinez la structure (murs, bar…) et placez les tables de référence. Ce plan de base
                  est restauré automatiquement en fin de service.
                </>
              ) : isKitchenTemp ? (
                <>Touchez un équipement pour saisir sa température. Les couleurs indiquent l&apos;état du relevé du jour.</>
              ) : (
                <>
                  Glissez pour déplacer une table. La première ouverture d'une table libre permet de la
                  positionner et d'ajuster les couverts, puis les clics suivants ouvrent la commande. En fin
                  de service, tout revient au plan de base configuré dans{" "}
                  <Link href="/salle/plan" className="font-semibold text-indigo-600 hover:text-indigo-700">
                    Configurer le plan
                  </Link>
                  .
                </>
              )
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPlanEditor && onTableCreate && itemKind === "table" ? (
            <button
              type="button"
              onClick={handleAddTable}
              disabled={isCreatingTable}
              className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreatingTable ? "Création…" : "＋ Nouvelle Table"}
            </button>
          ) : null}
          {!isPlanEditor && onResetServiceLayout ? (
            <button
              type="button"
              onClick={onResetServiceLayout}
              className="min-h-11 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 shadow-sm transition hover:bg-indigo-100 active:scale-[0.98]"
            >
              Fin de service
            </button>
          ) : null}
        </div>
      </div>
      ) : null}

      {!isPlanEditor && !isKitchenTemp && hasServiceOverrides ? (
        <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          Disposition temporaire en cours. Cliquez sur <strong>Fin de service</strong> pour revenir au
          plan de base.
        </p>
      ) : null}

      {isPlanEditor && availableTablesToPlace.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-500">{placeItemLabel} :</span>
          {availableTablesToPlace.map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => onPlaceExistingTable?.(table)}
              className="min-h-10 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 active:scale-[0.98]"
            >
              ＋ {table.label}
            </button>
          ))}
        </div>
      ) : null}

      {fixturesEditable ? (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FIXTURE_PRESETS) as FloorFixtureKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => handleAddFixture(kind)}
              className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
            >
              ＋ {FIXTURE_PRESETS[kind].buttonLabel}
            </button>
          ))}
        </div>
      ) : null}

      {!isPlanEditor && !isKitchenTemp && fixtures.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Aucun plan configuré.{" "}
          <Link href="/salle/plan" className="font-semibold text-amber-950 underline hover:no-underline">
            Créez votre plan de salle
          </Link>{" "}
          pour afficher murs, bar et comptoirs en arrière-plan.
        </p>
      ) : null}

      {creationError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {creationError}
        </p>
      ) : null}

      <div
        ref={canvasRef}
        className="relative min-h-[320px] w-full touch-none overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 aspect-video"
        style={{ aspectRatio: "16 / 9" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="application"
        aria-label={canvasLabel}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.16)_1px,transparent_1px)] bg-[size:8.333%_12.5%]" />

        {fixtures.map((fixture) => {
          const isActive =
            fixturesEditable &&
            activeSelection?.type === "fixture" &&
            activeSelection.id === fixture.id;
          const layout = getLayoutBounds(fixture);

          return (
            <div
              key={fixture.id}
              className={`absolute z-10 ${fixturesEditable ? "group" : "pointer-events-none"}`}
              style={{
                left: `${layout.x}%`,
                top: `${layout.y}%`,
                width: `${layout.width}%`,
                height: `${layout.height}%`,
              }}
            >
              <div className="relative h-full w-full">
                <div
                  className="absolute left-1/2 top-1/2"
                  style={rotatedContentStyle(fixture)}
                >
                  {fixturesEditable ? (
                    <button
                      type="button"
                      onPointerDown={(event) => handlePointerDown(event, "fixture", fixture.id)}
                      onClick={() => setActiveSelection({ type: "fixture", id: fixture.id })}
                      className={`flex h-full w-full select-none items-center justify-center rounded-lg border-2 px-1 text-center text-[10px] font-bold shadow-sm transition-all duration-200 active:scale-95 sm:text-xs ${fixtureStyles(fixture.kind)} ${
                        isActive ? "ring-4 ring-indigo-200" : ""
                      }`}
                      aria-label={`${fixture.label}, élément fixe`}
                    >
                      <span className="truncate">{fixture.label}</span>
                    </button>
                  ) : (
                    <div
                      className={`flex h-full w-full items-center justify-center rounded-lg border-2 px-1 text-center text-[10px] font-bold shadow-sm sm:text-xs ${fixtureStyles(fixture.kind)}`}
                      aria-hidden
                    >
                      <span className="truncate">{fixture.label}</span>
                    </div>
                  )}
                </div>

                {fixturesEditable ? (
                  <ElementResizeHandles
                    isActive={isActive}
                    onResizePointerDown={(event, handle) =>
                      handleResizePointerDown(event, "fixture", fixture.id, handle)
                    }
                  />
                ) : null}
              </div>

              {fixturesEditable ? (
                <div
                  className={`absolute left-1/2 top-full z-20 mt-2 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-lg transition ${
                    isActive ? "opacity-100" : "pointer-events-none opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleRotateFixture(fixture)}
                    className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100 active:scale-95"
                    aria-label={`Pivoter ${fixture.label}`}
                    title="Pivoter 90°"
                  >
                    <RotateCw className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFixture(fixture.id)}
                    className="h-10 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-500 transition hover:bg-red-50 hover:text-red-700 active:scale-95"
                  >
                    Suppr.
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}

        {tables.map((table) => {
          const isOccupied = showLiveTableStatus && !isKitchenTemp && table.status === "occupied";
          const isActive = activeSelection?.type === "table" && activeSelection.id === table.id;
          const isServiceReady = showLiveTableStatus && isTableServiceReady(table);
          const isPendingSetup = showLiveTableStatus && !isKitchenTemp && !isServiceReady;
          const tempStatus = tableStatusMap?.[table.id];
          const layout = getLayoutBounds(table);

          function kitchenTempClasses(): string {
            if (!isKitchenTemp) return "";
            if (tempStatus?.state === "recorded") {
              return "border-emerald-500/90 bg-emerald-50/90 shadow-md ring-2 ring-emerald-300/60";
            }
            if (tempStatus?.state === "draft") {
              return "border-sky-500/90 bg-sky-50/90 shadow-md ring-2 ring-sky-300/60";
            }
            return "border-amber-400/80 bg-amber-50/80 shadow-sm ring-2 ring-amber-200/60 hover:border-amber-500";
          }

          return (
            <div
              key={table.id}
              className="group absolute z-20"
              style={{
                left: `${layout.x}%`,
                top: `${layout.y}%`,
                width: `${layout.width}%`,
                height: `${layout.height}%`,
              }}
            >
              <div className="relative h-full w-full">
                <div
                  className="absolute left-1/2 top-1/2"
                  style={rotatedContentStyle(table)}
                >
                  <button
                    type="button"
                    onPointerDown={(event) => handlePointerDown(event, "table", table.id)}
                    onClick={
                      isPlanEditor
                        ? () => setActiveSelection({ type: "table", id: table.id })
                        : isKitchenTemp
                          ? () => onTableClick?.(table)
                          : undefined
                    }
                    className={`relative flex h-full w-full select-none flex-col items-center justify-center rounded-2xl border-2 p-2 text-center transition-all duration-200 active:scale-95 ${
                      isKitchenTemp
                        ? kitchenTempClasses()
                        : showLiveTableStatus
                        ? isOccupied
                          ? "border-copper-500/90 bg-copper-50/90 shadow-md ring-2 ring-copper-300/60"
                          : isPendingSetup && isActive
                            ? "border-copper-400/70 bg-copper-50/40 shadow-sm ring-2 ring-copper-200/50"
                            : "border-stone-300/25 bg-white/20 shadow-none hover:border-stone-300/40"
                        : "border-slate-300 bg-white shadow-sm ring-4 ring-slate-100"
                    } ${isPlanEditor && isActive ? "shadow-lg ring-4 ring-slate-100" : isPlanEditor ? "hover:shadow-md" : ""}`}
                    aria-label={
                      isKitchenTemp
                        ? `${table.label}, ${itemNoun}, ${tempStatus?.state === "recorded" ? "relevé enregistré" : "relevé en attente"}`
                        : `${table.label}, ${table.capacity} personnes, ${isOccupied ? "occupée" : "libre"}`
                    }
                  >
                  <span
                    className={`text-sm font-bold sm:text-base ${
                      isKitchenTemp
                        ? "text-stone-900"
                        : showLiveTableStatus
                        ? isOccupied || (isPendingSetup && isActive)
                          ? "text-copper-900"
                          : "text-stone-400/50"
                        : "text-slate-900"
                    }`}
                  >
                    {table.label}
                  </span>
                {!hideCapacity && (isPlanEditor || (showLiveTableStatus && isPendingSetup && isActive)) ? (
                <span
                  className={`mt-0.5 text-[11px] font-medium sm:text-xs ${
                    showLiveTableStatus && !isKitchenTemp ? "text-copper-700" : "text-slate-500"
                  }`}
                >
                  {table.capacity} pers
                </span>
                ) : null}
                {isKitchenTemp && tempStatus?.temperature != null ? (
                  <span className="mt-0.5 text-[11px] font-semibold tabular-nums text-emerald-800 sm:text-xs">
                    {tempStatus.temperature} °C
                  </span>
                ) : null}
                  </button>
                </div>

                {tablesEditable && (isPlanEditor || (showLiveTableStatus && isPendingSetup && isActive)) ? (
                <ElementResizeHandles
                  isActive={isActive}
                  variant={showLiveTableStatus ? "salle" : "plan"}
                  onResizePointerDown={(event, handle) =>
                    handleResizePointerDown(event, "table", table.id, handle)
                  }
                />
                ) : null}
              </div>

              {isPlanEditor && tablesEditable ? (
              <div
                className={`absolute left-1/2 top-full z-30 mt-2 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-lg transition ${
                  isActive ? "opacity-100" : "pointer-events-none opacity-0 group-hover:opacity-100"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleRotateTable(table)}
                  className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100 active:scale-95"
                  aria-label={`Pivoter ${table.label}`}
                  title="Pivoter 90°"
                >
                  <RotateCw className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeCapacity(table, -1)}
                  className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-700 transition hover:bg-slate-200 active:scale-95"
                  aria-label={`Réduire la capacité de ${table.label}`}
                  title="Moins de couverts"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeCapacity(table, 1)}
                  className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white transition hover:bg-slate-800 active:scale-95"
                  aria-label={`Augmenter la capacité de ${table.label}`}
                  title="Plus de couverts"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTable(table.id)}
                  className="h-10 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-500 transition hover:bg-red-50 hover:text-red-700 active:scale-95"
                  aria-label={`Retirer ${table.label} du plan de base`}
                  title="Retirer du plan de base"
                >
                  Retirer
                </button>
              </div>
              ) : null}

              {showLiveTableStatus && !isKitchenTemp && isPendingSetup && isActive ? (
                <div
                  className="absolute z-30 flex items-center gap-1 rounded-2xl border border-copper-200 bg-white/95 p-1 shadow-lg"
                  style={getFloatingToolbarPlacement(layout)}
                >
                  <button
                    type="button"
                    onClick={() => handleRotateTable(table)}
                    className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-copper-50 text-copper-700 transition hover:bg-copper-100 active:scale-95"
                    aria-label={`Pivoter ${table.label}`}
                    title="Pivoter 90°"
                  >
                    <RotateCw className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeCapacity(table, -1)}
                    className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-stone-100 text-lg font-bold text-stone-700 transition hover:bg-stone-200 active:scale-95"
                    aria-label={`Réduire la capacité de ${table.label}`}
                    title="Moins de couverts"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeCapacity(table, 1)}
                    className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-stone-900 text-lg font-bold text-white transition hover:bg-stone-800 active:scale-95"
                    aria-label={`Augmenter la capacité de ${table.label}`}
                    title="Plus de couverts"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenTableForService(table)}
                    className="copper-sheen h-10 rounded-xl px-3 text-xs font-bold text-white transition hover:brightness-110 active:scale-95"
                  >
                    Ouvrir la table
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
