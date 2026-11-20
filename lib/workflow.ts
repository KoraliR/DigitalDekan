import type { RequestStatus } from "@prisma/client";
export const transitions: Record<RequestStatus, RequestStatus[]> = {
  NEW: ["PROCESSING", "READY", "REJECTED"],
  PROCESSING: ["READY", "REJECTED"],
  READY: ["PROCESSING"],
  REJECTED: ["PROCESSING"],
  CANCELLED: [],
};