"use client"

import { useState } from "react"
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

const serviceSchema = z.object({
  name: z.string().min(1, "Hizmet adı gerekli"),
  description: z.string().optional(),
  duration: z.string().min(1, "Süre gerekli"),
  price: z.string().min(1, "Fiyat gerekli"),
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
    duration?: number
    price?: number
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
      duration: initialData?.duration?.toString() || "60",
      price: initialData?.price?.toString() || "",
      categoryId: initialData?.categoryId || "",
    },
  })

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
          duration: parseInt(data.duration),
          price: parseFloat(data.price),
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
                    <Input placeholder="Örn: Klasik Masaj" {...field} />
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Süre (dakika)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Süre seçin" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="30">30 dakika</SelectItem>
                        <SelectItem value="45">45 dakika</SelectItem>
                        <SelectItem value="60">60 dakika</SelectItem>
                        <SelectItem value="90">90 dakika</SelectItem>
                        <SelectItem value="120">120 dakika</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fiyat (₺)</FormLabel>
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
            </div>

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
