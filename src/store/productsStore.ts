import { create } from 'zustand';

import { loadJson, saveJson, STORAGE_KEYS } from '@/services/storage';
import { Product } from '@/types';

interface ProductsState {
  products: Product[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  removeProduct: (id: string) => void;
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  products: [],
  hydrated: false,

  hydrate: async () => {
    const products = await loadJson<Product[]>(STORAGE_KEYS.products, []);
    set({ products, hydrated: true });
  },

  addProduct: (product) => {
    const products = [...get().products, product];
    set({ products });
    void saveJson(STORAGE_KEYS.products, products);
  },

  updateProduct: (id, patch) => {
    const products = get().products.map((p) => (p.id === id ? { ...p, ...patch } : p));
    set({ products });
    void saveJson(STORAGE_KEYS.products, products);
  },

  removeProduct: (id) => {
    const products = get().products.filter((p) => p.id !== id);
    set({ products });
    void saveJson(STORAGE_KEYS.products, products);
  },
}));
