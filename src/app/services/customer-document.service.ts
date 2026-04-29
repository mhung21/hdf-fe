import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { BASE_PATH } from '../api/variables';

export interface CustomerDocument {
  documentId: string;
  customerId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  note?: string | null;
  uploadedAt?: string | null;
}

export const CUSTOMER_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  ID_FRONT: 'CCCD / CMND mặt trước',
  ID_BACK:  'CCCD / CMND mặt sau',
};

@Injectable({ providedIn: 'root' })
export class CustomerDocumentService {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH, { optional: true }) ?? 'http://localhost';

  /** Lấy danh sách ảnh CCCD theo khách hàng. Chỉ Admin/Manager mới được gọi. */
  getByCustomer(customerId: string): Observable<any> {
    return this.http.post<any>(
      `${this.basePath}/api/CustomerDocument/GetByCustomer`,
      JSON.stringify(customerId),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  /** Upload ảnh CCCD cho khách hàng. */
  upload(customerId: string, file: File, documentType: string, note?: string): Observable<any> {
    const form = new FormData();
    form.append('customerId', customerId);
    form.append('file', file);
    form.append('documentType', documentType);
    if (note) form.append('note', note);
    return this.http.post<any>(`${this.basePath}/api/CustomerDocument/Upload`, form);
  }

  /**
   * Fetch binary của ảnh qua HttpClient (có kèm Authorization header từ interceptor).
   * Trả về Blob URL dùng làm [src] cho <img>.
   * Nhớ gọi URL.revokeObjectURL() khi component destroy để tránh memory leak.
   */
  fetchBlobUrl(documentId: string): Observable<string> {
    return this.http
      .get(`${this.basePath}/api/CustomerDocument/View/${documentId}`, { responseType: 'blob' })
      .pipe(map((blob) => URL.createObjectURL(blob)));
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
