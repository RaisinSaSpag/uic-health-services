import Swal, { type SweetAlertIcon } from 'sweetalert2';

const confirmButtonColor = '#d44974';
const cancelButtonColor = '#8f557b';

interface ConfirmActionOptions {
  title: string;
  text: string;
  icon?: SweetAlertIcon;
  confirmButtonText?: string;
  cancelButtonText?: string;
}

interface PromptTextOptions {
  title: string;
  label?: string;
  placeholder?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
}

export function notifySuccess(message: string, title = 'Success'): Promise<unknown> {
  return Swal.fire({
    icon: 'success',
    title,
    text: message,
    confirmButtonColor,
  });
}

export function notifyError(message: string, title = 'Something went wrong'): Promise<unknown> {
  return Swal.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonColor,
  });
}

export function notifyInfo(message: string, title = 'Notice'): Promise<unknown> {
  return Swal.fire({
    icon: 'info',
    title,
    text: message,
    confirmButtonColor,
  });
}

export function notifyBanner(message: string, title = 'Notification', icon: SweetAlertIcon = 'info'): Promise<unknown> {
  return Swal.fire({
    toast: true,
    position: 'top-end',
    timer: 3500,
    timerProgressBar: true,
    showConfirmButton: false,
    icon,
    title,
    text: message,
  });
}

export async function confirmAction(options: ConfirmActionOptions): Promise<boolean> {
  const result = await Swal.fire({
    icon: options.icon ?? 'warning',
    title: options.title,
    text: options.text,
    showCancelButton: true,
    confirmButtonText: options.confirmButtonText ?? 'Confirm',
    cancelButtonText: options.cancelButtonText ?? 'Cancel',
    confirmButtonColor,
    cancelButtonColor,
    reverseButtons: true,
  });

  return result.isConfirmed;
}

export async function promptRequiredText(options: PromptTextOptions): Promise<string | null> {
  const result = await Swal.fire({
    title: options.title,
    input: 'textarea',
    inputLabel: options.label,
    inputPlaceholder: options.placeholder,
    inputAttributes: {
      autocapitalize: 'on',
      autocorrect: 'on',
    },
    showCancelButton: true,
    confirmButtonText: options.confirmButtonText ?? 'Continue',
    cancelButtonText: options.cancelButtonText ?? 'Cancel',
    confirmButtonColor,
    cancelButtonColor,
    reverseButtons: true,
    inputValidator: (value) => {
      if (!value || value.trim() === '') {
        return 'This field is required.';
      }

      return undefined;
    },
  });

  if (!result.isConfirmed) {
    return null;
  }

  return String(result.value ?? '').trim();
}
