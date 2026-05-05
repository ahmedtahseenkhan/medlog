export interface ApiResponse<T> {
  data: T
  meta?: {
    total?: number
    page?: number
    pageSize?: number
  }
}

export interface ApiError {
  statusCode: number
  error: string
  message: string
}

export interface PaginationQuery {
  page?: number
  pageSize?: number
}
