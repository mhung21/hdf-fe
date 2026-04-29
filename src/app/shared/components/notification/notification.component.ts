import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-notification',
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.less'],
})
export class NotificationComponent {
  @Input() visible = false;
  @Output() close = new EventEmitter<void>();

  onBackdropClick(event: MouseEvent) {
    // Chỉ đóng nếu click vào backdrop, không phải nội dung
    if ((event.target as HTMLElement).classList.contains('notification-backdrop')) {
      this.close.emit();
    }
  }
}
