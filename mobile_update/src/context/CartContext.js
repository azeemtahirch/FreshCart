import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../services/api";

const C = createContext();

const CART_KEY = "freshcart_cart_v3";

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [shippingInfo, setShippingInfo] = useState(null);

  // Load cart
  useEffect(() => {
    AsyncStorage.getItem(CART_KEY)
      .then((x) => {
        if (!x) return;

        try {
          const savedItems = JSON.parse(x);

          if (!Array.isArray(savedItems)) {
            setItems([]);
            return;
          }

          const normalized = savedItems
            .map((item) => {
              const unitType = item.unit_type;

              let size = Number(item.size_ml || 0);

              // Dozen products always use 1 as the size.
              // Quantity represents how many dozens are ordered.
              if (unitType === "dozen") {
                size = 1;
              }

              let label = item.size_label;

              if (unitType === "dozen") {
                label = "1 dozen";
              } else if (!label) {
                if (unitType === "kg") {
                  label = size >= 1000 ? `${size / 1000} kg` : `${size} g`;
                } else if (unitType === "liter") {
                  label = size >= 1000 ? `${size / 1000} L` : `${size} ml`;
                } else {
                  label = String(size);
                }
              }

              return {
                ...item,
                product_id: Number(item.product_id),
                base_price: Number(item.base_price || 0),
                size_ml: size,
                size_label: label,
                quantity: Number(item.quantity || 0),
              };
            })
            .filter(
              (item) =>
                item.product_id > 0 && item.size_ml > 0 && item.quantity > 0,
            );

          setItems(normalized);
        } catch (e) {
          console.log("Could not load saved cart:", e);
          setItems([]);
        }
      })
      .catch((e) => {
        console.log("Could not load cart:", e);
      });
  }, []);

  // Save cart
  useEffect(() => {
    AsyncStorage.setItem(CART_KEY, JSON.stringify(items)).catch((e) => {
      console.log("Could not save cart:", e);
    });
  }, [items]);

  // Create correct label
  const makeSizeLabel = useCallback((product, numericSize, sizeLabel) => {
    // DOZEN
    if (product.unit_type === "dozen") {
      return "1 dozen";
    }

    if (sizeLabel && String(sizeLabel).trim()) {
      return String(sizeLabel).trim();
    }

    // KG
    if (product.unit_type === "kg") {
      if (numericSize >= 1000) {
        return `${numericSize / 1000} kg`;
      }

      return `${numericSize} g`;
    }

    // LITER
    if (product.unit_type === "liter") {
      if (numericSize >= 1000) {
        return `${numericSize / 1000} L`;
      }

      return `${numericSize} ml`;
    }

    return String(numericSize);
  }, []);

  // Add product to cart
  const add = useCallback(
    (p, size, sizeLabel = null) => {
      const productId = Number(p.id);

      // IMPORTANT:
      // Dozen products always use size = 1.
      let numericSize = p.unit_type === "dozen" ? 1 : Number(size);

      if (!productId || productId <= 0) {
        console.error("Invalid product ID:", p.id);
        return;
      }

      if (!numericSize || numericSize <= 0) {
        console.error("Invalid product size:", {
          productId: p.id,
          size,
          sizeLabel,
          unitType: p.unit_type,
        });
        return;
      }

      const finalLabel = makeSizeLabel(p, numericSize, sizeLabel);

      setItems((currentItems) => {
        const index = currentItems.findIndex(
          (item) =>
            Number(item.product_id) === productId &&
            Number(item.size_ml) === numericSize,
        );

        // New item
        if (index < 0) {
          return [
            ...currentItems,
            {
              product_id: productId,
              name: p.name,
              image_url: p.image_url,
              unit_type: p.unit_type,
              base_price: Number(p.base_price || 0),

              // KG / Liter = grams/ml
              // Dozen = always 1
              size_ml: numericSize,

              size_label: finalLabel,

              quantity: 1,
            },
          ];
        }

        // Existing item -> increase quantity
        return currentItems.map((item, i) =>
          i === index
            ? {
                ...item,
                quantity: Number(item.quantity || 0) + 1,
              }
            : item,
        );
      });
    },
    [makeSizeLabel],
  );

  // Change quantity
  const change = useCallback((pid, size, d) => {
    const productId = Number(pid);
    const numericSize = Number(size);
    const delta = Number(d);

    setItems((currentItems) =>
      currentItems
        .map((item) => {
          if (
            Number(item.product_id) === productId &&
            Number(item.size_ml) === numericSize
          ) {
            return {
              ...item,
              quantity: Math.max(0, Number(item.quantity || 0) + delta),
            };
          }

          return item;
        })
        .filter((item) => Number(item.quantity) > 0),
    );
  }, []);

  // Remove item
  const remove = useCallback((pid, size) => {
    const productId = Number(pid);
    const numericSize = Number(size);

    setItems((currentItems) =>
      currentItems.filter(
        (item) =>
          !(
            Number(item.product_id) === productId &&
            Number(item.size_ml) === numericSize
          ),
      ),
    );
  }, []);

  // Clear cart
  const clear = useCallback(() => {
    setItems([]);
  }, []);

  // Calculate item price
  const getItemPrice = useCallback((item) => {
    const basePrice = Number(item.base_price || 0);

    const size = Number(item.size_ml || 0);

    // Dozen:
    // base_price = price for one dozen
    if (item.unit_type === "dozen") {
      return basePrice;
    }

    // KG / Liter
    return (basePrice * size) / 1000;
  }, []);

  // Calculate subtotal
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const price = getItemPrice(item);
      const quantity = Number(item.quantity || 0);

      return sum + price * quantity;
    }, 0);
  }, [items, getItemPrice]);

  // Refresh shipping
  const refreshShipping = useCallback(async () => {
    const r = await api.get("/prices/today", {
      params: {
        subtotal,
      },
    });

    setShippingInfo(r.data);

    return r.data;
  }, [subtotal]);

  // Automatically refresh shipping
  useEffect(() => {
    let live = true;

    api
      .get("/prices/today", {
        params: {
          subtotal,
        },
      })
      .then((r) => {
        if (live) {
          setShippingInfo(r.data);
        }
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [subtotal]);

  const shipping = Number(shippingInfo?.shipping ?? 0);

  const total = subtotal + shipping;

  return (
    <C.Provider
      value={{
        items,

        add,
        change,
        remove,
        clear,

        subtotal,
        shipping,
        total,

        shippingInfo,
        refreshShipping,

        getItemPrice,
      }}
    >
      {children}
    </C.Provider>
  );
}

export const useCart = () => useContext(C);
