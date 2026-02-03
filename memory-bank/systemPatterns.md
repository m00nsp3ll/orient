# Orient SPA - Sistem Desenleri

## Mimari Desenler

### 1. App Router Pattern (Next.js 16)
- Route groups `()` ile layout paylaşımı
- `(auth)` - Giriş sayfaları
- `(dashboard)` - Panel sayfaları
- API routes `route.ts` dosyalarında

### 2. Dynamic Route Parameters (Next.js 16)
```typescript
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params  // params artık Promise
}
```

### 3. React Query for Server State
```typescript
const { data, isLoading } = useQuery({
  queryKey: ["hotels"],
  queryFn: () => fetch("/api/hotels").then(res => res.json()),
})

const mutation = useMutation({
  mutationFn: (data) => fetch("/api/hotels", { method: "POST", body: JSON.stringify(data) }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hotels"] }),
})
```

### 4. Inline Edit Pattern
```tsx
{editingId === item.id ? (
  <Input value={editValue} onChange={...} />
) : (
  <span>{item.name}</span>
)}
```

### 5. Role-Based Access
```typescript
// API Route
if (!session || session.user.role !== "ADMIN") {
  return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })
}

// UI Component
const filteredNav = navigation.filter((item) =>
  item.roles.includes(session?.user.role)
)
```

### 6. Soft Delete Pattern
```typescript
await prisma.hotel.update({
  where: { id },
  data: { isActive: false },
})
```

## Naming Conventions

- Components: `PascalCase.tsx`
- Pages: `page.tsx`
- API: `route.ts`
- Database fields: `camelCase`
