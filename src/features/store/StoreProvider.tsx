import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useUser } from "../auth/AuthProvider";
import { watchMember, watchMemberships, watchStore } from "../../data/stores";
import type { Member, Membership, Store } from "../../data/types";
import { storage } from "../../lib/feedback";

const CURRENT_KEY = "dnz.store";

interface StoreState {
  /** Marketler listesi yüklendi mi? */
  loaded: boolean;
  memberships: Membership[];
  store: Store | null;
  member: Member | null;
  canEdit: boolean;
  isOwner: boolean;
  selectStore: (id: string) => void;
}

const Ctx = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const [loaded, setLoaded] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(() => storage.get(CURRENT_KEY));
  const [store, setStore] = useState<Store | null>(null);
  const [member, setMember] = useState<Member | null>(null);

  const selectStore = useCallback((id: string) => {
    storage.set(CURRENT_KEY, id);
    setCurrentId(id);
  }, []);

  useEffect(
    () =>
      watchMemberships(
        user.uid,
        (list, fromCache) => {
          setMemberships(list);
          // Önbellek boşken sunucu cevabını bekle (yoksa "market yok" ekranı yanıp söner).
          if (!fromCache || list.length > 0 || !navigator.onLine) setLoaded(true);
        },
        () => setLoaded(true),
      ),
    [user.uid],
  );

  // Seçili market artık listede yoksa ilkine geç.
  const activeId =
    currentId && memberships.some((m) => m.storeId === currentId)
      ? currentId
      : memberships[0]?.storeId ?? null;

  useEffect(() => {
    if (activeId && activeId !== currentId) selectStore(activeId);
  }, [activeId, currentId, selectStore]);

  useEffect(() => {
    if (!activeId) {
      setStore(null);
      setMember(null);
      return;
    }
    const u1 = watchStore(activeId, setStore, () => {});
    const u2 = watchMember(activeId, user.uid, setMember, () => {});
    return () => {
      u1();
      u2();
    };
  }, [activeId, user.uid]);

  const value: StoreState = {
    loaded,
    memberships,
    store: store && store.id === activeId ? store : null,
    member,
    canEdit: !!member?.canEditPrice,
    isOwner: member?.role === "owner",
    selectStore,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore StoreProvider dışında");
  return v;
}

/** Market seçili ekranlarda kullanılır. */
export function useActiveStore() {
  const v = useStore();
  if (!v.store) throw new Error("Market seçili değil");
  return { ...v, store: v.store };
}
