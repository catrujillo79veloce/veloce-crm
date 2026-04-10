"use client"

import React, { useState, useEffect, useTransition } from "react"
import { Dialog, Button, Input, Select, Textarea } from "@/components/ui"
import { useToast } from "@/components/ui/Toast"
import { useI18n } from "@/lib/i18n/config"
import { PRODUCT_CATEGORIES } from "@/lib/constants"
import { createProduct, updateProduct } from "@/app/actions/products"
import type { Product, ProductCategory } from "@/lib/types"

interface ProductFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  product?: Product | null
}

export function ProductForm({
  open,
  onClose,
  onSuccess,
  product,
}: ProductFormProps) {
  const { t, locale } = useI18n()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState("")
  const [brand, setBrand] = useState("")
  const [category, setCategory] = useState<ProductCategory>("road_bike")
  const [sku, setSku] = useState("")
  const [price, setPrice] = useState("")
  const [cost, setCost] = useState("")
  const [description, setDescription] = useState("")
  const [stockQuantity, setStockQuantity] = useState("0")
  const [inStock, setInStock] = useState(true)

  const isEditing = !!product

  useEffect(() => {
    if (product) {
      setName(product.name)
      setBrand(product.brand || "")
      setCategory(product.category)
      setSku(product.sku || "")
      setPrice(product.price.toString())
      setCost(product.cost?.toString() || "")
      setDescription(product.description || "")
      setStockQuantity(product.stock_quantity.toString())
      setInStock(product.in_stock)
    } else {
      setName("")
      setBrand("")
      setCategory("road_bike")
      setSku("")
      setPrice("")
      setCost("")
      setDescription("")
      setStockQuantity("0")
      setInStock(true)
    }
  }, [product, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast(
        "error",
        locale === "es" ? "El nombre es requerido" : "Name is required"
      )
      return
    }

    if (!price || parseFloat(price) <= 0) {
      toast(
        "error",
        locale === "es" ? "El precio es requerido" : "Price is required"
      )
      return
    }

    startTransition(async () => {
      const formData = {
        name: name.trim(),
        brand: brand.trim() || null,
        category,
        sku: sku.trim() || null,
        price: parseFloat(price),
        cost: cost ? parseFloat(cost) : null,
        description: description.trim() || null,
        stock_quantity: parseInt(stockQuantity) || 0,
        in_stock: inStock,
      }

      const result = isEditing
        ? await updateProduct(product.id, formData)
        : await createProduct(formData)

      if (result.success) {
        toast(
          "success",
          isEditing
            ? locale === "es"
              ? "Producto actualizado"
              : "Product updated"
            : locale === "es"
              ? "Producto creado"
              : "Product created"
        )
        onSuccess()
      } else {
        toast("error", result.error || "Error")
      }
    })
  }

  const categoryOptions = PRODUCT_CATEGORIES.map((c) => ({
    value: c.value,
    label: c.label[locale],
  }))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? t.products.editProduct : t.products.newProduct}
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t.products.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              locale === "es"
                ? "Ej: Specialized Tarmac SL7"
                : "E.g.: Specialized Tarmac SL7"
            }
            required
          />
          <Input
            label={t.products.brand}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Specialized, Trek, etc."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t.products.category}
            options={categoryOptions}
            value={category}
            onChange={(e) => setCategory(e.target.value as ProductCategory)}
          />
          <Input
            label={t.products.sku}
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="SKU-001"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={`${t.products.price} (COP)`}
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            min="0"
            required
          />
          <Input
            label={`${t.products.cost} (COP)`}
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0"
            min="0"
          />
        </div>

        <Textarea
          label={
            locale === "es" ? "Descripcion" : "Description"
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            locale === "es"
              ? "Descripcion del producto..."
              : "Product description..."
          }
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t.products.stock}
            type="number"
            value={stockQuantity}
            onChange={(e) => setStockQuantity(e.target.value)}
            min="0"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              {t.products.inStock}
            </label>
            <label className="relative inline-flex items-center cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => setInStock(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-veloce-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-veloce-500" />
              <span className="ml-3 text-sm text-gray-600">
                {inStock
                  ? t.products.inStock
                  : t.products.outOfStock}
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
          >
            {t.common.cancel}
          </Button>
          <Button type="submit" loading={isPending}>
            {isEditing ? t.common.save : t.common.create}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
