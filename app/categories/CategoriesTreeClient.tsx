"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createRestaurantCategory,
  deleteRestaurantCategory,
  groupRestaurantCategoriesUnderNewParent,
  renameRestaurantCategory,
  reparentRestaurantCategory,
  updateRestaurantCategoryAppliesTo,
} from "./actions";
import type {
  CategoryAppliesTo,
  CategoryTreeNode,
  RestaurantCategory,
} from "@/lib/catalog/restaurantCategories";
import {
  canReparentCategory,
  filterTopLevelSelectedIds,
  inferGroupAppliesTo,
} from "@/lib/catalog/restaurantCategories";
import { CategoryPictogram } from "@/components/catalog/CategoryPictogram";
import {
  uiBtnOutlineSm,
  uiBtnPrimarySm,
  uiCard,
  uiError,
  uiInput,
  uiLabel,
  uiLead,
  uiSelect,
} from "@/components/ui/premium";

const ROOT_DROP_ID = "__root__";

function resolveDropTarget(clientX: number, clientY: number): string | null | undefined {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return undefined;
  if (el.closest("[data-drop-root]")) return ROOT_DROP_ID;
  const row = el.closest("[data-drop-category]") as HTMLElement | null;
  if (row?.dataset.dropCategory) return row.dataset.dropCategory;
  return undefined;
}

type PointerPreview = { label: string; x: number; y: number };

const APPLIES_LABEL: Record<CategoryAppliesTo, string> = {
  dish: "Carte seulement",
  inventory: "Stock seulement",
  both: "Carte et stock",
};

type DragContextValue = {
  draggedId: string | null;
  dropTargetId: string | null;
  selectionMode: boolean;
  reparentPending: boolean;
  beginPointerDrag: (categoryId: string, label: string, x: number, y: number) => void;
  canDropOn: (targetId: string | null) => boolean;
};

const DragContext = createContext<DragContextValue | null>(null);

function useDragContext() {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error("DragContext manquant");
  return ctx;
}

function DragHandle({ categoryId, label }: { categoryId: string; label: string }) {
  const { beginPointerDrag, selectionMode, reparentPending } = useDragContext();
  if (selectionMode || reparentPending) return null;

  return (
    <span
      role="presentation"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        beginPointerDrag(categoryId, label, e.clientX, e.clientY);
      }}
      className="flex h-9 w-7 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 active:cursor-grabbing"
      aria-label={`Déplacer ${label}`}
      title="Maintenir et glisser sur une autre rubrique"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
    </span>
  );
}

