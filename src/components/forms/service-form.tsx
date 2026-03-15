"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useEffect } from "react"

const serviceSchema = z.object({
  name: z.string().min(1, "Hizmet adı gerekli"),
  description: z.string().optional(),
  price: z.string().min(1, "Fiyat gerekli"),
  currency: z.string().min(1, "Para birimi gerekli"),
  categoryId: z.string().optional(),
})

type ServiceFormData = z.infer<typeof serviceSchema>

interface ServiceFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: {
    id?: string
    name?: string
    description?: string
    price?: number
    currency?: string
    categoryId?: string
  }
  categories?: { id: string; name: string }[]
}

export function ServiceForm({
  open,
  onOpenChange,
  initialData,
  categories,
}: ServiceFormProps) {
  const queryClient = useQueryClient()
  const isEditing = !!initialData?.id

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      price: initialData?.price?.toString() || "",
      currency: initialData?.currency || "EUR",
      categoryId: initialData?.categoryId || "",
    },
  })

  // Reset form when initialData changes (edit mode)
  useEffect(() => {
    if (open) {
      form.reset({
        name: initialData?.name || "",
        description: initialData?.description || "",
        price: initialData?.price?.toString() || "",
        currency: initialData?.currency || "EUR",
        categoryId: initialData?.categoryId || "",
      })
    }
  }, [open, initialData, form])

  const mutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const url = isEditing
        ? `/api/services/${initialData.id}`
        : "/api/services"
      const method = isEditing ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          price: parseFloat(data.price),
          currency: data.currency,
          categoryId: data.categoryId || null,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "İşlem başarısız")
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] })
      toast.success(isEditing ? "Hizmet güncellendi" : "Hizmet oluşturuldu")
      onOpenChange(false)
      form.reset()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const onSubmit = (data: ServiceFormData) => {
    mutation.mutate(data)
  }

  const currencies = [
    { value: "EUR", symbol: "€", label: "Euro", bg: "bg-blue-600", ring: "ring-blue-300" },
    { value: "USD", symbol: "$", label: "Dolar", bg: "bg-emerald-600", ring: "ring-emerald-300" },
    { value: "GBP", symbol: "£", label: "Sterlin", bg: "bg-purple-600", ring: "ring-purple-300" },
    { value: "TRY", symbol: "₺", label: "TL", bg: "bg-orange-500", ring: "ring-orange-300" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Hizmeti Düzenle" : "Yeni Hizmet"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hizmet Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Örn: Klasik Paket" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Açıklama</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Hizmet açıklaması..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fiyat</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Para Birimi */}
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Para Birimi</FormLabel>
                  <div className="flex gap-2">
                    {currencies.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        className={cn(
                          "flex-1 h-10 text-sm font-bold rounded-md transition-all border",
                          field.value === c.value
                            ? `${c.bg} text-white shadow-lg ring-2 ${c.ring}`
                            : "bg-white text-gray-600 border-gray-200 shadow-sm hover:bg-gray-50"
                        )}
                        onClick={() => field.onChange(c.value)}
                      >
                        {c.symbol} {c.value}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {categories && categories.length > 0 && (
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Kategori seçin (opsiyonel)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                İptal
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
