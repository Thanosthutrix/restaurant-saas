"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createRestaurantCategory,
  deleteRestaurantCategory,
  renameRestaurantCategory,
  updateRestaurantCategoryAppliesTo,
} from "./actions";
import type { CategoryAppliesTo, CategoryTreeNode } from "@/lib/catalog/restaurantCategories";
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

const APPLIES_LABEL: Record<CategoryAppliesTo, string> = {
  dish: "Carte seulement",
  inventory: "Stock seulement",
  both: "Carte et stock",
};

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
    <form onSubmit={submit} className={`mt-2 flex flex-wrap items-end gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3`}>
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

function CategoryRow({
  node,
  depth,
  restaurantId,
}: {
  node: CategoryTreeNode;
  depth: number;
  restaurantId: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rename, setRename] = useState(node.name);
  const [pending, startTransition] = useTransition();

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
    <li className="list-none">
      <div
        className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-2"
        style={{ paddingLeft: depth * 16 }}
      >
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
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-inner ring-1 ring-indigo-100/90">
              <CategoryPictogram title={node.name} depth={depth} />
            </span>
            <span className="min-w-0 flex-1 font-medium text-slate-900">{node.name}</span>
            <AppliesSelect categoryId={node.id} restaurantId={restaurantId} value={node.applies_to} />
            <button type="button" className={uiBtnOutlineSm} onClick={() => setEditing(true)}>
              Renommer
            </button>
            <button type="button" className={uiBtnOutlineSm} onClick={() => setAdding((a) => !a)}>
              {adding ? "Fermer" : "Sous-rubrique"}
            </button>
            <button type="button" className={uiBtnOutlineSm} disabled={pending} onClick={handleDelete}>
              Supprimer
            </button>
          </>
        )}
      </div>
      {adding ? (
        <div style={{ paddingLeft: (depth + 1) * 16 }}>
          <AddChildForm restaurantId={restaurantId} parentId={node.id} onDone={() => setAdding(false)} />
        </div>
      ) : null}
      {node.children.length > 0 ? (
        <ul className="border-l border-slate-100">
          {node.children.map((ch) => (
            <CategoryRow key={ch.id} node={ch} depth={depth + 1} restaurantId={restaurantId} />
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
      <h2 className="mb-2 text-sm font-semibold text-slate-900">Nouvelle rubrique racine</h2>
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
}: {
  restaurantId: string;
  tree: CategoryTreeNode[];
}) {
  return (
    <div className="space-y-6">
      <AddRootForm restaurantId={restaurantId} />
      {tree.length === 0 ? (
        <p className={uiLead}>Aucune rubrique pour l’instant. Créez-en une ci-dessus.</p>
      ) : (
        <ul className="space-y-0">
          {tree.map((n) => (
            <CategoryRow key={n.id} node={n} depth={0} restaurantId={restaurantId} />
          ))}
        </ul>
      )}
    </div>
  );
}
