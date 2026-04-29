import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { BASE_PATH } from '../api/variables';

export interface LoanContractDocument {
  documentId: string;
  loanContractId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  note?: string | null;
  uploadedAt?: string | null;
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  ID_FRONT:         'CCCD / CMND mặt trước',
  ID_BACK:          'CCCD / CMND mặt sau',
  COLLATERAL_PHOTO: 'Ảnh tài sản đảm bảo',
  CONTRACT:         'Hợp đồng / Phụ lục',
  OTHER:            'Khác',
};

export const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS);

@Injectable({ providedIn: 'root' })
export class LoanContractDocumentService {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH, { optional: true }) ?? 'http://localhost';

  getByLoanContract(loanContractId: string): Observable<any> {
    return this.http.post<any>(
      `${this.basePath}/api/LoanContractDocument/GetByLoanContract`,
      JSON.stringify(loanContractId),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  upload(loanContractId: string, file: File, documentType: string, note?: string): Observable<any> {
    const form = new FormData();
    form.append('loanContractId', loanContractId);
    form.append('file', file);
    form.append('documentType', documentType);
    if (note) form.append('note', note);
    return this.http.post<any>(`${this.basePath}/api/LoanContractDocument/Upload`, form);
  }

  delete(documentId: string): Observable<any> {
    return this.http.post<any>(
      `${this.basePath}/api/LoanContractDocument/Delete`,
      JSON.stringify(documentId),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  /**
   * Fetch binary của file qua HttpClient (có kèm Authorization header từ interceptor).
   * Trả về Blob URL dùng làm [src] cho <img> hoặc <iframe>.
   * Nhớ gọi URL.revokeObjectURL() khi component destroy để tránh memory leak.
   */
  fetchBlobUrl(documentId: string): Observable<string> {
    return this.http
      .get(`${this.basePath}/api/LoanContractDocument/View/${documentId}`, { responseType: 'blob' })
      .pipe(map((blob) => URL.createObjectURL(blob)));
  }

  /**
   * Tải file về máy qua HttpClient (có kèm Authorization header).
   * Tự động trigger save-dialog của browser.
   */
  downloadFile(documentId: string, fileName: string): Observable<void> {
    return this.http
      .get(`${this.basePath}/api/LoanContractDocument/Download/${documentId}`, { responseType: 'blob' })
      .pipe(
        map((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        }),
      );
  }

  /** @deprecated Dùng fetchBlobUrl() thay thế — URL trực tiếp sẽ bị 401 vì browser không gắn token. */
  getViewUrl(documentId: string): string {
    return `${this.basePath}/api/LoanContractDocument/View/${documentId}`;
  }

  /** @deprecated Dùng downloadFile() thay thế — URL trực tiếp sẽ bị 401 vì browser không gắn token. */
  getDownloadUrl(documentId: string): string {
    return `${this.basePath}/api/LoanContractDocument/Download/${documentId}`;
  }

  isImage(contentType: string): boolean {
    return contentType.startsWith('image/');
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
