"use client"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
export function CreateLadderSubmit({ children, variant = "moss" }: { children: React.ReactNode; variant?: "moss" | "ink" }) { const { pending } = useFormStatus(); return <Button type="submit" variant={variant} disabled={pending}>{pending ? "Creating…" : children}</Button> }
