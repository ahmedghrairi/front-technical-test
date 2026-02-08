import { Component, OnInit, ChangeDetectionStrategy, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileManagerService } from '../../services/file-manager.service';
import { Item } from '../../models/item.model';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalComponent } from '../modal/modal.component';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-file-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './file-manager.component.html',
  styleUrl: './file-manager.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileManagerComponent implements OnInit {
  private fileService = inject(FileManagerService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private queryParams = toSignal(this.route.queryParams);
  
  currentParentId = computed(() => this.queryParams()?.['folderId'] || null);
  
  items = signal<Item[]>([]);
  isLoading = signal(false);
  breadcrumb = signal<Item[]>([]);
  currentFolderName = signal('Root');
  isDragging = signal(false);
  isModalOpen = signal(false);
  modalType = signal<'create' | 'rename' | 'delete' | 'move' | null>(null);
  modalTitle = signal('');
  modalInputValue = signal('');
  modalConfirmLabel = signal('Confirm');
  selectedItem = signal<Item | null>(null);
  moveFolderItems = signal<Item[]>([]);
  currentMoveParentId = signal<string | null>(null);
  moveBreadcrumb = signal<Item[]>([]);

  constructor() {
    effect(() => {
        this.loadItems(this.currentParentId() || undefined);
        this.loadBreadcrumb();
    });
  }

  ngOnInit(): void {}

  loadItems(parentId?: string): void {
    this.isLoading.set(true);
    this.fileService.getItems(parentId).subscribe({
      next: (response) => {
        let filteredItems = response.items;
        if (parentId) {
             filteredItems = filteredItems.filter(item => item.parentId === parentId);
        } else {
             filteredItems = filteredItems.filter(item => !item.parentId);
        }

        const sortedItems = filteredItems.sort((a, b) => {
          if (a.folder === b.folder) {
            return a.name.localeCompare(b.name);
          }
          return a.folder ? -1 : 1;
        });
        
        this.items.set(sortedItems);
        this.isLoading.set(false);
        if (!parentId) this.currentFolderName.set('Root');
      },
      error: (err) => {
        console.error('Error loading items', err);
        this.isLoading.set(false);
      }
    });
  }

  loadBreadcrumb(): void {
    const parentId = this.currentParentId();
    if (!parentId) {
      this.breadcrumb.set([]);
      this.currentFolderName.set('Root');
      return;
    }
    this.fileService.getItemPath(parentId).subscribe({
      next: (resp) => {
        this.breadcrumb.set(resp.items);
        const current = resp.items.find(b => b.id === parentId);
        if (current) this.currentFolderName.set(current.name);
        else if (resp.items.length > 0) this.currentFolderName.set(resp.items[resp.items.length - 1].name);
      },
      error: () => {
        this.breadcrumb.set([]);
        this.currentFolderName.set('Unknown');
      }
    });
  }

  onFileSelected(event: any): void {
    const files: FileList = event.target.files;
    if (files && files.length > 0) {
      this.uploadFiles(Array.from(files));
      event.target.value = '';
    }
  }

  uploadFiles(files: File[]): void {
    this.isLoading.set(true);
    this.fileService.uploadFiles(files, this.currentParentId() || undefined).subscribe({
      next: (response) => {
        this.loadItems(this.currentParentId() || undefined);
        if (response.code === 'PARTIAL_SUCCESS') {
            const failedCount = response.failed.length;
            const successCount = response.successful.length;
            alert(`${successCount} files uploaded, ${failedCount} failed.`);
        }
      },
      error: (err) => {
        console.error('Error uploading files', err);
        this.isLoading.set(false);
        
        if (err.error?.errors && Array.isArray(err.error.errors) && err.error.errors.length > 0) {
            const errors = err.error.errors;
            const errorMessages = errors.map((e: any) => `${e.filename}: ${e.message || e.error}`).join('\n');
            alert(`Upload failed:\n${errorMessages}`);
        } else if (err.error && err.error.desc) {
            alert(`Error: ${err.error.desc}`);
        } else {
            alert('Error uploading files');
        }
      }
    });
  }


  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.uploadFiles(Array.from(files));
    }
  }


  openCreateFolderModal() {
    this.modalType.set('create');
    this.modalTitle.set('Create New Folder');
    this.modalInputValue.set('New Folder');
    this.modalConfirmLabel.set('Create');
    this.isModalOpen.set(true);
  }

  openRenameModal(item: Item) {
    this.selectedItem.set(item);
    this.modalType.set('rename');
    this.modalTitle.set(item.folder ? 'Rename Folder' : 'Rename File');
    this.modalInputValue.set(item.name);
    this.modalConfirmLabel.set('Save');
    this.isModalOpen.set(true);
  }

  openDeleteModal(item: Item) {
    this.selectedItem.set(item);
    this.modalType.set('delete');
    this.modalTitle.set(item.folder ? 'Delete Folder' : 'Delete File');
    this.modalConfirmLabel.set('Delete');
    this.isModalOpen.set(true);
  }

  onModalConfirm() {
    const type = this.modalType();
    const item = this.selectedItem();
    const value = this.modalInputValue();

    if (type === 'create') {
      this.createFolder(value);
    } else if (type === 'rename' && item) {
      this.renameItem(item, value);
    } else if (type === 'delete' && item) {
      this.deleteItem(item);
    } else if (type === 'move' && item) {
        this.confirmMove();
    }
    this.isModalOpen.set(false);
  }

  onModalCancel() {
    this.isModalOpen.set(false);
    this.selectedItem.set(null);
    this.modalType.set(null);
  }


  createFolder(name: string): void {
      if (!name) return;
      this.isLoading.set(true);
      this.fileService.createFolder(name, this.currentParentId() || undefined).subscribe({
          next: () => {
              this.loadItems(this.currentParentId() || undefined);
          },
          error: (err) => {
              console.error('Error creating folder', err);
              this.isLoading.set(false);
              
              if (err.error && err.error.desc) {
                  alert(err.error.desc);
              } else {
                  alert('Could not create folder');
              }
          }
      });
  }

  renameItem(item: Item, newName: string): void {
      if (!newName || newName === item.name) return;
      this.isLoading.set(true);
      this.fileService.renameItem(item.id, newName).subscribe({
          next: () => {
              this.loadItems(this.currentParentId() || undefined);
          },
          error: (err) => {
              console.error('Error renaming item', err);
              this.isLoading.set(false);
              if (err.error && err.error.desc) {
                  alert(err.error.desc);
              } else {
                  alert('Could not rename item');
              }
          }
      });
  }

  deleteItem(item: Item): void {
    this.isLoading.set(true);
    this.fileService.deleteItem(item.id).subscribe({
      next: () => {
        this.loadItems(this.currentParentId() || undefined);
      },
      error: (err) => {
        console.error('Error deleting item', err);
        this.isLoading.set(false);
        if (err.error && err.error.desc) {
            alert(err.error.desc);
        } else {
            alert('Could not delete item');
        }
      }
    });
  }

 

  openMoveModal(item: Item) {
      this.selectedItem.set(item);
      this.modalType.set('move');
      this.modalTitle.set(`Move ${item.name} to...`);
      this.modalConfirmLabel.set('Move Here');
      this.currentMoveParentId.set(null);
      this.loadMoveItems(null);
      this.isModalOpen.set(true);
  }

  loadMoveItems(parentId: string | null): void {
      this.fileService.getItems(parentId || undefined).subscribe({
          next: (resp) => {
              let folders = resp.items.filter(i => i.folder && i.id !== this.selectedItem()?.id);
              if (parentId) {
                  folders = folders.filter(i => i.parentId === parentId);
              } else {
                  folders = folders.filter(i => !i.parentId);
              }

              this.moveFolderItems.set(folders);
              this.updateMoveBreadcrumb(parentId);
          },
          error: (err) => {
              console.error('Error loading move folders', err);
          }
      });
  }

  navigateMoveFolder(folderId: string | null): void {
      this.currentMoveParentId.set(folderId);
      this.loadMoveItems(folderId);
  }

  updateMoveBreadcrumb(parentId: string | null) {
      if (!parentId) {
          this.moveBreadcrumb.set([]);
          return;
      }
      this.fileService.getItemPath(parentId).subscribe({
          next: (resp) => {
              this.moveBreadcrumb.set(resp.items);
          }
      });
  }

  confirmMove() {
      const item = this.selectedItem();
      const destId = this.currentMoveParentId();
      if (!item) return;
      if (destId === item.parentId) {
          this.isModalOpen.set(false);
          return;
      }
      
      this.isLoading.set(true);
      this.fileService.moveItem(item.id, destId).subscribe({
          next: () => {
              this.loadItems(this.currentParentId() || undefined);
          },
          error: (err) => {
              console.error('Error moving item', err);
              this.isLoading.set(false);
              if (err.error && err.error.desc) {
                  alert(err.error.desc);
              } else {
                  alert('Could not move item');
              }
          }
      });
  }

  downloadItem(item: Item): void {
    if (item.folder) {
        this.navigateToFolder(item.id);
        return;
    }
    const downloadUrl = `/api/items/${item.id}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  navigateToFolder(folderId: string | null): void {
      this.router.navigate([], {
          queryParams: { folderId: folderId }
      });
  }
}