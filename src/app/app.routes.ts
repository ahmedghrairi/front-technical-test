import { Routes } from '@angular/router';
import { FileManagerComponent } from './components/file-manager/file-manager.component';

export const routes: Routes = [
  { path: '', component: FileManagerComponent },
  { path: '**', redirectTo: '' }
];
