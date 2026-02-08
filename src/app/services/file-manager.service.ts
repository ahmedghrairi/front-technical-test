import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Item } from '../models/item.model';

@Injectable({
  providedIn: 'root'
})
export class FileManagerService {
  private apiUrl = '/api/items';

  constructor(private http: HttpClient) { }

  getItems(parentId?: string): Observable<{ items: Item[] }> {
    const params: any = {};
    if (parentId) {
      params.parentId = parentId;
    }
    return this.http.get<{ items: Item[] }>(this.apiUrl, { params });
  }

  uploadFiles(files: File[], parentId?: string): Observable<any> {
    const formData = new FormData();
    if (parentId) {
      formData.append('parentId', parentId);
    }
    files.forEach(file => {
      formData.append('files', file);
    });
    return this.http.post<any>(this.apiUrl, formData);
  }

  createFolder(name: string, parentId?: string): Observable<Item> {
    const body: any = { name, folder: true };
    
    if (parentId) {
        body.parentId = parentId;
    }
    return this.http.post<Item>(this.apiUrl, body);
  }

  renameItem(itemId: string, newName: string): Observable<Item> {
    return this.http.patch<Item>(`${this.apiUrl}/${itemId}`, { name: newName });
  }

  deleteItem(itemId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${itemId}`);
  }

  getItemPath(itemId: string): Observable<{ items: Item[] }> {
      return this.http.get<{ items: Item[] }>(`${this.apiUrl}/${itemId}/path`);
  }

  moveItem(itemId: string, destinationParentId: string | null): Observable<Item> {
      return this.http.patch<Item>(`${this.apiUrl}/${itemId}`, { parentId: destinationParentId });
  }
}
