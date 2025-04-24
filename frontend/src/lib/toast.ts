/**
 * Convenience hook so feature files never need to think about where
 * our toast implementation lives.
 */
import { useToast as useToastCtx } from "@/providers/toast-provider";

export const useToast = useToastCtx;
