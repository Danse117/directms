import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CartItem = {
  productId: string;
  productName: string;
  flavor: string;
  quantity: number;
  unitPrice: number;
};

type CartState = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, flavor: string) => void;
  updateQuantity: (
    productId: string,
    flavor: string,
    quantity: number
  ) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === item.productId && i.flavor === item.flavor
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId && i.flavor === item.flavor
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            };
          }
          return { items: [...state.items, item] };
        }),
      removeItem: (productId, flavor) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.flavor === flavor)
          ),
        })),
      updateQuantity: (productId, flavor, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter(
                  (i) =>
                    !(i.productId === productId && i.flavor === flavor)
                )
              : state.items.map((i) =>
                  i.productId === productId && i.flavor === flavor
                    ? { ...i, quantity }
                    : i
                ),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "directms-cart",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Selector hooks — use these in components instead of calling
// useCartStore((s) => s.items.reduce(...)) inline, so zustand can
// memoize properly.
export const useCartItems = () => useCartStore((s) => s.items);

export const useCartCount = () =>
  useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));

export const useCartSubtotal = () =>
  useCartStore((s) =>
    s.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  );
