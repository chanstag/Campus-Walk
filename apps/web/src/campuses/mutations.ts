import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc";

/** District and campus writes change the campus pickers, every cached tree header and the office cards. */
function useInvalidation() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries(trpc.district.pathFilter()),
      qc.invalidateQueries(trpc.campus.pathFilter()),
      qc.invalidateQueries(trpc.office.pathFilter()),
    ]);
}

export function useCreateDistrict() {
  const trpc = useTRPC();
  const invalidate = useInvalidation();
  return useMutation(trpc.district.create.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useUpdateDistrict() {
  const trpc = useTRPC();
  const invalidate = useInvalidation();
  return useMutation(trpc.district.update.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useCreateCampus() {
  const trpc = useTRPC();
  const invalidate = useInvalidation();
  return useMutation(trpc.campus.create.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useUpdateCampus() {
  const trpc = useTRPC();
  const invalidate = useInvalidation();
  return useMutation(trpc.campus.update.mutationOptions({ onSuccess: () => invalidate() }));
}
