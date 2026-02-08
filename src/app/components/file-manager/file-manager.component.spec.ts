import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FileManagerComponent } from './file-manager.component';
import { FileManagerService } from '../../services/file-manager.service';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { Item } from '../../models/item.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';

describe('FileManagerComponent', () => {
  let component: FileManagerComponent;
  let fixture: ComponentFixture<FileManagerComponent>;
  let fileService: jasmine.SpyObj<FileManagerService>;
  let router: jasmine.SpyObj<Router>;
  let routeParamsSubject: BehaviorSubject<any>;

  const mockItems: Item[] = [
    { id: '1', name: 'Folder 1', folder: true, parentId: null, creation: '2023-01-01', modification: '2023-01-01' },
    { id: '2', name: 'File 1', folder: false, parentId: null, creation: '2023-01-02', modification: '2023-01-02', size: 1024 }
  ];

  beforeEach(async () => {
    const fileServiceSpy = jasmine.createSpyObj('FileManagerService', [
        'getItems', 'getItemPath', 'uploadFiles', 'createFolder', 'renameItem', 'deleteItem', 'moveItem'
    ]);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    routeParamsSubject = new BehaviorSubject({});

    await TestBed.configureTestingModule({
      imports: [FileManagerComponent, CommonModule, FormsModule, ModalComponent], // Import standalone component
      providers: [
        { provide: FileManagerService, useValue: fileServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { queryParams: routeParamsSubject.asObservable() } }
      ]
    }).compileComponents();

    fileService = TestBed.inject(FileManagerService) as jasmine.SpyObj<FileManagerService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    fixture = TestBed.createComponent(FileManagerComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load items on init (root)', () => {
    fileService.getItems.and.returnValue(of({ items: mockItems }));
    fileService.getItemPath.and.returnValue(of({ items: [] }));

    fixture.detectChanges();

    expect(fileService.getItems).toHaveBeenCalledWith(undefined);
    expect(component.items().length).toBe(2); 
    expect(component.currentFolderName()).toBe('Root');
  });

  it('should load items for a specific folder', () => {
    const folderId = 'folder-123';
    const folderItems: Item[] = [
        { id: '3', name: 'SubItem', folder: false, parentId: folderId, creation: '2023-01-03', modification: '2023-01-03' }
    ];
    
    fileService.getItems.and.returnValue(of({ items: folderItems }));
    fileService.getItemPath.and.returnValue(of({ items: [{ id: folderId, name: 'Target Folder', folder: true, parentId: null, creation: '', modification: '' }] }));

    routeParamsSubject.next({ folderId: folderId });
    fixture.detectChanges();

    expect(fileService.getItems).toHaveBeenCalledWith(folderId);
    expect(component.items().length).toBe(1);
    expect(component.currentFolderName()).toBe('Target Folder');
  });

  it('should create a folder', () => {
    fileService.getItems.and.returnValue(of({ items: [] }));
    fixture.detectChanges();

    const newFolder: Item = { id: 'new', name: 'New Folder', folder: true, parentId: null, creation: '', modification: '' };
    fileService.createFolder.and.returnValue(of(newFolder));
    
    component.openCreateFolderModal();
    component.modalInputValue.set('My New Folder');
    component.onModalConfirm();

    expect(fileService.createFolder).toHaveBeenCalledWith('My New Folder', undefined);
    expect(fileService.getItems).toHaveBeenCalledTimes(2);
  });

  it('should delete an item', () => {
    fileService.getItems.and.returnValue(of({ items: mockItems }));
    fixture.detectChanges();
    
    const itemToDelete = mockItems[1];
    fileService.deleteItem.and.returnValue(of(void 0));

    component.openDeleteModal(itemToDelete);
    expect(component.modalType()).toBe('delete');
    
    component.onModalConfirm();

    expect(fileService.deleteItem).toHaveBeenCalledWith(itemToDelete.id);
    expect(fileService.getItems).toHaveBeenCalledTimes(2);
  });

  it('should rename an item', () => {
    fileService.getItems.and.returnValue(of({ items: mockItems }));
    fixture.detectChanges();

    const itemToRename = mockItems[0]; 
    fileService.renameItem.and.returnValue(of({ ...itemToRename, name: 'Renamed Folder' }));

    component.openRenameModal(itemToRename);
    component.modalInputValue.set('Renamed Folder');
    component.onModalConfirm();

    expect(fileService.renameItem).toHaveBeenCalledWith(itemToRename.id, 'Renamed Folder');
    expect(fileService.getItems).toHaveBeenCalledTimes(2);
  });

  it('should navigate to folder on click', () => {
    fileService.getItems.and.returnValue(of({ items: mockItems }));
    fixture.detectChanges();

    component.navigateToFolder('folder-1');
    
    expect(router.navigate).toHaveBeenCalledWith([], { queryParams: { folderId: 'folder-1' } });
  });

  it('should move an item', () => {
    fileService.getItems.and.returnValue(of({ items: mockItems }));
    fixture.detectChanges();

    const itemToMove = mockItems[1];
    const targetFolderId = 'target-folder-id';
    
    fileService.getItems.and.returnValue(of({ items: [{ id: targetFolderId, name: 'Target', folder: true, parentId: null, creation: '', modification: '' }] }));
    fileService.moveItem.and.returnValue(of({ ...itemToMove, parentId: targetFolderId }));

    component.openMoveModal(itemToMove);
    
    component.currentMoveParentId.set(targetFolderId);
    component.onModalConfirm();

    expect(fileService.moveItem).toHaveBeenCalledWith(itemToMove.id, targetFolderId);
    expect(fileService.getItems).toHaveBeenCalled(); 
  });

  it('should upload multiple files', () => {
    fileService.getItems.and.returnValue(of({ items: mockItems }));
    fixture.detectChanges();

    const file1 = new File(['content1'], 'test1.txt', { type: 'text/plain' });
    const file2 = new File(['content2'], 'test2.txt', { type: 'text/plain' });
    const event = { target: { files: [file1, file2], value: 'somepath' } };

    fileService.uploadFiles.and.returnValue(of({ items: [mockItems[1]] }));

    component.onFileSelected(event);

    expect(fileService.uploadFiles).toHaveBeenCalledWith([file1, file2], undefined);
    expect(event.target.value).toBe(''); 
  });


  it('should navigate when downloading a folder', () => {
      const folderItem = mockItems[0];
      component.downloadItem(folderItem);
      expect(router.navigate).toHaveBeenCalledWith([], { queryParams: { folderId: folderItem.id } });
  });

  it('should trigger download for a file', () => {
      const fileItem = mockItems[1];
      
      const linkSpy = jasmine.createSpyObj('a', ['click']);
      spyOn(document, 'createElement').and.returnValue(linkSpy);
      spyOn(document.body, 'appendChild');
      spyOn(document.body, 'removeChild');

      component.downloadItem(fileItem);

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(linkSpy.href).toContain(`/api/items/${fileItem.id}`);
      expect(linkSpy.download).toBe(fileItem.name);
      expect(document.body.appendChild).toHaveBeenCalledWith(linkSpy);
      expect(linkSpy.click).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalledWith(linkSpy);
  });
});