function PointerDragPreview({ preview }: { preview: PointerPreview }) {
  return (
    <div
      className="pointer-events-none fixed z-[200] flex items-center gap-2 rounded-xl border border-copper-300 bg-white px-3 py-2 text-sm font-medium text-stone-900 shadow-lg ring-1 ring-copper-100"
      style={{ left: preview.x + 14, top: preview.y + 14 }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-stone-400" aria-hidden>
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
      {preview.label}
    </div>
  );
}

function AppliesSelect({
  categoryId,
  restaurantId,
  value,
}: {
  categoryId: string;
  restaurantId: string;
  value: CategoryAppliesTo;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <select
      className={`min-w-[10rem] ${uiSelect}`}
      disabled={pending}
      value={value}
      onChange={(e) => {
        const next = e.target.value as CategoryAppliesTo;
        startTransition(async () => {
          const res = await updateRestaurantCategoryAppliesTo({
            restaurantId,
            categoryId,
            appliesTo: next,
          });
          if (!res.ok) alert(res.error);
          else router.refresh();
        });
      }}
    >
      {(Object.keys(APPLIES_LABEL) as CategoryAppliesTo[]).map((k) => (
        <option key={k} value={k}>
          {APPLIES_LABEL[k]}
        </option>
      ))}
    </select>
  );
}

function AddChildForm({
  restaurantId,
  parentId,
  onDone,
}: {
  restaurantId: string;
  parentId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [appliesTo, setAppliesTo] = useState<CategoryAppliesTo>("both");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createRestaurantCategory({
        restaurantId,
        parentId,
        name,
        appliesTo: appliesTo,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setName("");
      onDone();
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className={`mt-2 flex flex-wrap items-end gap-2 rounded-xl border border-stone-100 bg-stone-50/80 p-3`}>
      {error ? <p className={`w-full ${uiError}`}>{error}</p> : null}
      <label className="flex flex-col gap-1">
        <span className={uiLabel}>Nom de la sous-rubrique</span>
        <input
          className={uiInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex. Bordeaux"
          disabled={pending}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={uiLabel}>Portée</span>
        <select
          className={uiSelect}
          value={appliesTo}
          onChange={(e) => setAppliesTo(e.target.value as CategoryAppliesTo)}
          disabled={pending}
        >
          {(Object.keys(APPLIES_LABEL) as CategoryAppliesTo[]).map((k) => (
            <option key={k} value={k}>
              {APPLIES_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={uiBtnPrimarySm} disabled={pending || !name.trim()}>
        Ajouter
      </button>
      <button type="button" className={uiBtnOutlineSm} disabled={pending} onClick={onDone}>
        Annuler
      </button>
    </form>
  );
}

function GroupForm({
  restaurantId,
  flat,
  selectedIds,
  onDone,
  onSuccess,
}: {
  restaurantId: string;
  flat: RestaurantCategory[];
  selectedIds: string[];
  onDone: () => void;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(flat.map((c) => [c.id, c])), [flat]);
  const topLevel = useMemo(
    () => filterTopLevelSelectedIds(selectedIds, flat),
    [selectedIds, flat]
  );
  const reparentRows = useMemo(
    () => topLevel.map((id) => byId.get(id)).filter(Boolean) as RestaurantCategory[],
    [topLevel, byId]
  );
  const defaultApplies = useMemo(() => inferGroupAppliesTo(reparentRows), [reparentRows]);

  const [name, setName] = useState("");
  const [appliesTo, setAppliesTo] = useState<CategoryAppliesTo>(defaultApplies);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const labels = reparentRows.map((c) => c.name).join(", ");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await groupRestaurantCategoriesUnderNewParent({
        restaurantId,
        categoryIds: selectedIds,
        name,
        appliesTo,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSuccess();
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className={`${uiCard} space-y-3 border-copper-200 bg-copper-50/40`}>
      <h2 className="text-sm font-semibold text-stone-900">Regrouper sous une nouvelle rubrique</h2>
      <p className={`text-xs ${uiLead}`}>
        {topLevel.length} rubrique{topLevel.length > 1 ? "s" : ""} devien
        {topLevel.length > 1 ? "dront" : "dra"} sous-rubrique{topLevel.length > 1 ? "s" : ""} :{" "}
        <span className="font-medium text-stone-800">{labels}</span>
      </p>
      {error ? <p className={uiError}>{error}</p> : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className={uiLabel}>Nom de la rubrique parente</span>
          <input
            className={uiInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. Vins"
            disabled={pending}
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={uiLabel}>Portée</span>
          <select
            className={uiSelect}
            value={appliesTo}
            onChange={(e) => setAppliesTo(e.target.value as CategoryAppliesTo)}
            disabled={pending}
          >
            {(Object.keys(APPLIES_LABEL) as CategoryAppliesTo[]).map((k) => (
              <option key={k} value={k}>
                {APPLIES_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={uiBtnPrimarySm} disabled={pending || !name.trim()}>
          Regrouper
        </button>
        <button type="button" className={uiBtnOutlineSm} disabled={pending} onClick={onDone}>
          Annuler
        </button>
      </div>
    </form>
  );
}

function RootDropZone() {
  const { draggedId, dropTargetId, canDropOn } = useDragContext();
  if (!draggedId) return null;

  const active = dropTargetId === ROOT_DROP_ID;
  const allowed = canDropOn(null);

  return (
    <div
      data-drop-root=""
      className={`rounded-xl border-2 border-dashed px-4 py-4 text-sm transition-colors ${
        active && allowed
          ? "border-copper-500 bg-copper-50 text-copper-900 shadow-sm"
          : allowed
            ? "border-copper-200 bg-copper-50/50 text-stone-700"
            : "border-stone-100 bg-stone-50/40 text-stone-400"
      }`}
    >
      <p className="font-medium">
        {allowed ? "↑ Rubriques principales" : "Rubrique déjà au niveau principal"}
      </p>
      <p className={`mt-1 text-xs ${allowed ? "text-stone-600" : "text-stone-400"}`}>
        {allowed
          ? "Relâchez ici pour en faire une rubrique à part entière"
          : "Cette rubrique n’est pas une sous-rubrique"}
      </p>
    </div>
  );
}

function CategoryRow({
  node,
  depth,
  restaurantId,
  selectedIds,
  onToggleSelect,
}: {
  node: CategoryTreeNode;
  depth: number;
  restaurantId: string;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  const router = useRouter();
  const {
    draggedId,
    dropTargetId,
    selectionMode,
    reparentPending,
    canDropOn,
  } = useDragContext();

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rename, setRename] = useState(node.name);
  const [pending, startTransition] = useTransition();
  const selected = selectedIds.has(node.id);

  const isDragging = draggedId === node.id;
  const isDropTarget = dropTargetId === node.id;
  const droppable = canDropOn(node.id);

  const handleDelete = () => {
    if (
      !window.confirm(
        `Supprimer « ${node.name} » ? Les sous-rubriques seront supprimées aussi ; les plats et composants liés n’auront plus de rubrique.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteRestaurantCategory({ restaurantId, categoryId: node.id });
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  };

  const handlePromoteToRoot = () => {
    startTransition(async () => {
      const res = await reparentRestaurantCategory({
        restaurantId,
        categoryId: node.id,
        newParentId: null,
      });
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  };

  const saveRename = (e: React.FormEvent) => {
    e.preventDefault();
    const t = rename.trim();
    if (!t || t === node.name) {
      setEditing(false);
      setRename(node.name);
      return;
    }
    startTransition(async () => {
      const res = await renameRestaurantCategory({
        restaurantId,
        categoryId: node.id,
        name: t,
      });
      if (!res.ok) alert(res.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  };

  return (
    <li className="list-none" data-drop-category={node.id}>
      <div
        className={`flex flex-wrap items-center gap-2 border-b border-stone-100 py-2 transition-colors ${
          selected ? "bg-copper-50/60" : ""
        } ${isDragging ? "opacity-40" : ""} ${
          isDropTarget && droppable ? "bg-copper-100/70 ring-2 ring-inset ring-copper-400" : ""
        }`}
        style={{ paddingLeft: depth * 16 }}
      >
        {selectionMode ? (
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 rounded border-stone-300 text-copper-600 focus:ring-copper-500"
            checked={selected}
            onChange={() => onToggleSelect(node.id)}
            aria-label={`Sélectionner ${node.name}`}
          />
        ) : !editing ? (
          <DragHandle categoryId={node.id} label={node.name} />
        ) : null}
        {editing ? (
          <form onSubmit={saveRename} className="flex flex-wrap items-center gap-2">
            <input
              className={uiInput}
              value={rename}
              onChange={(e) => setRename(e.target.value)}
              disabled={pending}
            />
            <button type="submit" className={uiBtnPrimarySm} disabled={pending}>
              OK
            </button>
            <button
              type="button"
              className={uiBtnOutlineSm}
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setRename(node.name);
              }}
            >
              Annuler
            </button>
          </form>
        ) : (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-copper-50 text-copper-700 shadow-inner ring-1 ring-copper-100/90">
              <CategoryPictogram title={node.name} depth={depth} />
            </span>
            <span className="min-w-0 flex-1 font-medium text-stone-900">{node.name}</span>
            {!selectionMode ? (
              <>
                <AppliesSelect categoryId={node.id} restaurantId={restaurantId} value={node.applies_to} />
                <button type="button" className={uiBtnOutlineSm} onClick={() => setEditing(true)}>
                  Renommer
                </button>
                <button type="button" className={uiBtnOutlineSm} onClick={() => setAdding((a) => !a)}>
                  {adding ? "Fermer" : "Sous-rubrique"}
                </button>
                {node.parent_id ? (
                  <button
                    type="button"
                    className={uiBtnOutlineSm}
                    disabled={pending || reparentPending}
                    onClick={handlePromoteToRoot}
                    title="Repasser en rubrique principale (niveau racine)"
                  >
                    Remonter
                  </button>
                ) : null}
                <button
                  type="button"
                  className={uiBtnOutlineSm}
                  disabled={pending || reparentPending}
                  onClick={handleDelete}
                >
                  Supprimer
                </button>
              </>
            ) : null}
          </>
        )}
      </div>
      {adding ? (
        <div style={{ paddingLeft: (depth + 1) * 16 }}>
          <AddChildForm restaurantId={restaurantId} parentId={node.id} onDone={() => setAdding(false)} />
        </div>
      ) : null}
      {node.children.length > 0 ? (
        <ul className="border-l border-stone-100">
          {node.children.map((ch) => (
            <CategoryRow
              key={ch.id}
              node={ch}
              depth={depth + 1}
              restaurantId={restaurantId}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function AddRootForm({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [appliesTo, setAppliesTo] = useState<CategoryAppliesTo>("both");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createRestaurantCategory({
        restaurantId,
        parentId: null,
        name,
        appliesTo,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setName("");
      router.refresh();
    });
  };

  return (
    <div className={uiCard}>
      <h2 className="mb-2 text-sm font-semibold text-stone-900">Nouvelle rubrique racine</h2>
      <p className={`mb-3 text-xs ${uiLead}`}>
        Ex. « Vin », « Légumes » — puis ajoutez des sous-rubriques (région, couleur…).
      </p>
      {error ? <p className={`mb-2 ${uiError}`}>{error}</p> : null}
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className={uiLabel}>Nom</span>
          <input
            className={uiInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. Boissons"
            disabled={pending}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={uiLabel}>Portée</span>
          <select
            className={uiSelect}
            value={appliesTo}
            onChange={(e) => setAppliesTo(e.target.value as CategoryAppliesTo)}
            disabled={pending}
          >
            {(Object.keys(APPLIES_LABEL) as CategoryAppliesTo[]).map((k) => (
              <option key={k} value={k}>
                {APPLIES_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={uiBtnPrimarySm} disabled={pending || !name.trim()}>
          Créer
        </button>
      </form>
    </div>
  );
}

export function CategoriesTreeClient({
  restaurantId,
  tree,
  flat,
}: {
  restaurantId: string;
  tree: CategoryTreeNode[];
  flat: RestaurantCategory[];
}) {
  const router = useRouter();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [pointerPreview, setPointerPreview] = useState<PointerPreview | null>(null);
  const [reparentPending, startReparent] = useTransition();
  const draggedIdRef = useRef<string | null>(null);
  const dropTargetIdRef = useRef<string | null>(null);

  const selectedCount = selectedIds.size;
  const topLevelCount = filterTopLevelSelectedIds([...selectedIds], flat).length;

  const canDropOn = useCallback(
    (targetId: string | null) => {
      const id = draggedIdRef.current;
      if (!id) return false;
      return canReparentCategory(id, targetId, flat).ok;
    },
    [flat]
  );

  const endDrag = useCallback(() => {
    draggedIdRef.current = null;
    dropTargetIdRef.current = null;
    setDraggedId(null);
    setDropTargetId(null);
    setPointerPreview(null);
  }, []);

  const commitDrop = useCallback(
    (targetId: string | null) => {
      const dragged = draggedIdRef.current;
      if (!dragged) return;
      const check = canReparentCategory(dragged, targetId, flat);
      if (!check.ok) {
        alert(check.reason);
        endDrag();
        return;
      }
      endDrag();
      startReparent(async () => {
        const res = await reparentRestaurantCategory({
          restaurantId,
          categoryId: dragged,
          newParentId: targetId,
        });
        if (!res.ok) alert(res.error);
        else router.refresh();
      });
    },
    [flat, endDrag, restaurantId, router]
  );

  const beginPointerDrag = useCallback((categoryId: string, label: string, x: number, y: number) => {
    draggedIdRef.current = categoryId;
    dropTargetIdRef.current = null;
    setDraggedId(categoryId);
    setDropTargetId(null);
    setPointerPreview({ label, x, y });
  }, []);

  useEffect(() => {
    if (!draggedId) return;

    const onMove = (e: PointerEvent) => {
      setPointerPreview((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
      const dragged = draggedIdRef.current;
      if (!dragged) return;
      const target = resolveDropTarget(e.clientX, e.clientY);
      let next: string | null = null;
      if (target === ROOT_DROP_ID && canReparentCategory(dragged, null, flat).ok) {
        next = ROOT_DROP_ID;
      } else if (typeof target === "string" && canReparentCategory(dragged, target, flat).ok) {
        next = target;
      }
      dropTargetIdRef.current = next;
      setDropTargetId(next);
    };

    const onUp = () => {
      const target = dropTargetIdRef.current;
      const dragged = draggedIdRef.current;
      setPointerPreview(null);
      if (!dragged) {
        endDrag();
        return;
      }
      if (target === ROOT_DROP_ID && canReparentCategory(dragged, null, flat).ok) {
        commitDrop(null);
      } else if (target && target !== ROOT_DROP_ID && canReparentCategory(dragged, target, flat).ok) {
        commitDrop(target);
      } else {
        endDrag();
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [draggedId, flat, commitDrop, endDrag]);

  const dragContext = useMemo<DragContextValue>(
    () => ({
      draggedId,
      dropTargetId,
      selectionMode,
      reparentPending,
      beginPointerDrag,
      canDropOn,
    }),
    [draggedId, dropTargetId, selectionMode, reparentPending, beginPointerDrag, canDropOn]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setShowGroupForm(false);
  };

  return (
    <DragContext.Provider value={dragContext}>
      <div className="space-y-6">
        {!selectionMode ? <AddRootForm restaurantId={restaurantId} /> : null}

        {tree.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {!selectionMode ? (
              <>
                <button
                  type="button"
                  className={uiBtnOutlineSm}
                  onClick={() => setSelectionMode(true)}
                >
                  Regrouper des rubriques
                </button>
                <span className={`text-xs ${uiLead}`}>
                  Glissez la poignée ⋮⋮ sur une autre rubrique pour la rattacher, ou sur la zone
                  « Rubriques principales » pour la remonter. Les sous-rubriques ont aussi un bouton
                  Remonter.
                </span>
              </>
            ) : (
              <>
                <span className="text-sm text-stone-600">
                  {selectedCount} sélectionnée{selectedCount > 1 ? "s" : ""}
                  {topLevelCount !== selectedCount && topLevelCount > 0
                    ? ` (${topLevelCount} seront déplacées)`
                    : null}
                </span>
                <button
                  type="button"
                  className={uiBtnPrimarySm}
                  disabled={selectedCount < 2 || showGroupForm}
                  onClick={() => setShowGroupForm(true)}
                >
                  Regrouper…
                </button>
                <button type="button" className={uiBtnOutlineSm} onClick={exitSelection}>
                  Annuler
                </button>
              </>
            )}
          </div>
        ) : null}

        {showGroupForm && selectedCount >= 2 ? (
          <GroupForm
            restaurantId={restaurantId}
            flat={flat}
            selectedIds={[...selectedIds]}
            onDone={() => setShowGroupForm(false)}
            onSuccess={exitSelection}
          />
        ) : null}

        {!selectionMode && draggedId ? (
          <div className="sticky top-0 z-10 -mx-1 bg-white/95 px-1 py-2 backdrop-blur-sm">
            <RootDropZone />
          </div>
        ) : null}

        {pointerPreview ? <PointerDragPreview preview={pointerPreview} /> : null}

        {tree.length === 0 ? (
          <p className={uiLead}>Aucune rubrique pour l’instant. Créez-en une ci-dessus.</p>
        ) : (
          <ul className={`space-y-0 ${draggedId ? "select-none" : ""}`}>
            {tree.map((n) => (
              <CategoryRow
                key={n.id}
                node={n}
                depth={0}
                restaurantId={restaurantId}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
            ))}
          </ul>
        )}
      </div>
    </DragContext.Provider>
  );
}
