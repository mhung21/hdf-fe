import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ChangePasswordFormComponent } from '../auth/change-password-form.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ChangePasswordFormComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.less'],
})
export class SettingsComponent {}
