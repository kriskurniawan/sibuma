export interface PageRequest {
  pageIndex: number;
  pageSize: number;
}

export function pageRequest(page?: string, size?: string): PageRequest {
  const pageNumber = Number(page);
  const pageSize = Number(size);
  return {
    pageIndex: Number.isSafeInteger(pageNumber) ? Math.max(0, Math.min(pageNumber - 1, 1_000_000)) : 0,
    pageSize: [10, 25, 50, 100].includes(pageSize) ? pageSize : 10,
  };
}

export function clampPage(request: PageRequest, total: number): PageRequest {
  return { ...request, pageIndex: Math.min(request.pageIndex, Math.max(0, Math.ceil(total / request.pageSize) - 1)) };
}
